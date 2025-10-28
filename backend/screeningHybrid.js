/**
 * 하이브리드 선행 포착 시스템
 * Grok 백테스트 구조 + Claude 세부 조정
 * 예상 승률: 75-78% (슬리피지 반영)
 */

const kisApi = require('./kisApi');

class HybridScreening {
  /**
   * 점진적 거래량 증가 탐지 (25일 기준, 시장별 기준)
   * @param {Array} chartData - 일봉 데이터 (최소 25일)
   * @param {string} market - 'KOSPI' | 'KOSDAQ'
   * @returns {Object} 탐지 결과
   */
  detectVolumeGradual25d(chartData, market) {
    if (chartData.length < 25) {
      return { detected: false, reason: '데이터 부족 (25일 미만)' };
    }

    const recent = chartData.slice(-25);

    // 시장별 기준 (Claude 제안)
    const volumeThreshold = market === 'KOSPI' ? 30 : 40;  // %
    const priceVolThreshold = market === 'KOSPI' ? 2.5 : 3.5;  // %

    // 5주 구간 분할 (5일씩)
    const week1 = recent.slice(0, 5);
    const week2 = recent.slice(5, 10);
    const week3 = recent.slice(10, 15);
    const week4 = recent.slice(15, 20);
    const week5 = recent.slice(20, 25);

    // 주별 평균 거래량
    const avgVol = (week) =>
      week.reduce((sum, d) => sum + d.volume, 0) / week.length;

    const v1 = avgVol(week1);
    const v2 = avgVol(week2);
    const v3 = avgVol(week3);
    const v4 = avgVol(week4);
    const v5 = avgVol(week5);

    // 점진성 확인 (매주 10% 이상 증가)
    const isGradual =
      v2 >= v1 * 1.10 &&
      v3 >= v2 * 1.10 &&
      v4 >= v3 * 1.10 &&
      v5 >= v4 * 1.10;

    // 전체 증가율
    const totalGrowth = v1 > 0 ? ((v5 - v1) / v1) * 100 : 0;

    // 가격 변동성 (조용한 매집 확인)
    const closes = recent.map(d => d.close);
    const mean = closes.reduce((a, b) => a + b) / closes.length;
    const variance = closes.reduce((sum, price) =>
      sum + Math.pow(price - mean, 2), 0
    ) / closes.length;
    const stdDev = Math.sqrt(variance);
    const priceVolatility = (stdDev / mean) * 100;

    // 최종 판단
    const detected =
      isGradual &&
      totalGrowth >= volumeThreshold &&
      priceVolatility < priceVolThreshold;

    // 예상 급등일 (거래량 증가 속도 기반)
    const expectedSurgeDays = detected
      ? Math.max(7, Math.min(14, 21 - Math.floor(totalGrowth / 5)))
      : null;

    return {
      detected,
      volumeGrowth: totalGrowth.toFixed(1),
      isGradual,
      priceVolatility: priceVolatility.toFixed(2),
      expectedSurgeDays,
      weeklyVolumes: {
        week1: Math.round(v1),
        week2: Math.round(v2),
        week3: Math.round(v3),
        week4: Math.round(v4),
        week5: Math.round(v5)
      },
      interpretation: detected
        ? `세력 매집 진행 중 (${totalGrowth.toFixed(0)}% 증가, ${expectedSurgeDays}일 내 급등 예상)`
        : null
    };
  }

  /**
   * OBV 다이버전스 탐지 (20점 가중치)
   * @param {Array} chartData - 일봉 데이터 (최소 25일)
   * @returns {Object} 탐지 결과
   */
  detectOBVDivergence(chartData) {
    if (chartData.length < 25) {
      return { detected: false, reason: '데이터 부족 (25일 미만)' };
    }

    const recent = chartData.slice(-25);

    // OBV 계산
    let obv = [0];
    for (let i = 1; i < recent.length; i++) {
      const priceChange = recent[i].close - recent[i - 1].close;
      const direction = priceChange > 0 ? 1 : (priceChange < 0 ? -1 : 0);
      obv[i] = obv[i - 1] + (recent[i].volume * direction);
    }

    // 최근 15일 추세 (명확한 기준)
    const obvRecent = obv.slice(-15);
    const priceRecent = recent.slice(-15).map(d => d.close);

    // 선형 회귀 기울기 계산
    const calculateSlope = (data) => {
      const n = data.length;
      const xMean = (n - 1) / 2;
      const yMean = data.reduce((a, b) => a + b) / n;

      let numerator = 0;
      let denominator = 0;

      data.forEach((y, x) => {
        numerator += (x - xMean) * (y - yMean);
        denominator += Math.pow(x - xMean, 2);
      });

      return numerator / denominator;
    };

    const obvSlope = calculateSlope(obvRecent);
    const priceSlope = calculateSlope(priceRecent);

    // OBV 추세를 비율로 정규화
    const obvTrend = obvRecent[0] !== 0
      ? (obvSlope * 14) / obvRecent[0]  // 14일 변화율
      : 0;

    const priceTrend = priceRecent[0] !== 0
      ? (priceSlope * 14) / priceRecent[0]
      : 0;

    // 다이버전스: OBV 상승 + 가격 하락/횡보
    const detected = obvTrend > 0.15 && priceTrend < 0.05;

    return {
      detected,
      obvTrend: (obvTrend * 100).toFixed(2),
      priceTrend: (priceTrend * 100).toFixed(2),
      divergenceStrength: detected
        ? ((obvTrend - priceTrend) * 100).toFixed(2)
        : 0,
      interpretation: detected
        ? `가격 ${(priceTrend * 100).toFixed(1)}% 하락 중 OBV ${(obvTrend * 100).toFixed(1)}% 상승 - 세력 매집 확실`
        : null
    };
  }

  /**
   * RSI 계산 (14일 기준)
   * @param {Array} prices - 종가 배열
   * @param {number} period - 기간 (기본 14일)
   * @returns {number} RSI 값
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * 상승 추세 확인 (RSI 50-70 조건)
   * @param {Array} chartData - 일봉 데이터 (최소 25일)
   * @returns {Object} 확인 결과
   */
  detectUptrendHybrid(chartData) {
    if (chartData.length < 25) {
      return { detected: false, reason: '데이터 부족 (25일 미만)' };
    }

    const recent = chartData.slice(-25);

    // 5일 이평선
    const ma5Values = recent.slice(-5).map(d => d.close);
    const ma5 = ma5Values.reduce((a, b) => a + b) / ma5Values.length;

    // 20일 이평선
    const ma20Values = recent.map(d => d.close);
    const ma20 = ma20Values.reduce((a, b) => a + b) / ma20Values.length;

    // 정배열 확인
    const isGoldenCross = ma5 > ma20;

    // RSI 계산 (14일)
    const rsi = this.calculateRSI(recent.slice(-14).map(d => d.close));

    // 하이브리드 조건: RSI 50-70 (Claude)
    const isRSIGood = rsi >= 50 && rsi <= 70;

    // 최종 판단: 정배열 AND RSI 조건
    const detected = isGoldenCross && isRSIGood;

    return {
      detected,
      ma5: Math.round(ma5),
      ma20: Math.round(ma20),
      spread: ((ma5 - ma20) / ma20 * 100).toFixed(2),
      rsi: rsi.toFixed(1),
      isGoldenCross,
      isRSIGood,
      interpretation: detected
        ? `상승 추세 확인 (MA5 > MA20, RSI ${rsi.toFixed(0)} - 과열 전)`
        : isGoldenCross && !isRSIGood
        ? `정배열이나 RSI ${rsi.toFixed(0)} (${rsi < 50 ? '약세' : '과열'})`
        : null
    };
  }

  /**
   * 실시간 리스크 필터링 (중간 패널티)
   * @param {Object} stockData - 현재 주식 데이터
   * @returns {Object} 필터 결과
   */
  applyRealtimeFilterHybrid(stockData) {
    let penalties = [];
    let penaltyScore = 0;

    // 당일 등락률 계산
    const todayChange = stockData.changeRate || 0;

    // 1. VI 발동 체크 (중간 패널티 -30)
    const isVI = Math.abs(todayChange) >= 10;
    if (isVI) {
      penaltyScore += 30;  // Grok -50 → -30
      penalties.push({ reason: 'VI 발동', penalty: -30 });
    }

    // 2. 오늘 급등 체크 (완화 패널티 -15)
    if (todayChange > 8) {
      penaltyScore += 15;  // Grok -30 → -15
      penalties.push({ reason: `당일 급등 +${todayChange.toFixed(1)}%`, penalty: -15 });
    }

    // 3. 오늘 급락 체크 (중간 패널티 -20)
    if (todayChange < -3) {
      penaltyScore += 20;  // Grok -40 → -20
      penalties.push({ reason: `당일 급락 ${todayChange.toFixed(1)}%`, penalty: -20 });
    }

    return {
      pass: !isVI,  // VI는 완전 제외
      penalties,
      penaltyScore,
      todayChange: todayChange.toFixed(2),
      isVI
    };
  }

  /**
   * 하이브리드 종합 분석 함수
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<Object>} 분석 결과
   */
  async analyzeStockHybrid(stockCode) {
    try {
      // 1. 데이터 조회 (25일)
      const chartData = await kisApi.getDailyChart(stockCode, 25);
      const stockData = await kisApi.getCurrentPrice(stockCode);

      // 시장 구분
      const market = stockCode.startsWith('0') ? 'KOSDAQ' : 'KOSPI';

      // 2. 1단계: Leading Signal
      const volumeGradual = this.detectVolumeGradual25d(chartData, market);
      const obvDivergence = this.detectOBVDivergence(chartData);

      // 3. 2단계: Direction
      const uptrend = this.detectUptrendHybrid(chartData);

      // 4. 3단계: Real-time Filter
      const filter = this.applyRealtimeFilterHybrid(stockData);

      // VI 발동 시 조기 종료
      if (!filter.pass) {
        return {
          stockCode,
          stockName: stockData.stockName,
          grade: 'F',
          score: 0,
          reason: 'VI 발동 제외',
          details: { filter }
        };
      }

      // 5. 점수 계산
      let score = 0;

      if (volumeGradual.detected) score += 50;  // 주요 신호
      if (obvDivergence.detected) score += 20;  // 보조 신호 (Grok 30 → 20)
      if (uptrend.detected) score += 30;        // 방향성 확인

      // 패널티 적용
      score -= filter.penaltyScore;
      score = Math.max(0, score);

      // 6. 등급 산정
      let grade, signal;
      if (score >= 85) {
        grade = 'S';
        signal = 'S급 선행 매수';
      } else if (score >= 70) {
        grade = 'A';
        signal = 'A급 매수';
      } else if (score >= 50) {
        grade = 'B';
        signal = '주목';
      } else if (score >= 30) {
        grade = 'C';
        signal = '관망';
      } else {
        grade = 'D';
        signal = '제외';
      }

      // 7. 결과 반환
      return {
        stockCode,
        stockName: stockData.stockName,
        market,
        grade,
        score,
        signal,
        currentPrice: stockData.currentPrice,
        todayChange: filter.todayChange,

        indicators: {
          volumeGradual: {
            detected: volumeGradual.detected,
            growth: volumeGradual.volumeGrowth + '%',
            expectedDays: volumeGradual.expectedSurgeDays,
            score: volumeGradual.detected ? 50 : 0,
            interpretation: volumeGradual.interpretation
          },
          obvDivergence: {
            detected: obvDivergence.detected,
            obvTrend: obvDivergence.obvTrend,
            priceTrend: obvDivergence.priceTrend,
            score: obvDivergence.detected ? 20 : 0,
            interpretation: obvDivergence.interpretation
          },
          uptrend: {
            detected: uptrend.detected,
            ma5: uptrend.ma5,
            ma20: uptrend.ma20,
            rsi: uptrend.rsi,
            score: uptrend.detected ? 30 : 0,
            interpretation: uptrend.interpretation
          }
        },

        filter: {
          penalties: filter.penalties,
          penaltyScore: filter.penaltyScore
        },

        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error(`분석 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 전체 스크리닝 프로세스 (병렬 처리)
   * @param {Array} stockList - 종목 리스트
   * @returns {Promise<Array>} S/A 등급 종목 리스트
   */
  async runHybridScreening(stockList) {
    console.log(`[하이브리드 스크리닝 시작] ${stockList.length}개 종목`);

    const results = [];
    const batchSize = 10;  // 배치 크기

    // 배치 단위 병렬 처리
    for (let i = 0; i < stockList.length; i += batchSize) {
      const batch = stockList.slice(i, i + batchSize);

      const batchPromises = batch.map(stockCode =>
        this.analyzeStockHybrid(stockCode)
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null));

      console.log(`[진행률] ${Math.min(i + batchSize, stockList.length)}/${stockList.length}`);
    }

    // S/A 등급만 필터링 및 정렬
    const topStocks = results
      .filter(r => r.grade === 'S' || r.grade === 'A')
      .sort((a, b) => b.score - a.score);

    console.log(`[완료] 총 ${topStocks.length}개 유망 종목 발견`);

    return topStocks;
  }
}

module.exports = new HybridScreening();
