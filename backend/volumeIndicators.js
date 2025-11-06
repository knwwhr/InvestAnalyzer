/**
 * 거래량 기반 기술적 지표 계산 모듈
 */

/**
 * OBV (On-Balance Volume) 계산
 * 거래량 누적 지표로 매수/매도 압력 파악
 */
function calculateOBV(chartData) {
  const obv = [];
  let obvValue = 0;

  for (let i = 0; i < chartData.length; i++) {
    if (i === 0) {
      obvValue = chartData[i].volume;
    } else {
      if (chartData[i].close > chartData[i - 1].close) {
        obvValue += chartData[i].volume;  // 상승시 거래량 추가
      } else if (chartData[i].close < chartData[i - 1].close) {
        obvValue -= chartData[i].volume;  // 하락시 거래량 차감
      }
      // 동일가는 변화 없음
    }

    obv.push({
      date: chartData[i].date,
      obv: obvValue
    });
  }

  return obv;
}

/**
 * 거래량 이동평균 계산
 * @param {Array} chartData - 차트 데이터
 * @param {number} period - 이동평균 기간
 */
function calculateVolumeMA(chartData, period = 20) {
  const volumeMA = [];

  for (let i = 0; i < chartData.length; i++) {
    if (i < period - 1) {
      volumeMA.push({
        date: chartData[i].date,
        volumeMA: null
      });
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += chartData[i - j].volume;
      }
      volumeMA.push({
        date: chartData[i].date,
        volumeMA: Math.round(sum / period)
      });
    }
  }

  return volumeMA;
}

/**
 * MFI (Money Flow Index) 계산
 * RSI의 거래량 버전 - 0~100 사이 값
 * 80 이상: 과매수, 20 이하: 과매도
 */
function calculateMFI(chartData, period = 14) {
  const mfi = [];

  for (let i = 0; i < chartData.length; i++) {
    if (i < period) {
      mfi.push({
        date: chartData[i].date,
        mfi: null
      });
      continue;
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const typicalPrice = (chartData[j].high + chartData[j].low + chartData[j].close) / 3;
      const rawMoneyFlow = typicalPrice * chartData[j].volume;

      if (j > 0) {
        const prevTypicalPrice = (chartData[j - 1].high + chartData[j - 1].low + chartData[j - 1].close) / 3;

        if (typicalPrice > prevTypicalPrice) {
          positiveFlow += rawMoneyFlow;
        } else if (typicalPrice < prevTypicalPrice) {
          negativeFlow += rawMoneyFlow;
        }
      }
    }

    const moneyFlowRatio = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
    const mfiValue = 100 - (100 / (1 + moneyFlowRatio));

    mfi.push({
      date: chartData[i].date,
      mfi: mfiValue.toFixed(2)
    });
  }

  return mfi;
}

/**
 * VWAP (Volume Weighted Average Price) 계산
 * 거래량 가중 평균 가격
 */
function calculateVWAP(chartData) {
  const vwap = [];
  let cumulativeTPV = 0;  // 누적 (Typical Price × Volume)
  let cumulativeVolume = 0;

  for (let i = 0; i < chartData.length; i++) {
    const typicalPrice = (chartData[i].high + chartData[i].low + chartData[i].close) / 3;
    cumulativeTPV += typicalPrice * chartData[i].volume;
    cumulativeVolume += chartData[i].volume;

    vwap.push({
      date: chartData[i].date,
      vwap: cumulativeVolume === 0 ? 0 : (cumulativeTPV / cumulativeVolume).toFixed(2)
    });
  }

  return vwap;
}

/**
 * 거래량 급증 탐지
 * 평균 거래량 대비 현재 거래량 비율 계산
 */
function detectVolumeSurge(chartData, threshold = 2.0) {
  const signals = [];
  const volumeMA = calculateVolumeMA(chartData, 20);

  for (let i = 0; i < chartData.length; i++) {
    if (volumeMA[i].volumeMA) {
      const ratio = chartData[i].volume / volumeMA[i].volumeMA;

      if (ratio >= threshold) {
        signals.push({
          date: chartData[i].date,
          volume: chartData[i].volume,
          averageVolume: volumeMA[i].volumeMA,
          ratio: ratio.toFixed(2),
          priceChange: chartData[i].close - chartData[i - 1]?.close || 0,
          signal: ratio >= 3 ? '🔥 초대량' : '⚠️ 급증'
        });
      }
    }
  }

  return signals;
}

/**
 * A/D Line (Accumulation/Distribution Line) 계산
 * 매집/분산 판단 지표
 */
function calculateADLine(chartData) {
  const adLine = [];
  let adValue = 0;

  for (let i = 0; i < chartData.length; i++) {
    const { high, low, close, volume } = chartData[i];

    // Money Flow Multiplier
    const mfm = ((close - low) - (high - close)) / (high - low || 1);

    // Money Flow Volume
    const mfv = mfm * volume;

    adValue += mfv;

    adLine.push({
      date: chartData[i].date,
      adLine: adValue.toFixed(2)
    });
  }

  return adLine;
}

/**
 * 종합 거래량 분석
 */
function analyzeVolume(chartData) {
  const latestData = chartData[0];  // chartData는 내림차순 (최신 데이터가 0번 인덱스)
  const volumeMA20 = calculateVolumeMA(chartData, 20);
  const obv = calculateOBV(chartData);
  const mfi = calculateMFI(chartData, 14);
  const vwap = calculateVWAP(chartData);
  const adLine = calculateADLine(chartData);
  const volumeSurge = detectVolumeSurge(chartData, 1.5);

  return {
    current: {
      date: latestData.date,
      price: latestData.close,
      volume: latestData.volume,
      volumeMA20: volumeMA20[volumeMA20.length - 1]?.volumeMA
    },
    indicators: {
      obv: obv[obv.length - 1]?.obv,
      mfi: parseFloat(mfi[mfi.length - 1]?.mfi),
      vwap: parseFloat(vwap[vwap.length - 1]?.vwap),
      adLine: parseFloat(adLine[adLine.length - 1]?.adLine)
    },
    signals: {
      volumeSurge: volumeSurge.slice(-5),  // 최근 5개 급등 신호
      mfiSignal: getMFISignal(parseFloat(mfi[mfi.length - 1]?.mfi)),
      obvTrend: getOBVTrend(obv.slice(-10)),
      priceVsVWAP: latestData.close > parseFloat(vwap[vwap.length - 1]?.vwap) ? '상승세' : '하락세'
    },
    chartData: {
      volumeMA20: volumeMA20,
      obv: obv,
      mfi: mfi,
      vwap: vwap,
      adLine: adLine
    }
  };
}

/**
 * MFI 신호 해석
 */
function getMFISignal(mfiValue) {
  if (!mfiValue) return '데이터 부족';
  if (mfiValue >= 80) return '🔴 과매수 (매도 고려)';
  if (mfiValue <= 20) return '🟢 과매도 (매수 고려)';
  return '⚪ 중립';
}

/**
 * OBV 추세 판단
 */
function getOBVTrend(obvData) {
  if (obvData.length < 2) return '데이터 부족';

  const recent = obvData.slice(-3).map(d => d.obv);
  const isRising = recent[2] > recent[1] && recent[1] > recent[0];
  const isFalling = recent[2] < recent[1] && recent[1] < recent[0];

  if (isRising) return '📈 상승 (매수세 우세)';
  if (isFalling) return '📉 하락 (매도세 우세)';
  return '➡️ 횡보';
}

module.exports = {
  calculateOBV,
  calculateVolumeMA,
  calculateMFI,
  calculateVWAP,
  calculateADLine,
  detectVolumeSurge,
  analyzeVolume
};
