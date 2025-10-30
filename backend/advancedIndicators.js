/**
 * 창의적인 거래량 기반 지표 모듈
 * 1. 고래 감지 (Whale Detection)
 * 2. 조용한 매집 (Silent Accumulation)
 * 3. 탈출 속도 (Escape Velocity)
 * 4. 유동성 고갈 (Liquidity Drain)
 */

/**
 * 1. 고래 감지 지표 (Whale Detection)
 * 평소 대비 대량 거래 + 급격한 가격 변동 감지
 * 기관/외국인 등 큰 손의 매매 패턴 포착
 * + 윗꼬리 필터링 추가 (30% 이상 시 점수 감점)
 */
function detectWhale(chartData) {
  const recentData = chartData.slice(-10); // 최근 10일
  const avgVolume = chartData.slice(-30, -10).reduce((sum, d) => sum + d.volume, 0) / 20;

  const whaleSignals = [];

  for (let i = 1; i < recentData.length; i++) {
    const data = recentData[i];
    const volumeRatio = data.volume / avgVolume;
    const priceChange = Math.abs((data.close - data.open) / data.open * 100);

    // 윗꼬리 비율 계산
    const range = data.high - data.low;
    const upperShadow = range > 0
      ? ((data.high - data.close) / range) * 100
      : 0;

    // 고가 대비 낙폭
    const highDecline = data.high > 0
      ? ((data.high - data.close) / data.high) * 100
      : 0;

    // 고래 감지 조건:
    // 1. 거래량이 평균의 2.5배 이상
    // 2. 가격 변동률 3% 이상
    // 3. 거래대금 상위권
    if (volumeRatio >= 2.5 && priceChange >= 3) {
      const isUpWhale = data.close > data.open; // 상승 고래 vs 하락 고래

      // 기본 강도 점수
      let intensity = volumeRatio * priceChange / 10;

      // 윗꼬리 페널티: 30% 이상이면 강도 50% 감소
      let upperShadowPenalty = 0;
      if (isUpWhale && upperShadow >= 30) {
        intensity = intensity * 0.5; // 50% 감점
        upperShadowPenalty = upperShadow;
      }

      whaleSignals.push({
        date: data.date,
        type: isUpWhale ? '🐋 매수 고래' : '🐳 매도 고래',
        volumeRatio: volumeRatio.toFixed(2),
        priceChange: priceChange.toFixed(2),
        volume: data.volume,
        intensity: intensity,
        upperShadow: upperShadow.toFixed(1),
        highDecline: highDecline.toFixed(1),
        warning: upperShadowPenalty > 0 ? `⚠️ 윗꼬리 ${upperShadow.toFixed(1)}% (되돌림 위험)` : null
      });
    }
  }

  return whaleSignals;
}

/**
 * 2. 조용한 매집 지표 (Silent Accumulation)
 * 가격은 횡보하지만 거래량이 꾸준히 증가
 * 큰 손들의 물량 모으기 패턴 감지
 * 5일 데이터로도 작동 가능하도록 개선
 */
function detectSilentAccumulation(chartData) {
  const dataLength = chartData.length;

  // 데이터가 5일 미만이면 분석 불가
  if (dataLength < 5) {
    return {
      detected: false,
      priceVolatility: '0.00',
      volumeGrowth: '0.00',
      avgPrice: 0,
      signal: '데이터 부족',
      score: 0
    };
  }

  // 사용 가능한 모든 데이터 사용
  const recent = chartData.slice(-Math.min(20, dataLength));

  // 가격 변동성 계산
  const prices = recent.map(d => d.close);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const priceStdDev = Math.sqrt(
    prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length
  );
  const priceVolatility = (priceStdDev / avgPrice) * 100;

  // 거래량 추세 계산 (데이터 양에 따라 동적 분할)
  let volumeGrowth = 0;

  if (recent.length >= 10) {
    // 10일 이상: 전반부 vs 후반부
    const midPoint = Math.floor(recent.length / 2);
    const firstHalf = recent.slice(0, midPoint);
    const secondHalf = recent.slice(midPoint);
    const avgVolumeFirst = firstHalf.reduce((sum, d) => sum + d.volume, 0) / firstHalf.length;
    const avgVolumeSecond = secondHalf.reduce((sum, d) => sum + d.volume, 0) / secondHalf.length;
    volumeGrowth = ((avgVolumeSecond - avgVolumeFirst) / avgVolumeFirst) * 100;
  } else {
    // 5~9일: 첫날 vs 마지막날 거래량 비교
    const firstVolume = recent[0].volume;
    const lastVolume = recent[recent.length - 1].volume;
    volumeGrowth = ((lastVolume - firstVolume) / firstVolume) * 100;
  }

  // 조용한 매집 조건 (완화):
  // 1. 가격 변동성 낮음 (15% 미만) - 횡보 구간
  // 2. 거래량 증가 (0% 이상) - 증가 또는 유지
  const isSilentAccumulation = priceVolatility < 15 && volumeGrowth > 0;

  return {
    detected: isSilentAccumulation,
    priceVolatility: priceVolatility.toFixed(2),
    volumeGrowth: volumeGrowth.toFixed(2),
    avgPrice: Math.round(avgPrice),
    signal: isSilentAccumulation ? '🤫 조용한 매집 진행중' : '없음',
    score: isSilentAccumulation ? Math.max(volumeGrowth, 10) : 0
  };
}

/**
 * 3. 탈출 속도 지표 (Escape Velocity)
 * 저항선 돌파 + 거래량 폭발 조합
 * 모멘텀 시작 시점 포착
 * + Closing Strength 검증 추가 (윗꼬리 필터)
 */
function detectEscapeVelocity(chartData) {
  const recent = chartData.slice(-30);
  const latest = recent[recent.length - 1];
  const yesterday = recent[recent.length - 2];

  // 최근 20일 고가 (저항선)
  const resistance = Math.max(...recent.slice(0, -5).map(d => d.high));

  // 평균 거래량
  const avgVolume = recent.slice(0, -5).reduce((sum, d) => sum + d.volume, 0) / 25;

  // Closing Strength: 종가가 당일 거래범위에서 차지하는 위치 (0~100%)
  const range = latest.high - latest.low;
  const closingStrength = range > 0
    ? ((latest.close - latest.low) / range) * 100
    : 50;

  // 윗꼬리 비율: 고가 대비 종가 하락폭
  const upperShadow = range > 0
    ? ((latest.high - latest.close) / range) * 100
    : 0;

  // 고가 대비 낙폭 (%)
  const highDecline = latest.high > 0
    ? ((latest.high - latest.close) / latest.high) * 100
    : 0;

  // 탈출 속도 조건:
  // 1. 현재 종가가 저항선 돌파
  // 2. 거래량이 평균의 2배 이상
  // 3. 상승 캔들 (종가 > 시가)
  // 4. Closing Strength 70% 이상 (강한 마감)
  // 5. 고가 대비 낙폭 10% 미만 (윗꼬리 제한)
  const breaksResistance = latest.close > resistance;
  const volumeSurge = latest.volume / avgVolume >= 2;
  const isGreenCandle = latest.close > latest.open;
  const strongClosing = closingStrength >= 70;
  const acceptableDecline = highDecline < 10;

  const detected = breaksResistance && volumeSurge && isGreenCandle && strongClosing && acceptableDecline;

  // 모멘텀 강도 계산 (Closing Strength 반영)
  const momentum = detected ?
    ((latest.close - resistance) / resistance * 100) * (latest.volume / avgVolume) * (closingStrength / 100) : 0;

  return {
    detected,
    resistance: Math.round(resistance),
    currentPrice: latest.close,
    volumeRatio: (latest.volume / avgVolume).toFixed(2),
    priceBreakout: ((latest.close - resistance) / resistance * 100).toFixed(2),
    closingStrength: closingStrength.toFixed(1),
    upperShadow: upperShadow.toFixed(1),
    highDecline: highDecline.toFixed(1),
    signal: detected ? '🚀 탈출 속도 달성' :
            !acceptableDecline ? `⚠️ 윗꼬리 과다 (고가대비 -${highDecline.toFixed(1)}%)` :
            !strongClosing ? '⚠️ 약한 마감' : '없음',
    momentum: momentum.toFixed(2),
    score: detected ? momentum : 0,
    warning: !acceptableDecline || !strongClosing ? '장중 급등 후 되돌림 - 추가 하락 위험' : null
  };
}

/**
 * 4. 유동성 고갈 지표 (Liquidity Drain)
 * 거래량 급감 + 변동성 축소
 * 큰 움직임 직전 신호 (스프링 압축)
 */
function detectLiquidityDrain(chartData) {
  const recent = chartData.slice(-10); // 최근 10일
  const previous = chartData.slice(-30, -10); // 이전 20일

  // 평균 거래량 비교
  const avgVolumeRecent = recent.reduce((sum, d) => sum + d.volume, 0) / 10;
  const avgVolumePrevious = previous.reduce((sum, d) => sum + d.volume, 0) / 20;
  const volumeDecline = ((avgVolumeRecent - avgVolumePrevious) / avgVolumePrevious) * 100;

  // 변동성 비교 (최근 vs 이전)
  const calcVolatility = (data) => {
    const ranges = data.map(d => ((d.high - d.low) / d.close) * 100);
    return ranges.reduce((a, b) => a + b, 0) / ranges.length;
  };

  const volatilityRecent = calcVolatility(recent);
  const volatilityPrevious = calcVolatility(previous);
  const volatilityDecline = ((volatilityRecent - volatilityPrevious) / volatilityPrevious) * 100;

  // 유동성 고갈 조건:
  // 1. 거래량 감소 (-30% 이하)
  // 2. 변동성 감소 (-20% 이하)
  const detected = volumeDecline < -30 && volatilityDecline < -20;

  return {
    detected,
    volumeDecline: volumeDecline.toFixed(2),
    volatilityDecline: volatilityDecline.toFixed(2),
    avgVolumeRecent: Math.round(avgVolumeRecent),
    signal: detected ? '💧 유동성 고갈 (폭발 대기)' : '없음',
    score: detected ? Math.abs(volumeDecline + volatilityDecline) : 0
  };
}

/**
 * 비대칭 거래량 지표 (Asymmetric Volume)
 * 상승일 거래량 vs 하락일 거래량 비교
 * 실제 매수세/매도세 강도 측정
 */
function calculateAsymmetricVolume(chartData) {
  const recent = chartData.slice(-20);

  let upVolume = 0;
  let downVolume = 0;
  let upDays = 0;
  let downDays = 0;

  recent.forEach(day => {
    if (day.close > day.open) {
      upVolume += day.volume;
      upDays++;
    } else if (day.close < day.open) {
      downVolume += day.volume;
      downDays++;
    }
  });

  const ratio = downVolume === 0 ? 100 : (upVolume / downVolume);

  return {
    upVolume,
    downVolume,
    upDays,
    downDays,
    ratio: ratio.toFixed(2),
    signal: ratio > 1.5 ? '📈 강한 매수세' : ratio < 0.7 ? '📉 강한 매도세' : '⚖️ 균형',
    score: Math.abs(ratio - 1) * 50 // 1에서 멀수록 높은 점수
  };
}

/**
 * 거래량 3일 연속 순증 체크
 */
function checkVolumeConsecutiveIncrease(chartData, days = 3) {
  const recent = chartData.slice(-days - 1); // N+1일 데이터 필요

  if (recent.length < days + 1) {
    return { consecutive: false, days: 0 };
  }

  let consecutiveDays = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].volume > recent[i - 1].volume) {
      consecutiveDays++;
    } else {
      consecutiveDays = 0; // 연속 끊김
    }
  }

  return {
    consecutive: consecutiveDays >= days,
    days: consecutiveDays,
    volumes: recent.map(d => d.volume)
  };
}

/**
 * Phase 4A-1: 조용한 거래량 누적 패턴
 * 급등 전에 거래량이 점진적으로 증가하는 패턴 감지
 * + 거래량 3일 연속 순증 조건 추가
 */
function detectGradualAccumulation(chartData) {
  const recent20 = chartData.slice(-20);
  const volumeTrend = [];

  // 5일 단위로 거래량 평균 계산
  for (let i = 0; i < 4; i++) {
    const period = recent20.slice(i * 5, (i + 1) * 5);
    const avgVolume = period.reduce((sum, d) => sum + d.volume, 0) / 5;
    volumeTrend.push(avgVolume);
  }

  // 점진적 증가: 각 주차마다 10% 이상 증가
  const isGradualIncrease =
    volumeTrend[1] > volumeTrend[0] * 1.1 &&
    volumeTrend[2] > volumeTrend[1] * 1.1 &&
    volumeTrend[3] > volumeTrend[2] * 1.1;

  // 가격은 안정적 (최근 20일 변동폭 5% 이내)
  const firstPrice = recent20[0].close;
  const lastPrice = recent20[recent20.length - 1].close;
  const priceChange = Math.abs((lastPrice - firstPrice) / firstPrice);
  const priceStable = priceChange < 0.05;

  // 거래량 3일 연속 순증 체크
  const volumeCheck = checkVolumeConsecutiveIncrease(chartData, 3);

  // 증가율 계산
  const growthRate = ((volumeTrend[3] - volumeTrend[0]) / volumeTrend[0]) * 100;

  // 기존 조건 + 3일 연속 순증 조건
  const detected = isGradualIncrease && priceStable && volumeCheck.consecutive;

  return {
    detected,
    signal: detected ? '🐌 조용한 누적 (급등 전조)' : '없음',
    volumeTrend: volumeTrend.map(v => Math.round(v)),
    growthRate: growthRate.toFixed(1),
    priceChange: (priceChange * 100).toFixed(2),
    volumeConsecutive: volumeCheck.consecutive,
    consecutiveDays: volumeCheck.days,
    score: detected ? Math.min(growthRate, 80) : 0,
    interpretation: detected
      ? `세력이 가격 자극 없이 물량 모으는 중 (${volumeCheck.days}일 연속 거래량 증가), 1~2주 후 급등 가능성`
      : volumeCheck.consecutive
      ? '거래량 연속 증가 중이나 가격 변동폭 큼'
      : '패턴 미발견',
    readyIn: detected ? '7~14일' : null
  };
}

/**
 * Phase 4A-2: 스마트머니 유입 지표
 * 대형 거래(기관/외국인) vs 소형 거래(개인) 비교
 */
function detectSmartMoney(chartData) {
  const recent10 = chartData.slice(-10);

  // 거래량 기준 정렬 (복사본 사용)
  const sortedByVolume = [...recent10].sort((a, b) => b.volume - a.volume);

  // 상위 30% (대형 거래일 - 기관/외국인 추정)
  const bigVolumeDays = sortedByVolume.slice(0, 3);
  const bigVolumeMovement = bigVolumeDays.reduce(
    (sum, d) => sum + (d.close - d.open) / d.open,
    0
  );

  // 하위 70% (소형 거래일 - 개인 추정)
  const smallVolumeDays = sortedByVolume.slice(3);
  const smallVolumeMovement = smallVolumeDays.reduce(
    (sum, d) => sum + (d.close - d.open) / d.open,
    0
  );

  // 스마트머니 매수: 대형 거래일엔 상승, 소형 거래일엔 하락
  const smartMoneyBuying = bigVolumeMovement > 0 && smallVolumeMovement < 0;

  // 대형 거래 평균 수익률
  const bigAvgReturn = (bigVolumeMovement / 3) * 100;
  const smallAvgReturn = (smallVolumeMovement / 7) * 100;

  const ratio = smallVolumeMovement !== 0
    ? Math.abs(bigVolumeMovement / smallVolumeMovement)
    : 10;

  const detected = smartMoneyBuying && ratio > 2;

  return {
    detected,
    signal: detected ? '🧠 스마트머니 유입' : '없음',
    bigVolumeReturn: bigAvgReturn.toFixed(2),
    smallVolumeReturn: smallAvgReturn.toFixed(2),
    ratio: ratio.toFixed(2),
    score: detected ? Math.min(ratio * 20, 70) : 0,
    interpretation: detected
      ? '기관/외국인이 사고 개인이 파는 중 - 기회'
      : '스마트머니 유입 미확인'
  };
}

/**
 * Phase 4A-3: 저점 매집 패턴 (역발상)
 * 하락 후 거래량 급감 → 바닥 신호
 */
function detectBottomFormation(chartData) {
  const recent30 = chartData.slice(-30);

  // 1단계: 최근 고점 대비 15% 이상 하락
  const highPrice = Math.max(...recent30.slice(0, 10).map(d => d.high));
  const currentPrice = recent30[recent30.length - 1].close;
  const decline = ((currentPrice - highPrice) / highPrice) * 100;
  const declined = decline < -15;

  // 2단계: 최근 5일간 거래량 급감 (공포 소멸)
  const recentVolume =
    recent30.slice(-5).reduce((sum, d) => sum + d.volume, 0) / 5;
  const avgVolume =
    recent30.slice(0, 20).reduce((sum, d) => sum + d.volume, 0) / 20;
  const volumeRatio = recentVolume / avgVolume;
  const volumeDrying = volumeRatio < 0.5;

  // 3단계: 가격 횡보 (바닥 다지기) - 최근 5일 변동 3% 이내
  const recent5Prices = recent30.slice(-5).map(d => d.close);
  const maxPrice = Math.max(...recent5Prices);
  const minPrice = Math.min(...recent5Prices);
  const priceRange = ((maxPrice - minPrice) / currentPrice) * 100;
  const priceStable = priceRange < 3;

  const detected = declined && volumeDrying && priceStable;

  return {
    detected,
    signal: detected ? '🌱 저점 형성 (반등 대기)' : '없음',
    highPrice: Math.round(highPrice),
    currentPrice: Math.round(currentPrice),
    decline: decline.toFixed(1),
    volumeRatio: volumeRatio.toFixed(2),
    priceRange: priceRange.toFixed(2),
    score: detected ? Math.abs(decline) * 2 : 0,
    interpretation: detected
      ? '악재 소진 + 매도세 고갈 = 반등 임박 (단, 추가 하락 리스크 있음)'
      : '저점 패턴 미형성',
    readyIn: detected ? '3~7일' : null
  };
}

/**
 * Phase 4B-1: 저항선 돌파 "직전" 포착
 */
function detectBreakoutPreparation(chartData) {
  const recent30 = chartData.slice(-30);
  const currentPrice = recent30[recent30.length - 1].close;

  // 저항선 계산 (최근 30일 중 초반 25일의 고점)
  const resistance = Math.max(...recent30.slice(0, 25).map(d => d.high));

  // 저항선 터치 횟수 (2% 이내 접근)
  const touchCount = recent30.filter(
    d => Math.abs(d.high - resistance) / resistance < 0.02
  ).length;

  // 현재 저항선 바로 아래 (3% 이내)
  const gapPercent = ((resistance - currentPrice) / currentPrice) * 100;
  const nearResistance = gapPercent >= 0 && gapPercent < 3;

  // 거래량 증가 추세 (돌파 준비)
  const recent5Volume =
    recent30.slice(-5).reduce((sum, d) => sum + d.volume, 0) / 5;
  const prev5Volume =
    recent30.slice(-10, -5).reduce((sum, d) => sum + d.volume, 0) / 5;
  const volumeIncreasing = recent5Volume > prev5Volume * 1.3;

  const detected = touchCount >= 3 && nearResistance && volumeIncreasing;

  return {
    detected,
    signal: detected ? '🚪 저항선 돌파 준비' : '없음',
    resistance: Math.round(resistance),
    currentPrice: Math.round(currentPrice),
    gap: gapPercent.toFixed(2),
    touchCount,
    volumeGrowth: ((recent5Volume / prev5Volume - 1) * 100).toFixed(1),
    score: detected ? 90 : 0,
    interpretation: detected
      ? `${touchCount}번 도전 끝에 돌파 임박 - 저항선 ${Math.round(resistance)}원 돌파 시 매수`
      : '돌파 준비 단계 아님',
    triggerPrice: detected ? Math.round(resistance * 1.01) : null
  };
}

/**
 * Phase 4C: 과열 감지 필터
 * 고점 매수 방지
 * + 고가 대비 낙폭 체크 추가 (10% 이상 경고)
 */
function checkOverheating(chartData, currentPrice, volumeRatio, mfi) {
  const recent10 = chartData.slice(-10);
  const latest = chartData[chartData.length - 1];

  // 1. 최근 10일간 30% 이상 급등
  const firstPrice = recent10[0].close;
  const surgePercent = ((currentPrice - firstPrice) / firstPrice) * 100;
  const surge = surgePercent > 30;

  // 2. 거래량이 평소 10배 이상
  const extremeVolume = volumeRatio > 10;

  // 3. MFI 90 이상 (극과매수)
  const extremeOverbought = mfi > 90;

  // 4. 고가 대비 낙폭 체크 (당일 고가 → 종가 하락)
  const highDecline = latest.high > 0
    ? ((latest.high - latest.close) / latest.high) * 100
    : 0;
  const significantDecline = highDecline >= 10; // 10% 이상 하락

  // 5. Closing Strength (종가 위치)
  const range = latest.high - latest.low;
  const closingStrength = range > 0
    ? ((latest.close - latest.low) / range) * 100
    : 50;
  const weakClosing = closingStrength < 50; // 하단 50% 이내 마감

  const warning = surge && extremeVolume && extremeOverbought;
  const pullbackWarning = significantDecline || weakClosing; // 되돌림 경고

  // 과열도 점수 (0~100, 높을수록 위험)
  let heatScore = 0;
  if (surgePercent > 50) heatScore += 40;
  else if (surgePercent > 30) heatScore += 25;

  if (volumeRatio > 15) heatScore += 35;
  else if (volumeRatio > 10) heatScore += 20;

  if (mfi > 95) heatScore += 25;
  else if (mfi > 90) heatScore += 15;

  // 고가 대비 낙폭 페널티 추가
  if (highDecline >= 15) heatScore += 30; // 15% 이상 급락
  else if (highDecline >= 10) heatScore += 20; // 10% 이상 하락

  return {
    warning,
    pullbackWarning,
    heatScore: Math.min(heatScore, 100),
    surge: surge,
    surgePercent: surgePercent.toFixed(1),
    extremeVolume: extremeVolume,
    extremeOverbought: extremeOverbought,
    highDecline: highDecline.toFixed(1),
    closingStrength: closingStrength.toFixed(1),
    message: warning
      ? '⚠️ 과열 종목 - 단기 조정 위험 높음'
      : pullbackWarning && highDecline >= 10
      ? `⚠️ 장중 되돌림 (고가대비 -${highDecline.toFixed(1)}%)`
      : heatScore > 50
      ? '⚠️ 과열 징후 - 신중 매수'
      : '✅ 정상 범위',
    recommendation: warning
      ? '매수 대기 (10~20% 조정 후 재진입 권장)'
      : pullbackWarning && highDecline >= 10
      ? `1일 급등 후 되돌림 - 익일 추가 하락 가능성 (고가 ${latest.high.toLocaleString()}원 돌파 대기)`
      : heatScore > 50
      ? '소량 분할 매수 권장'
      : '정상 매수 가능',
    scorePenalty: warning ? -50 : pullbackWarning && highDecline >= 10 ? -40 : heatScore > 50 ? -25 : 0
  };
}

/**
 * 종합 분석 및 점수화 (Phase 4 통합)
 */
function analyzeAdvanced(chartData) {
  // 기존 지표
  const whale = detectWhale(chartData);
  const accumulation = detectSilentAccumulation(chartData);
  const escape = detectEscapeVelocity(chartData);
  const drain = detectLiquidityDrain(chartData);
  const asymmetric = calculateAsymmetricVolume(chartData);

  // Phase 4 신규 지표
  const gradualAccumulation = detectGradualAccumulation(chartData);
  const smartMoney = detectSmartMoney(chartData);
  const bottomFormation = detectBottomFormation(chartData);
  const breakoutPrep = detectBreakoutPreparation(chartData);

  // 종합 점수 계산 (0-100)
  let totalScore = 0;

  // 고래 감지 점수 (최대 25점)
  if (whale.length > 0) {
    const maxIntensity = Math.max(...whale.map(w => w.intensity));
    totalScore += Math.min(maxIntensity, 25);
  }

  // 조용한 매집 점수 (최대 25점)
  if (accumulation.detected) {
    totalScore += Math.min(accumulation.score / 2, 25);
  }

  // 탈출 속도 점수 (최대 30점)
  if (escape.detected) {
    totalScore += Math.min(escape.score, 30);
  }

  // 유동성 고갈 점수 (최대 10점)
  if (drain.detected) {
    totalScore += Math.min(drain.score / 5, 10);
  }

  // 비대칭 거래량 점수 (최대 10점)
  totalScore += Math.min(asymmetric.score / 5, 10);

  // Phase 4A: 선행 지표 보너스 (최대 30점)
  if (gradualAccumulation.detected) {
    totalScore += Math.min(gradualAccumulation.score / 3, 15);
  }
  if (smartMoney.detected) {
    totalScore += Math.min(smartMoney.score / 5, 10);
  }
  if (bottomFormation.detected) {
    totalScore += Math.min(bottomFormation.score / 3, 15);
  }

  // Phase 4B: 타이밍 지표 (최대 20점)
  if (breakoutPrep.detected) {
    totalScore += Math.min(breakoutPrep.score / 5, 20);
  }

  // 매수/매도 추천 (과열 체크 전)
  let recommendation = '관망';
  if (totalScore >= 70) recommendation = '🟢 강력 매수';
  else if (totalScore >= 50) recommendation = '🟡 매수 고려';
  else if (totalScore >= 30) recommendation = '⚪ 주목';
  else recommendation = '⚫ 관망';

  // 신호 수집
  const signals = [
    ...whale.map(w => w.type),
    accumulation.signal,
    escape.signal,
    drain.signal,
    asymmetric.signal,
    gradualAccumulation.signal,
    smartMoney.signal,
    bottomFormation.signal,
    breakoutPrep.signal
  ].filter(s => s !== '없음');

  // 종목 티어 분류
  let tier = 'normal'; // normal, watch, buy, wait
  let readyIn = null;

  if (gradualAccumulation.detected || bottomFormation.detected) {
    tier = 'watch'; // 관심 종목 (선행 지표)
    readyIn = gradualAccumulation.readyIn || bottomFormation.readyIn;
  }

  if (breakoutPrep.detected || (escape.detected && totalScore >= 60)) {
    tier = 'buy'; // 매수 신호 (트리거 발동)
  }

  return {
    indicators: {
      // 기존 지표
      whale,
      accumulation,
      escape,
      drain,
      asymmetric,
      // Phase 4 신규 지표
      gradualAccumulation,
      smartMoney,
      bottomFormation,
      breakoutPrep
    },
    totalScore: Math.round(totalScore),
    recommendation,
    signals,
    tier,
    readyIn,
    triggerPrice: breakoutPrep.triggerPrice
  };
}

module.exports = {
  detectWhale,
  detectSilentAccumulation,
  detectEscapeVelocity,
  detectLiquidityDrain,
  calculateAsymmetricVolume,
  checkVolumeConsecutiveIncrease,
  detectGradualAccumulation,
  detectSmartMoney,
  detectBottomFormation,
  detectBreakoutPreparation,
  checkOverheating,
  analyzeAdvanced
};
