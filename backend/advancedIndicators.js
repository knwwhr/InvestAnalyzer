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
 */
function detectWhale(chartData) {
  const recentData = chartData.slice(-10); // 최근 10일
  const avgVolume = chartData.slice(-30, -10).reduce((sum, d) => sum + d.volume, 0) / 20;

  const whaleSignals = [];

  for (let i = 1; i < recentData.length; i++) {
    const data = recentData[i];
    const volumeRatio = data.volume / avgVolume;
    const priceChange = Math.abs((data.close - data.open) / data.open * 100);

    // 고래 감지 조건:
    // 1. 거래량이 평균의 2.5배 이상
    // 2. 가격 변동률 3% 이상
    // 3. 거래대금 상위권
    if (volumeRatio >= 2.5 && priceChange >= 3) {
      const isUpWhale = data.close > data.open; // 상승 고래 vs 하락 고래

      whaleSignals.push({
        date: data.date,
        type: isUpWhale ? '🐋 매수 고래' : '🐳 매도 고래',
        volumeRatio: volumeRatio.toFixed(2),
        priceChange: priceChange.toFixed(2),
        volume: data.volume,
        intensity: volumeRatio * priceChange / 10 // 강도 점수
      });
    }
  }

  return whaleSignals;
}

/**
 * 2. 조용한 매집 지표 (Silent Accumulation)
 * 가격은 횡보하지만 거래량이 꾸준히 증가
 * 큰 손들의 물량 모으기 패턴 감지
 */
function detectSilentAccumulation(chartData) {
  const recent = chartData.slice(-20); // 최근 20일

  // 가격 변동성 계산
  const prices = recent.map(d => d.close);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const priceStdDev = Math.sqrt(
    prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length
  );
  const priceVolatility = (priceStdDev / avgPrice) * 100;

  // 거래량 추세 계산 (최근 거래량이 증가 추세인가?)
  const firstHalf = recent.slice(0, 10);
  const secondHalf = recent.slice(10, 20);
  const avgVolumeFirst = firstHalf.reduce((sum, d) => sum + d.volume, 0) / 10;
  const avgVolumeSecond = secondHalf.reduce((sum, d) => sum + d.volume, 0) / 10;
  const volumeGrowth = ((avgVolumeSecond - avgVolumeFirst) / avgVolumeFirst) * 100;

  // 조용한 매집 조건:
  // 1. 가격 변동성 낮음 (3% 미만)
  // 2. 거래량 증가 추세 (20% 이상)
  const isSilentAccumulation = priceVolatility < 3 && volumeGrowth > 20;

  return {
    detected: isSilentAccumulation,
    priceVolatility: priceVolatility.toFixed(2),
    volumeGrowth: volumeGrowth.toFixed(2),
    avgPrice: Math.round(avgPrice),
    signal: isSilentAccumulation ? '🤫 조용한 매집 진행중' : '없음',
    score: isSilentAccumulation ? volumeGrowth : 0
  };
}

/**
 * 3. 탈출 속도 지표 (Escape Velocity)
 * 저항선 돌파 + 거래량 폭발 조합
 * 모멘텀 시작 시점 포착
 */
function detectEscapeVelocity(chartData) {
  const recent = chartData.slice(-30);
  const latest = recent[recent.length - 1];
  const yesterday = recent[recent.length - 2];

  // 최근 20일 고가 (저항선)
  const resistance = Math.max(...recent.slice(0, -5).map(d => d.high));

  // 평균 거래량
  const avgVolume = recent.slice(0, -5).reduce((sum, d) => sum + d.volume, 0) / 25;

  // 탈출 속도 조건:
  // 1. 현재 종가가 저항선 돌파
  // 2. 거래량이 평균의 2배 이상
  // 3. 상승 캔들 (종가 > 시가)
  const breaksResistance = latest.close > resistance;
  const volumeSurge = latest.volume / avgVolume >= 2;
  const isGreenCandle = latest.close > latest.open;

  const detected = breaksResistance && volumeSurge && isGreenCandle;

  // 모멘텀 강도 계산
  const momentum = detected ?
    ((latest.close - resistance) / resistance * 100) * (latest.volume / avgVolume) : 0;

  return {
    detected,
    resistance: Math.round(resistance),
    currentPrice: latest.close,
    volumeRatio: (latest.volume / avgVolume).toFixed(2),
    priceBreakout: ((latest.close - resistance) / resistance * 100).toFixed(2),
    signal: detected ? '🚀 탈출 속도 달성' : '없음',
    momentum: momentum.toFixed(2),
    score: detected ? momentum : 0
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
 * 종합 분석 및 점수화
 */
function analyzeAdvanced(chartData) {
  const whale = detectWhale(chartData);
  const accumulation = detectSilentAccumulation(chartData);
  const escape = detectEscapeVelocity(chartData);
  const drain = detectLiquidityDrain(chartData);
  const asymmetric = calculateAsymmetricVolume(chartData);

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

  // 매수/매도 추천
  let recommendation = '관망';
  if (totalScore >= 70) recommendation = '🟢 강력 매수';
  else if (totalScore >= 50) recommendation = '🟡 매수 고려';
  else if (totalScore >= 30) recommendation = '⚪ 주목';
  else recommendation = '⚫ 관망';

  return {
    indicators: {
      whale,
      accumulation,
      escape,
      drain,
      asymmetric
    },
    totalScore: Math.round(totalScore),
    recommendation,
    signals: [
      ...whale.map(w => w.type),
      accumulation.signal,
      escape.signal,
      drain.signal,
      asymmetric.signal
    ].filter(s => s !== '없음')
  };
}

module.exports = {
  detectWhale,
  detectSilentAccumulation,
  detectEscapeVelocity,
  detectLiquidityDrain,
  calculateAsymmetricVolume,
  analyzeAdvanced
};
