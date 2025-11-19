const kisApi = require('./kisApi');
const volumeIndicators = require('./volumeIndicators');
const advancedIndicators = require('./advancedIndicators');
const smartPatternMiner = require('./smartPatternMining');
const leadingIndicators = require('./leadingIndicators');

/**
 * 전체 종목 스크리닝 및 추천
 */
class StockScreener {
  constructor() {
    this.cachedResults = null;
    this.cacheTimestamp = null;
    this.cacheDuration = 60 * 60 * 1000; // 1시간 캐시
    this.savedPatterns = smartPatternMiner.loadSavedPatterns(); // 저장된 패턴 로드

    // 선행 지표 패턴 로드 (async 초기화)
    this.leadingIndicatorsReady = false;
    this.initLeadingIndicators();
  }

  /**
   * 선행 지표 패턴 비동기 로드
   */
  async initLeadingIndicators() {
    try {
      await leadingIndicators.loadPatterns();
      this.leadingIndicatorsReady = true;
      console.log('✅ 선행 지표 시스템 초기화 완료');
    } catch (error) {
      console.log('⚠️ 선행 지표 초기화 실패:', error.message);
      this.leadingIndicatorsReady = false;
    }
  }

  /**
   * 추세 분석 (최근 5일 일자별)
   * @param {Array} chartData - 일봉 데이터
   * @param {Object} currentData - 현재가 정보 (실시간)
   */
  calculateTrendAnalysis(chartData, currentData = null) {
    if (!chartData || chartData.length < 6) {
      return null;
    }

    // 최근 5일 + 기준일(6일전) 필요
    const dailyData = [];

    for (let i = 0; i < 5; i++) {
      const today = chartData[i];
      const yesterday = chartData[i + 1];

      if (!today || !yesterday) continue;

      // 오늘(i=0) 데이터는 현재가 사용, 과거는 종가 사용
      const todayPrice = (i === 0 && currentData) ? currentData.currentPrice : today.close;
      const todayVolume = (i === 0 && currentData) ? currentData.volume : today.volume;

      // 전일 대비 주가 변동률
      const priceChange = ((todayPrice - yesterday.close) / yesterday.close) * 100;

      // 전일 대비 거래량 증가율
      const volumeChange = ((todayVolume - yesterday.volume) / yesterday.volume) * 100;

      // 해당 기간(1일~5일)의 누적 변동률
      const periodStart = chartData[i];
      const periodEnd = chartData[Math.min(i + (i + 1), chartData.length - 1)]; // i일 전부터 현재까지
      const periodPriceChange = periodEnd ? ((todayPrice - periodEnd.close) / periodEnd.close) * 100 : 0;
      const periodVolumeChange = periodEnd ? ((todayVolume - periodEnd.volume) / periodEnd.volume) * 100 : 0;

      dailyData.push({
        dayIndex: i + 1, // 1일전 = 오늘, 2일전 = 어제, ...
        date: today.date,
        close: todayPrice,  // 오늘은 현재가, 과거는 종가
        volume: todayVolume,  // 오늘은 누적거래량, 과거는 종가 거래량
        isToday: i === 0,  // 오늘 여부
        priceChange: parseFloat(priceChange.toFixed(2)),
        volumeChange: parseFloat(volumeChange.toFixed(2)),
        periodPriceChange: parseFloat(periodPriceChange.toFixed(2)),
        periodVolumeChange: parseFloat(periodVolumeChange.toFixed(2))
      });
    }

    // 기하평균 계산 함수
    const calculateGeometricMean = (changes) => {
      if (changes.length === 0) return 0;
      // 변동율을 승수로 변환 (예: +5% → 1.05, -3% → 0.97)
      const multipliers = changes.map(c => 1 + (c / 100));
      // 모든 승수를 곱함
      const product = multipliers.reduce((acc, val) => acc * val, 1);
      // n제곱근
      const geometricMean = Math.pow(product, 1 / multipliers.length);
      // 다시 백분율로 변환
      return ((geometricMean - 1) * 100).toFixed(2);
    };

    return {
      dailyData: dailyData, // 최근 5일 (0=오늘, 1=어제, 2=그저께, ...)
      summary: {
        totalPriceChange: dailyData.length > 0 ? dailyData[dailyData.length - 1].periodPriceChange : 0,
        totalVolumeChange: dailyData.length > 0 ? dailyData[dailyData.length - 1].periodVolumeChange : 0,
        // 기하평균 적용
        avgDailyPriceChange: dailyData.length > 0 ?
          calculateGeometricMean(dailyData.map(d => d.priceChange)) : 0,
        avgDailyVolumeChange: dailyData.length > 0 ?
          calculateGeometricMean(dailyData.map(d => d.volumeChange)) : 0
      }
    };
  }

  /**
   * 거래량 점진적 증가 (Volume Acceleration) 분석 (0-15점) ⬆️ 강화!
   * 30일 데이터 내에서 점진적 거래량 증가 패턴 감지
   * "조용한 매집" 신호 - 급증이 아닌 서서히 증가
   *
   * v3.9: 10→15점 확대 (Trend Score 비중 강화)
   */
  analyzeVolumeAcceleration(chartData) {
    if (!chartData || chartData.length < 25) {
      return { score: 0, detected: false, trend: 'insufficient_data' };
    }

    // 30일을 4개 구간으로 분할 (최근 → 과거)
    // Recent 5 days (D-0 to D-4)
    // Mid 5 days (D-5 to D-9)
    // Old 10 days (D-10 to D-19)
    // Oldest 10 days (D-20 to D-29)

    const recent5 = chartData.slice(0, 5);
    const mid5 = chartData.slice(5, 10);
    const old10 = chartData.slice(10, 20);
    const oldest10 = chartData.slice(20, 30);

    // 각 구간 평균 거래량 계산
    const avgRecent = recent5.reduce((sum, d) => sum + d.volume, 0) / recent5.length;
    const avgMid = mid5.reduce((sum, d) => sum + d.volume, 0) / mid5.length;
    const avgOld = old10.reduce((sum, d) => sum + d.volume, 0) / old10.length;
    const avgOldest = oldest10.reduce((sum, d) => sum + d.volume, 0) / oldest10.length;

    // 점진적 증가 패턴 감지
    // 각 구간이 이전 구간보다 증가해야 함
    const recentVsMid = avgRecent / avgMid; // Recent > Mid
    const midVsOld = avgMid / avgOld;       // Mid > Old
    const oldVsOldest = avgOld / avgOldest;  // Old > Oldest

    // 점진적 증가 조건 (점수 1.5배 확대)
    let score = 0;
    let trend = 'flat';

    if (recentVsMid > 1.1 && midVsOld > 1.1 && oldVsOldest > 1.0) {
      // 모든 구간이 점진적 증가 (이상적 패턴!)
      score = 15; // 10→15 증가 ⬆️
      trend = 'strong_acceleration';
    } else if (recentVsMid > 1.2 && midVsOld > 1.0) {
      // 최근 2개 구간 증가 (유효한 패턴)
      score = 10; // 7→10 증가 ⬆️
      trend = 'moderate_acceleration';
    } else if (recentVsMid > 1.15) {
      // 최근 구간만 증가 (약한 신호)
      score = 6; // 4→6 증가 ⬆️
      trend = 'weak_acceleration';
    }

    return {
      score: parseFloat(score.toFixed(2)),
      detected: score > 0,
      trend,
      details: {
        avgRecent: Math.round(avgRecent),
        avgMid: Math.round(avgMid),
        avgOld: Math.round(avgOld),
        avgOldest: Math.round(avgOldest),
        recentVsMid: parseFloat(recentVsMid.toFixed(2)),
        midVsOld: parseFloat(midVsOld.toFixed(2)),
        oldVsOldest: parseFloat(oldVsOldest.toFixed(2))
      }
    };
  }

  /**
   * 기관/외국인 장기 매집 (Institutional Accumulation) 분석 (0-5점)
   * investorData에서 장기 매수 패턴 감지
   */
  analyzeInstitutionalAccumulation(investorData) {
    if (!investorData || investorData.length === 0) {
      return { score: 0, detected: false, strength: 'none', days: 0 };
    }

    // 기관 + 외국인 순매수 연속일 카운트
    let consecutiveBuyDays = 0;
    let totalNetBuy = 0;

    for (const day of investorData) {
      const institutionNet = parseInt(day.institution_net_buy || 0);
      const foreignNet = parseInt(day.foreign_net_buy || 0);
      const totalNet = institutionNet + foreignNet;

      if (totalNet > 0) {
        consecutiveBuyDays++;
        totalNetBuy += totalNet;
      } else {
        break; // 연속성 깨짐
      }
    }

    // 점수 부여
    let score = 0;
    let strength = 'none';

    if (consecutiveBuyDays >= 5) {
      score = 5; // 5일 이상 연속 매수 (강력한 신호)
      strength = 'strong';
    } else if (consecutiveBuyDays >= 3) {
      score = 3; // 3-4일 연속 매수 (유효한 신호)
      strength = 'moderate';
    } else if (consecutiveBuyDays >= 1) {
      score = 1; // 1-2일 연속 매수 (약한 신호)
      strength = 'weak';
    }

    return {
      score,
      detected: score > 0,
      strength,
      days: consecutiveBuyDays,
      totalNetBuy
    };
  }

  /**
   * 변동성 수축 (Volatility Contraction) 분석 (0-10점) 🆕 NEW
   * 볼린저밴드 수축 = 급등 전조 신호
   *
   * v3.9: Gemini 제안 - 선행 지표 추가
   */
  analyzeVolatilityContraction(chartData) {
    if (!chartData || chartData.length < 25) {
      return { score: 0, detected: false, trend: 'insufficient_data' };
    }

    // 최근 5일 vs 과거 20일 가격 변동폭 비교
    const recent5 = chartData.slice(0, 5);
    const old20 = chartData.slice(5, 25);

    // 각 구간의 평균 일간 변동률 계산
    const calcAvgDailyRange = (slice) => {
      const ranges = slice.map(d => ((d.high - d.low) / d.low) * 100);
      return ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
    };

    const recentVolatility = calcAvgDailyRange(recent5);
    const oldVolatility = calcAvgDailyRange(old20);

    // 변동성 수축 비율
    const contractionRatio = recentVolatility / oldVolatility;

    let score = 0;
    let trend = 'expanding';

    // 변동성이 수축할수록 높은 점수 (급등 전조!)
    if (contractionRatio <= 0.5) {
      // 변동성 50% 이하로 수축 → 강력한 신호!
      score = 10;
      trend = 'strong_contraction';
    } else if (contractionRatio <= 0.7) {
      // 변동성 70% 이하로 수축
      score = 7;
      trend = 'moderate_contraction';
    } else if (contractionRatio <= 0.85) {
      // 변동성 85% 이하로 수축
      score = 4;
      trend = 'weak_contraction';
    }

    return {
      score: parseFloat(score.toFixed(2)),
      detected: score > 0,
      trend,
      details: {
        recentVolatility: parseFloat(recentVolatility.toFixed(2)),
        oldVolatility: parseFloat(oldVolatility.toFixed(2)),
        contractionRatio: parseFloat(contractionRatio.toFixed(2))
      }
    };
  }

  /**
   * VPD 강화 추세 (VPD Strengthening) 분석 (0-5점)
   * 최근 VPD가 과거보다 개선되었는지 확인
   */
  analyzeVPDStrengthening(chartData) {
    if (!chartData || chartData.length < 15) {
      return { score: 0, detected: false, trend: 'insufficient_data' };
    }

    // Recent 5 days VPD vs Old 10 days VPD 비교
    const recent5 = chartData.slice(0, 5);
    const old10 = chartData.slice(10, 20);

    // 각 구간의 평균 거래량 비율 계산
    const calcAvgVolumeRatio = (slice) => {
      const avgVol = slice.reduce((sum, d) => sum + d.volume, 0) / slice.length;
      const latest = slice[0];
      return latest.volume / avgVol;
    };

    const recentVolumeRatio = calcAvgVolumeRatio(recent5);
    const oldVolumeRatio = calcAvgVolumeRatio(old10);

    // 가격 변동률 계산
    const calcAvgPriceChange = (slice) => {
      const start = slice[slice.length - 1];
      const end = slice[0];
      return Math.abs((end.close - start.close) / start.close);
    };

    const recentPriceChange = calcAvgPriceChange(recent5);
    const oldPriceChange = calcAvgPriceChange(old10);

    // VPD = 거래량 증가 - 가격 변동
    // 거래량은 늘었지만 가격은 덜 움직였다 = VPD 강화
    const recentVPD = recentVolumeRatio - recentPriceChange;
    const oldVPD = oldVolumeRatio - oldPriceChange;
    const vpdImprovement = recentVPD - oldVPD;

    let score = 0;
    let trend = 'flat';

    if (vpdImprovement > 0.5) {
      score = 5; // VPD 대폭 개선
      trend = 'strong_improvement';
    } else if (vpdImprovement > 0.2) {
      score = 3; // VPD 개선
      trend = 'moderate_improvement';
    } else if (vpdImprovement > 0) {
      score = 1; // VPD 약간 개선
      trend = 'weak_improvement';
    }

    return {
      score,
      detected: score > 0,
      trend,
      details: {
        recentVPD: parseFloat(recentVPD.toFixed(2)),
        oldVPD: parseFloat(oldVPD.toFixed(2)),
        improvement: parseFloat(vpdImprovement.toFixed(2))
      }
    };
  }

  /**
   * 30일 추세 점수 계산 (Trend Score) (0-35점) ⬆️ 강화!
   * KIS API 30일 제한 내에서 매집 패턴 분석
   *
   * v3.9: 20→35점 확대 (Gemini 제안)
   */
  calculateTrendScore(chartData, investorData) {
    if (!chartData || chartData.length < 25) {
      return {
        totalScore: 0,
        volumeAcceleration: { score: 0, detected: false },
        volatilityContraction: { score: 0, detected: false },
        institutionalAccumulation: { score: 0, detected: false },
        vpdStrengthening: { score: 0, detected: false }
      };
    }

    // 1. 거래량 점진 증가 (0-15점) ⬆️ 10→15 증가
    const volumeAcceleration = this.analyzeVolumeAcceleration(chartData);

    // 2. 변동성 수축 (0-10점) 🆕 NEW
    const volatilityContraction = this.analyzeVolatilityContraction(chartData);

    // 3. 기관/외국인 장기 매집 (0-5점) - 유지
    const institutionalAccumulation = this.analyzeInstitutionalAccumulation(investorData);

    // 4. VPD 강화 추세 (0-5점) - 유지
    const vpdStrengthening = this.analyzeVPDStrengthening(chartData);

    const totalScore = volumeAcceleration.score + volatilityContraction.score +
                       institutionalAccumulation.score + vpdStrengthening.score;

    return {
      totalScore: parseFloat(totalScore.toFixed(2)),
      volumeAcceleration,
      volatilityContraction, // 🆕 NEW
      institutionalAccumulation,
      vpdStrengthening
    };
  }

  /**
   * ========================================
   * 5일 변화율 (Momentum) 시스템
   * ========================================
   * 핵심: D-5일 vs D-0일(현재) 비교
   * "지금 막 시작되는" 종목 포착
   */

  /**
   * 특정 시점(D-N일)의 상태 계산
   * @param {Array} chartData - 일봉 데이터 (최신순, [0]=오늘)
   * @param {Array} investorData - 투자자 데이터
   * @param {number} daysAgo - 며칠 전 (0=오늘, 5=5일전)
   */
  calculateStateAtDay(chartData, investorData, daysAgo) {
    if (!chartData || chartData.length < daysAgo + 10) {
      return null;
    }

    // D-N일 기준으로 데이터 슬라이스
    const slicedChartData = chartData.slice(daysAgo);
    const slicedInvestorData = investorData ? investorData.slice(daysAgo) : [];

    // 1. 거래량 평균 (최근 5일)
    const recent5 = slicedChartData.slice(0, 5);
    const avgVolume = recent5.reduce((sum, d) => sum + d.volume, 0) / recent5.length;

    // 2. VPD 계산
    const currentPrice = slicedChartData[0].close;
    const avgPrice20 = slicedChartData.slice(0, 20).reduce((sum, d) => sum + d.close, 0) / 20;
    const avgVol20 = slicedChartData.slice(0, 20).reduce((sum, d) => sum + d.volume, 0) / 20;

    const volumeRatio = slicedChartData[0].volume / avgVol20;
    const priceChange = ((currentPrice - avgPrice20) / avgPrice20) * 100;
    const priceRatio = Math.abs(priceChange) / 100 + 1.0;
    const vpd = volumeRatio - priceRatio;

    // 3. 선행 지표 점수 (간이 계산 - 실제는 leadingIndicators 사용)
    // 여기서는 거래량 기반 간이 점수로 대체
    const leadingScore = Math.min(volumeRatio * 5, 80); // 0-80점 추정

    // 4. 기관/외국인 순매수 상태
    let institutionalBuyDays = 0;
    if (slicedInvestorData && slicedInvestorData.length > 0) {
      for (const day of slicedInvestorData.slice(0, 5)) {
        const institutionNet = parseInt(day.institution_net_buy || 0);
        const foreignNet = parseInt(day.foreign_net_buy || 0);
        if (institutionNet + foreignNet > 0) {
          institutionalBuyDays++;
        } else {
          break;
        }
      }
    }

    return {
      date: slicedChartData[0].date,
      avgVolume,
      vpd,
      volumeRatio,
      priceChange,
      leadingScore,
      institutionalBuyDays
    };
  }

  /**
   * 1. 거래량 가속도 점수 (0-15점)
   * D-5일 평균 vs D-0일 평균 비교
   */
  calcVolumeAccelerationScore(d5State, d0State) {
    if (!d5State || !d0State) {
      return { score: 0, ratio: 0, trend: 'unknown' };
    }

    const ratio = d0State.avgVolume / d5State.avgVolume;
    let score = 0;
    let trend = 'flat';

    if (ratio >= 3.0) {
      score = 15; // 3배 증가 - 폭발적 시작!
      trend = 'explosive';
    } else if (ratio >= 2.0) {
      score = 10; // 2배 증가 - 강한 시작
      trend = 'strong';
    } else if (ratio >= 1.5) {
      score = 5; // 1.5배 증가 - 조용한 시작
      trend = 'moderate';
    } else if (ratio < 0.7) {
      score = -5; // 거래량 감소 - 페널티
      trend = 'declining';
    }

    return {
      score,
      ratio: parseFloat(ratio.toFixed(2)),
      trend,
      d5Volume: Math.round(d5State.avgVolume),
      d0Volume: Math.round(d0State.avgVolume)
    };
  }

  /**
   * 2. VPD 개선도 점수 (0-10점)
   * D-5일 VPD vs D-0일 VPD 비교
   */
  calcVPDImprovementScore(d5State, d0State) {
    if (!d5State || !d0State) {
      return { score: 0, improvement: 0, trend: 'unknown' };
    }

    const improvement = d0State.vpd - d5State.vpd;
    let score = 0;
    let trend = 'flat';

    // 음수→양수 전환 (가장 중요!)
    if (d5State.vpd < 0 && d0State.vpd > 0) {
      score = 10;
      trend = 'reversal'; // 전환 신호!
    } else if (improvement >= 2.0) {
      score = 7; // 대폭 개선
      trend = 'strong_improvement';
    } else if (improvement >= 1.0) {
      score = 5; // 개선
      trend = 'improvement';
    } else if (improvement >= 0.5) {
      score = 3; // 약간 개선
      trend = 'slight_improvement';
    } else if (improvement < -1.0) {
      score = -5; // 악화 - 페널티
      trend = 'deterioration';
    }

    return {
      score,
      improvement: parseFloat(improvement.toFixed(2)),
      trend,
      d5VPD: parseFloat(d5State.vpd.toFixed(2)),
      d0VPD: parseFloat(d0State.vpd.toFixed(2))
    };
  }

  /**
   * 3. 선행 지표 강화 점수 (0-10점)
   * D-5일 선행점수 vs D-0일 선행점수 비교
   */
  calcPatternStrengtheningScore(d5State, d0State) {
    if (!d5State || !d0State || d5State.leadingScore === 0) {
      return { score: 0, ratio: 0, trend: 'unknown' };
    }

    const ratio = d0State.leadingScore / d5State.leadingScore;
    let score = 0;
    let trend = 'flat';

    if (ratio >= 2.0) {
      score = 10; // 2배 강화 - 패턴 형성!
      trend = 'pattern_forming';
    } else if (ratio >= 1.5) {
      score = 7; // 1.5배 강화
      trend = 'strengthening';
    } else if (ratio >= 1.2) {
      score = 4; // 1.2배 강화
      trend = 'slight_strengthening';
    } else if (ratio < 0.8) {
      score = -3; // 약화 - 페널티
      trend = 'weakening';
    }

    return {
      score,
      ratio: parseFloat(ratio.toFixed(2)),
      trend,
      d5Score: parseFloat(d5State.leadingScore.toFixed(1)),
      d0Score: parseFloat(d0State.leadingScore.toFixed(1))
    };
  }

  /**
   * 4. 기관 진입 가속 점수 (0-5점)
   * D-5일 수급 vs D-0일 수급 비교
   */
  calcInstitutionalEntryScore(d5State, d0State) {
    if (!d5State || !d0State) {
      return { score: 0, trend: 'unknown' };
    }

    const d5Days = d5State.institutionalBuyDays;
    const d0Days = d0State.institutionalBuyDays;

    let score = 0;
    let trend = 'no_change';

    // D-5일에는 없었는데 D-0일에 시작 (가장 중요!)
    if (d5Days === 0 && d0Days >= 3) {
      score = 5;
      trend = 'new_entry'; // 막 진입!
    } else if (d5Days === 0 && d0Days >= 1) {
      score = 3;
      trend = 'starting_entry';
    } else if (d0Days > d5Days && d0Days >= 3) {
      score = 4; // 증가 + 연속 3일
      trend = 'accelerating';
    } else if (d0Days > d5Days) {
      score = 2; // 증가
      trend = 'increasing';
    } else if (d0Days < d5Days) {
      score = -2; // 감소 - 페널티
      trend = 'decreasing';
    }

    return {
      score,
      trend,
      d5Days,
      d0Days
    };
  }

  /**
   * 당일 급등 페널티 계산 (strong) ⬆️ 강화!
   * 목적: "이미 급등한" 종목 강력 감점
   * @param {Array} chartData - 일봉 데이터
   * @returns {Object} { penalty: -20~0, details }
   *
   * v3.9: -16 → -20점 강화 (Gemini 제안)
   */
  calculateDailyRisePenalty(chartData) {
    if (!chartData || chartData.length < 2) {
      return { penalty: 0, closeChange: 0, highChange: 0, message: 'insufficient_data' };
    }

    const today = chartData[0]; // D-0일 (오늘)
    const yesterday = chartData[1]; // D-1일 (어제)

    // 1. 전일 대비 종가 변동률
    const closeChange = ((today.close - yesterday.close) / yesterday.close) * 100;

    // 2. 전일 대비 장중 고가 변동률 (상한가 감지)
    const highChange = ((today.high - yesterday.close) / yesterday.close) * 100;

    let penalty = 0;
    let message = 'normal';

    // Strong 페널티 (급등 종목 강력 필터링) ⬆️
    if (highChange >= 20) {
      // 장중 고가 +20% 이상 (상한가 포함) → -20점
      penalty = -20; // -16→-20 강화! 변화율 40점 중 50% 차감
      message = `⚠️ 당일 급등 (고가 +${highChange.toFixed(1)}%)`;
    } else if (highChange >= 15) {
      // 장중 고가 +15% 이상 → -15점
      penalty = -15; // -12→-15 강화!
      message = `⚠️ 당일 급등 (고가 +${highChange.toFixed(1)}%)`;
    } else if (closeChange >= 10) {
      // 종가 +10% 이상 → -10점
      penalty = -10; // -8→-10 강화!
      message = `당일 상승 (종가 +${closeChange.toFixed(1)}%)`;
    }

    return {
      penalty,
      closeChange: parseFloat(closeChange.toFixed(2)),
      highChange: parseFloat(highChange.toFixed(2)),
      message
    };
  }

  /**
   * 5일 변화율 종합 점수 계산 (0-40점)
   */
  calculate5DayMomentum(chartData, investorData) {
    if (!chartData || chartData.length < 10) {
      return {
        totalScore: 0,
        volumeAcceleration: { score: 0, trend: 'insufficient_data' },
        vpdImprovement: { score: 0, trend: 'insufficient_data' },
        patternStrengthening: { score: 0, trend: 'insufficient_data' },
        institutionalEntry: { score: 0, trend: 'insufficient_data' }
      };
    }

    // D-5일 상태
    const d5State = this.calculateStateAtDay(chartData, investorData, 5);

    // D-0일 (현재) 상태
    const d0State = this.calculateStateAtDay(chartData, investorData, 0);

    if (!d5State || !d0State) {
      return {
        totalScore: 0,
        volumeAcceleration: { score: 0, trend: 'insufficient_data' },
        vpdImprovement: { score: 0, trend: 'insufficient_data' },
        patternStrengthening: { score: 0, trend: 'insufficient_data' },
        institutionalEntry: { score: 0, trend: 'insufficient_data' }
      };
    }

    // 각 변화율 점수 계산
    const volumeAcceleration = this.calcVolumeAccelerationScore(d5State, d0State);
    const vpdImprovement = this.calcVPDImprovementScore(d5State, d0State);
    const patternStrengthening = this.calcPatternStrengtheningScore(d5State, d0State);
    const institutionalEntry = this.calcInstitutionalEntryScore(d5State, d0State);

    const totalScore = Math.max(0,
      volumeAcceleration.score +
      vpdImprovement.score +
      patternStrengthening.score +
      institutionalEntry.score
    );

    return {
      totalScore: parseFloat(totalScore.toFixed(2)),
      volumeAcceleration,
      vpdImprovement,
      patternStrengthening,
      institutionalEntry,
      d5State,
      d0State
    };
  }

  /**
   * 단일 종목 분석 (Phase 4 통합)
   */
  async analyzeStock(stockCode) {
    try {
      // 현재가, 일봉, 투자자 데이터 가져오기
      const [currentData, chartData, investorData] = await Promise.all([
        kisApi.getCurrentPrice(stockCode),
        kisApi.getDailyChart(stockCode, 30),
        kisApi.getInvestorData(stockCode, 5).catch(() => null) // 실패해도 진행
      ]);

      // getCurrentPrice가 null 반환하면 스킵
      if (!currentData) {
        return null;
      }

      // 거래량 지표 분석
      const volumeAnalysis = volumeIndicators.analyzeVolume(chartData);

      // 창의적 지표 분석 (Phase 4 신규 지표 포함)
      const advancedAnalysis = advancedIndicators.analyzeAdvanced(chartData);

      // 신규 지표 추가
      const institutionalFlow = advancedIndicators.checkInstitutionalFlow(investorData);
      const breakoutConfirmation = advancedIndicators.detectBreakoutConfirmation(
        chartData,
        currentData.currentPrice,
        currentData.volume
      );
      const anomaly = advancedIndicators.detectAnomaly(chartData);
      const riskAdjusted = advancedIndicators.calculateRiskAdjustedScore(chartData);

      // 신호 강도 개선: Confluence + Freshness
      const additionalIndicators = {
        institutionalFlow,
        breakoutConfirmation,
        anomaly,
        riskAdjusted
      };
      const confluence = advancedIndicators.calculateConfluenceScore(advancedAnalysis, additionalIndicators);
      const freshness = advancedIndicators.calculateSignalFreshness(chartData, advancedAnalysis, additionalIndicators);

      // 필터링 강화: 작전주, 유동성, 과거급등
      const manipulation = advancedIndicators.detectManipulation(chartData, currentData.marketCap);
      const liquidity = advancedIndicators.checkLiquidity(chartData);
      const previousSurge = advancedIndicators.checkPreviousSurge(chartData);

      // Volume-Price Divergence: "거래량 폭발 + 가격 미반영" 신호 (VPM 대체)
      const volumePriceDivergence = volumeIndicators.calculateVolumePriceDivergence(
        chartData,
        currentData.currentPrice
      );

      // 차트 패턴 인식
      const cupAndHandle = advancedIndicators.detectCupAndHandle(chartData);
      const triangle = advancedIndicators.detectTriangle(chartData);

      // 추세 분석 (5일/10일/20일) - 현재가 정보 포함
      const trendAnalysis = this.calculateTrendAnalysis(chartData, currentData);

      // 종합 점수 계산 (기술적 지표 + 고점 되돌림 페널티)
      let totalScore = this.calculateTotalScore(volumeAnalysis, advancedAnalysis, null, chartData, currentData.currentPrice);

      // ========================================
      // 점수 계산: v3.9 Gemini 제안 적용 (100점 만점)
      // ========================================

      // 새로운 철학: "지금 막 시작되는" 종목 포착 (변곡점 1~2일 전!)
      // - 기본 점수: 0-25점 (품질 체크만, 후행 지표 비중 축소 ⬇️)
      // - 변화율 점수: 0-40점 (D-5일 vs D-0일 변화) ⭐ 핵심!
      // - 추세 점수: 0-35점 (30일 장기 매집 패턴, 비중 확대 ⬆️)
      // = 총 100점

      // 1. 기본 점수 (0-25점) ✅ 직접 사용 (×2 제거!)

      // 2. 과열 감지 (정보용)
      const volumeRatio = volumeAnalysis.current.volumeMA20
        ? volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20
        : 1;
      const overheating = advancedIndicators.checkOverheating(
        chartData,
        currentData.currentPrice,
        volumeRatio,
        volumeAnalysis.indicators.mfi
      );

      // 3. 5일 변화율 점수 (0-40점) ⭐ 핵심!
      let momentumScore = this.calculate5DayMomentum(chartData, investorData);

      // 3-1. 당일 급등 페널티 (moderate) ⭐ 이미 급등한 종목 감점
      const d0DailyPenalty = this.calculateDailyRisePenalty(chartData);
      momentumScore.totalScore = Math.max(0, momentumScore.totalScore + d0DailyPenalty.penalty); // 음수 페널티
      momentumScore.dailyRisePenalty = d0DailyPenalty; // 상세 정보 저장

      totalScore += momentumScore.totalScore;

      // 4. 30일 추세 점수 (0-20점)
      const trendScore = this.calculateTrendScore(chartData, investorData);
      totalScore += trendScore.totalScore;

      // 5. 선행 지표 (참고용, 점수 미반영)
      let leadingScore = null;
      let leadingPoints = 0;
      if (this.leadingIndicatorsReady) {
        try {
          leadingScore = leadingIndicators.analyzeLeadingIndicators(
            volumeAnalysis,
            advancedAnalysis,
            chartData,
            investorData
          );
          leadingPoints = Math.min((leadingScore?.total || 0) * 0.125, 10);
        } catch (error) {
          console.error('선행 지표 분석 실패:', error.message);
        }
      }

      // 6. 원점수 저장 (스코어카드용)
      const rawScore = totalScore;

      // 7. VPD 점수 계산 (스코어카드용)
      const vpdScore = Math.min((volumePriceDivergence.score || 0) * 0.714, 25);

      // 8. 최종 점수 (0-100점 범위, NaN 방지, 소수점 2자리)
      totalScore = isNaN(totalScore) ? 0 : parseFloat(Math.min(Math.max(totalScore, 0), 100).toFixed(2));

      // ========================================
      // 가점/감점 상세 내역 (스코어 카드)
      // ========================================
      const baseScoreValue = this.calculateTotalScore(volumeAnalysis, advancedAnalysis, null, chartData, currentData.currentPrice);

      const scoreBreakdown = {
        // v3.9 새로운 점수 체계 (100점 만점)
        structure: {
          base: '0-25점 (품질 체크)',
          momentum: '0-40점 (D-5일 변화율)',
          trend: '0-35점 (30일 장기 추세)'
        },

        // 1. 기본 점수 (0-25점)
        baseScore: parseFloat(baseScoreValue.toFixed(2)),
        baseComponents: {
          volumeRatio: '거래량 비율 (0-5점)',
          obvTrend: 'OBV 추세 (0-5점)',
          vwapMomentum: 'VWAP 모멘텀 (0-5점)',
          asymmetric: '비대칭 비율 (0-7점) ⭐',
          liquidity: '유동성 필터 (0-3점)',
          drawdownPenalty: '되돌림 페널티 (-3~0점)'
        },

        // 2. 변화율 점수 (0-40점) ⭐ 핵심!
        momentumScore: parseFloat(momentumScore.totalScore.toFixed(2)),
        momentumComponents: {
          volumeAcceleration: {
            name: '거래량 가속도 (0-15점)',
            score: momentumScore.volumeAcceleration.score,
            trend: momentumScore.volumeAcceleration.trend,
            details: `D-5: ${momentumScore.volumeAcceleration.d5Volume?.toLocaleString()}주 → D-0: ${momentumScore.volumeAcceleration.d0Volume?.toLocaleString()}주 (${momentumScore.volumeAcceleration.ratio}배)`
          },
          vpdImprovement: {
            name: 'VPD 개선도 (0-10점)',
            score: momentumScore.vpdImprovement.score,
            trend: momentumScore.vpdImprovement.trend,
            details: `D-5 VPD: ${momentumScore.vpdImprovement.d5VPD} → D-0 VPD: ${momentumScore.vpdImprovement.d0VPD} (개선도: ${momentumScore.vpdImprovement.improvement})`
          },
          patternStrengthening: {
            name: '선행 지표 강화 (0-10점)',
            score: momentumScore.patternStrengthening.score,
            trend: momentumScore.patternStrengthening.trend,
            details: `D-5: ${momentumScore.patternStrengthening.d5Score}점 → D-0: ${momentumScore.patternStrengthening.d0Score}점 (${momentumScore.patternStrengthening.ratio}배)`
          },
          institutionalEntry: {
            name: '기관 진입 가속 (0-5점)',
            score: momentumScore.institutionalEntry.score,
            trend: momentumScore.institutionalEntry.trend,
            details: `D-5: ${momentumScore.institutionalEntry.d5Days}일 → D-0: ${momentumScore.institutionalEntry.d0Days}일`
          }
        },

        // 3. 추세 점수 (0-35점) ⬆️ 강화!
        trendScore: parseFloat(trendScore.totalScore.toFixed(2)),
        trendComponents: {
          volumeAcceleration: {
            name: '거래량 점진 증가 (0-15점) ⬆️',
            score: trendScore.volumeAcceleration.score,
            trend: trendScore.volumeAcceleration.trend
          },
          volatilityContraction: {
            name: '변동성 수축 (0-10점) 🆕',
            score: trendScore.volatilityContraction?.score || 0,
            trend: trendScore.volatilityContraction?.trend || 'unknown',
            details: trendScore.volatilityContraction?.details || null
          },
          institutionalAccumulation: {
            name: '기관/외국인 장기 매집 (0-5점)',
            score: trendScore.institutionalAccumulation.score,
            days: trendScore.institutionalAccumulation.days,
            strength: trendScore.institutionalAccumulation.strength
          },
          vpdStrengthening: {
            name: 'VPD 강화 추세 (0-5점)',
            score: trendScore.vpdStrengthening.score,
            trend: trendScore.vpdStrengthening.trend
          }
        },

        // 4. 최종 점수
        finalScore: parseFloat(totalScore.toFixed(2)),
        maxScore: 100,
        formula: 'Base(0-25) + Momentum(0-40) + Trend(0-35) = Total(0-100)' // v3.9 재조정
      };

      // 랭킹 뱃지 가져오기
      const rankBadges = kisApi.getCachedRankBadges(stockCode);

      return {
        stockCode,
        stockName: currentData.stockName,
        currentPrice: currentData.currentPrice,
        changeRate: currentData.changeRate,
        volume: currentData.volume,
        marketCap: currentData.marketCap,
        volumeAnalysis,
        advancedAnalysis,
        institutionalFlow, // 신규: 기관/외국인 수급
        breakoutConfirmation, // 신규: 돌파 확인
        anomaly, // 신규: 이상 탐지
        riskAdjusted, // 신규: 위험조정 점수
        confluence, // 신규: Confluence 합류점
        freshness, // 신규: 신호 신선도
        manipulation, // 신규: 작전주 필터
        liquidity, // 신규: 유동성 필터
        previousSurge, // 신규: 과거급등 필터
        volumePriceDivergence, // ⭐ Volume-Price Divergence (거래량 폭발 + 가격 미반영)
        cupAndHandle, // 신규: Cup&Handle 패턴
        triangle, // 신규: Triangle 패턴
        scoreBreakdown, // 신규: 가점/감점 상세 내역
        trendAnalysis, // 추세 분석 (5일 일자별)
        momentumScore, // ⭐ 변화율 점수 (D-5 vs D-0, 0-40점)
        trendScore, // ⭐ 추세 점수 (30일 모멘텀, 0-20점)
        overheating, // Phase 4C 과열 정보 추가
        leadingIndicators: leadingScore ? { // ⭐ 선행 지표 통합 (NEW)
          total: leadingScore.total,
          strength: leadingScore.strength,
          confidence: leadingScore.confidence,
          pattern: {
            score: leadingScore.pattern.score,
            matched: leadingScore.pattern.matched,
            patterns: leadingScore.pattern.patterns,
            totalMatched: leadingScore.pattern.totalMatched
          },
          dna: {
            score: leadingScore.dna.score,
            matched: leadingScore.dna.matched,
            volumePattern: leadingScore.dna.volumePattern
          },
          summary: leadingIndicators.generateSummary(leadingScore),
          points: Math.round(leadingPoints)
        } : null,
        totalScore,
        recommendation: this.getRecommendation(totalScore, advancedAnalysis.tier, overheating),
        rankBadges: rankBadges || {}
      };
    } catch (error) {
      console.error(`❌ 종목 분석 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 기본 점수 계산 (Gemini 제안 - Base Score 재조정)
   * 급등 '예정' 종목 발굴에 최적화
   *
   * v3.9: Base 40% → 25% (후행 지표 비중 축소)
   */
  calculateTotalScore(volumeAnalysis, advancedAnalysis, trendScore = null, chartData = null, currentPrice = null) {
    let baseScore = 0;

    // 1. 거래량 비율 (0-5점) ⬇️ 8→5 축소
    if (volumeAnalysis.current.volumeMA20) {
      const volumeRatio = volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20;
      if (volumeRatio >= 5) baseScore += 5;       // 5배 이상 초대량
      else if (volumeRatio >= 3) baseScore += 3;  // 3배 이상 대량
      else if (volumeRatio >= 2) baseScore += 2;  // 2배 이상 급증
      else if (volumeRatio >= 1.5) baseScore += 1; // 1.5배 이상 증가
    }

    // 2. OBV 추세 (0-5점) ⬇️ 7→5 축소
    const obvTrend = volumeAnalysis.signals.obvTrend;
    if (obvTrend && obvTrend.includes('상승')) baseScore += 5;
    else if (obvTrend && obvTrend.includes('횡보')) baseScore += 2;

    // 3. VWAP 모멘텀 (0-5점) - 유지
    if (volumeAnalysis.signals.priceVsVWAP === '상승세') baseScore += 5;

    // 4. 비대칭 비율 (0-7점) ⬆️ 5→7 강화 ⭐
    const asymmetric = advancedAnalysis?.indicators?.asymmetric;
    if (asymmetric && asymmetric.score) {
      baseScore += Math.min(asymmetric.score / 10, 7); // 최대 7점
    }

    // 5. 유동성 필터 (0-3점) 🆕 NEW
    if (chartData && currentPrice) {
      // 간이 유동성: 최근 5일 평균 거래대금
      const recent5 = chartData.slice(0, 5);
      const avgTradingValue = recent5.reduce((sum, d) => sum + (d.close * d.volume), 0) / recent5.length;

      if (avgTradingValue >= 10000000000) baseScore += 3;      // 100억 이상: 3점
      else if (avgTradingValue >= 5000000000) baseScore += 2;  // 50억 이상: 2점
      else if (avgTradingValue >= 1000000000) baseScore += 1;  // 10억 이상: 1점
    }

    // 6. 고점 대비 되돌림 페널티 (-3~0점) ⬇️ -5→-3 완화
    if (chartData && currentPrice) {
      const recentHigh = Math.max(...chartData.slice(0, 30).map(d => d.high));
      const drawdownPercent = ((recentHigh - currentPrice) / recentHigh) * 100;

      if (drawdownPercent >= 20) baseScore -= 3;      // 20% 이상 되돌림: -3점
      else if (drawdownPercent >= 15) baseScore -= 2; // 15% 이상 되돌림: -2점
      else if (drawdownPercent >= 10) baseScore -= 1; // 10% 이상 되돌림: -1점
    }

    // MFI 제거 (급등 예정 신호 아님 - 현재 상태 지표)
    // 창의적 지표 제거 (선행/후행 혼재)

    return Math.min(Math.max(baseScore, 0), 25); // 최대 25점
  }

  /**
   * 추천 등급 산출 (100점 만점 기준, 점수가 높을수록 높은 등급)
   *
   * 백테스트 결과 (BACKTEST_RESULTS.md):
   * - 58-88점 범위: 승률 86.67%, 평균 +24.9%
   * - 42-57점 범위: 승률 77.78%, 평균 +27.5% ⭐ 최고 수익률
   * - 25-41점 범위: 승률 89.33%, 평균 +24.9% ⭐ 최고 승률
   * - 89+점 범위: 승률 100%, 평균 +8.06% (샘플 부족, 과열 가능성)
   *
   * 등급 철학: 점수가 높을수록 높은 등급 (직관적 시스템)
   */
  getRecommendation(score, tier, overheating) {
    let grade, text, color, tooltip;

    // 등급 체계 (점수 ↑ = 등급 ↑)
    if (score >= 58 && score <= 88) {
      // S등급 (최우선 매수 - 거래량 폭발)
      grade = 'S';
      text = '🔥 최우선 매수';
      color = '#ff4444';
      tooltip = '거래량 폭발, 기관 본격 매수 (백테스트: 승률 86.7%, 평균 +24.9%)';
    } else if (score >= 42 && score <= 57) {
      // A등급 (적극 매수 - 진입 적기)
      grade = 'A';
      text = '🟢 적극 매수';
      color = '#00cc00';
      tooltip = '거래량 증가 시작, 기관 초기 진입 (백테스트: 승률 77.8%, 평균 +27.5% ⭐ 최고 수익!)';
    } else if (score >= 25 && score <= 41) {
      // B등급 (매수 고려 - 선행 신호)
      grade = 'B';
      text = '🟡 매수 고려';
      color = '#ffaa00';
      tooltip = '선행 패턴 감지 (백테스트: 승률 89.3%, 평균 +24.9% ⭐ 최고 승률!)';
    } else if (score >= 89) {
      // C등급 (과열 경고)
      grade = 'C';
      text = '⚠️ 과열 경고';
      color = '#ff9900';
      tooltip = '모든 지표 점등, 조정 가능성 (백테스트: 샘플 부족)';
    } else {
      // D등급 (관망 - 신호 부족)
      grade = 'D';
      text = '⚫ 관망';
      color = '#cccccc';
      tooltip = '선행 지표 미감지, 관망 권장';
    }

    // Phase 4 티어 수정
    if (tier === 'watch') {
      text = '👁️ 관심종목 (선행지표)';
      color = '#9966ff'; // 보라색
    } else if (tier === 'buy' && score >= 51) {
      text = '🚀 매수신호 (트리거 발동)';
      color = '#ff6600'; // 주황색
    }

    // 과열 경고 덮어쓰기
    if (overheating.warning) {
      text = '⚠️ 과열 - 조정 대기';
      color = '#ff9900'; // 경고 색상
    } else if (overheating.heatScore > 50) {
      text = `⚠️ ${text} (신중)`;
    }

    return { grade, text, color, tier, overheating: overheating.message, tooltip };
  }

  /**
   * 조용한 누적 패턴 종목 찾기 (거래량 점진 증가)
   * 거래량 급증이 아닌 "서서히" 증가하는 패턴 - 급등 전조
   */
  async findGradualAccumulationStocks(market = 'ALL', targetCount = 10) {
    console.log('🐌 조용한 누적 패턴 종목 탐색 시작...');

    const { codes: allStocks } = await kisApi.getAllStockList(market);
    const gradualStocks = [];
    let scanned = 0;

    // 전체 종목 중 랜덤하게 샘플링하여 효율성 높이기
    const shuffled = [...allStocks].sort(() => Math.random() - 0.5);

    for (const stockCode of shuffled) {
      if (gradualStocks.length >= targetCount) break;
      if (scanned >= 100) break; // 최대 100개만 스캔

      try {
        scanned++;
        const chartData = await kisApi.getDailyChart(stockCode, 30);

        // advancedIndicators에서 gradualAccumulation만 검사
        const advancedIndicators = require('./advancedIndicators');
        const gradualCheck = advancedIndicators.detectGradualAccumulation(chartData);

        if (gradualCheck.detected) {
          gradualStocks.push(stockCode);
          console.log(`  ✅ [${gradualStocks.length}/${targetCount}] 조용한 누적 발견: ${stockCode}`);
        }

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 200));

        if (scanned % 10 === 0) {
          console.log(`  📊 스캔: ${scanned}개, 발견: ${gradualStocks.length}/${targetCount}`);
        }
      } catch (error) {
        // 에러 무시하고 계속 진행
      }
    }

    console.log(`✅ 조용한 누적 ${gradualStocks.length}개 발견 (스캔: ${scanned}개)`);
    return gradualStocks;
  }

  /**
   * 전체 종목 스크리닝 (100개 풀 기반)
   * 거래량 급증 30 + 거래량 20 + 거래대금 10 = 60개 * 2시장 = 120개 (중복 제거 후 ~100개)
   * @param {string} market - 시장 구분
   * @param {number} limit - 반환 개수 제한
   * @param {boolean} skipScoreFilter - true면 점수 필터 건너뜀 (패턴 매칭용)
   */
  async screenAllStocks(market = 'ALL', limit, skipScoreFilter = false) {
    console.log(`🔍 종합 TOP 스크리닝 시작 (100개 풀${limit ? `, 상위 ${limit}개 반환` : ', 전체 반환'})...\n`);

    // 종목 풀 생성 (KIS API 또는 fallback 하드코딩 리스트)
    const { codes: finalStockList } = await kisApi.getAllStockList(market);
    console.log(`✅ 종목 풀: ${finalStockList.length}개 확보\n`);

    // KIS API 디버그 정보 가져오기
    const kisApiDebug = kisApi._lastPoolDebug || { note: 'No debug info available' };

    console.log(`\n📊 전체 종목 분석 시작...\n`);

    const results = [];
    let analyzed = 0;

    // 전체 100개 분석
    for (const stockCode of finalStockList) {
      try {
        const analysis = await this.analyzeStock(stockCode);
        analyzed++;

        // skipScoreFilter가 true면 점수 무시, false면 20점 이상만 (C등급 이상)
        if (analysis && (skipScoreFilter || analysis.totalScore >= 20)) {
          results.push(analysis);
          console.log(`✅ [${results.length}] ${analysis.stockName} (${analysis.stockCode}) - 점수: ${analysis.totalScore.toFixed(1)}`);
        }

        // API 호출 간격 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 10 === 0) {
          console.log(`📊 분석: ${analyzed}/${finalStockList.length}, 발견: ${results.length}개`);
        }
      } catch (error) {
        console.error(`❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`\n✅ 종합 스크리닝 완료!`);
    console.log(`  - 분석: ${analyzed}개`);
    console.log(`  - 발견: ${results.length}개 (20점 이상, C등급+)`);
    console.log(`  - 최종: ${limit ? `상위 ${limit}개` : `전체 ${results.length}개`} 반환\n`);

    const finalResults = limit ? results.slice(0, limit) : results;

    return {
      stocks: finalResults,
      metadata: {
        totalAnalyzed: analyzed,
        totalFound: results.length,
        returned: finalResults.length,
        poolSize: finalStockList.length,
        debug: {
          finalStockListSample: finalStockList.slice(0, 10),
          finalStockListLength: finalStockList.length,
          kisApiDebug: kisApiDebug
        }
      }
    };
  }

  /**
   * 특정 카테고리 필터링 (Vercel stateless 환경 대응)
   */
  async screenByCategory(category, market = 'ALL', limit) {
    console.log(`🔍 ${category} 카테고리 스크리닝 시작${limit ? ` (최대 ${limit}개)` : ' (전체 조회)'}...`);

    const { codes: stockList } = await kisApi.getAllStockList(market);
    const results = [];
    let analyzed = 0;
    let found = 0;

    // 카테고리별 필터 함수 (핵심 2개 지표만 유지)
    const categoryFilters = {
      'whale': (analysis) => analysis.advancedAnalysis.indicators.whale.length > 0,
      'accumulation': (analysis) => analysis.advancedAnalysis.indicators.accumulation.detected
    };

    const filterFn = categoryFilters[category] || (() => true);

    // 조건에 맞는 종목을 찾을 때까지 분석 (최대 전체 리스트)
    // limit이 없으면 전체 스캔, 있으면 limit 개수까지만
    for (let i = 0; i < stockList.length && (limit ? found < limit : true); i++) {
      const stockCode = stockList[i];

      try {
        const analysis = await this.analyzeStock(stockCode);
        analyzed++;

        if (analysis && filterFn(analysis)) {
          results.push(analysis);
          found++;
          console.log(`✅ [${found}${limit ? `/${limit}` : ''}] ${analysis.stockName} - ${category} 조건 충족`);
        }

        // API 호출 간격 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 10 === 0) {
          console.log(`📊 분석: ${analyzed}개, 발견: ${found}${limit ? `/${limit}` : ''}개`);
        }
      } catch (error) {
        console.error(`❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`✅ ${category} 스크리닝 완료! ${analyzed}개 분석, ${found}개 발견`);

    return {
      stocks: results,
      metadata: {
        category,
        totalAnalyzed: analyzed,
        totalFound: found,
        returned: results.length
      }
    };
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.cachedResults = null;
    this.cacheTimestamp = null;
    console.log('🗑️ 캐시 초기화 완료');
  }
}

module.exports = new StockScreener();
