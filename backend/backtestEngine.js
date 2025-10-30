/**
 * 백테스트 엔진
 * Grok 81.3% 승률 재현 검증 및 하이브리드 시스템 성능 측정
 */

const kisApi = require('./kisApi');
const hybridScreening = require('./screeningHybrid');
const screening = require('./screening'); // 기존 시스템

class BacktestEngine {
  constructor() {
    this.results = [];
  }

  /**
   * 단일 종목 백테스트 (하이브리드 시스템)
   * @param {string} stockCode - 종목 코드
   * @param {string} signalDate - 신호 발생일 (YYYYMMDD)
   * @param {number} holdDays - 보유 기간 (기본 10일)
   * @returns {Promise<Object>} 백테스트 결과
   */
  async backtestSingleStockHybrid(stockCode, signalDate, holdDays = 10) {
    try {
      // 신호일 기준 60일 데이터 조회 (25일 분석 + 35일 여유)
      const chartData = await kisApi.getDailyChart(stockCode, 60);

      // 신호일 찾기
      const signalIndex = chartData.findIndex(d => d.date === signalDate);
      if (signalIndex === -1) {
        return { error: `신호일 ${signalDate} 데이터 없음` };
      }

      // 신호일까지의 데이터로 분석
      const dataUpToSignal = chartData.slice(0, signalIndex + 1);
      if (dataUpToSignal.length < 25) {
        return { error: '데이터 부족 (25일 미만)' };
      }

      // 시장 구분
      const market = stockCode.startsWith('0') ? 'KOSDAQ' : 'KOSPI';

      // 하이브리드 분석 실행
      const volumeGradual = hybridScreening.detectVolumeGradual25d(
        dataUpToSignal.slice(-25),
        market
      );
      const obvDivergence = hybridScreening.detectOBVDivergence(
        dataUpToSignal.slice(-25)
      );
      const uptrend = hybridScreening.detectUptrendHybrid(
        dataUpToSignal.slice(-25)
      );

      // 점수 계산
      let score = 0;
      if (volumeGradual.detected) score += 50;
      if (obvDivergence.detected) score += 20;
      if (uptrend.detected) score += 30;

      // S/A 등급만 매수 (70점 이상)
      const shouldBuy = score >= 70;

      if (!shouldBuy) {
        return {
          stockCode,
          signalDate,
          action: 'SKIP',
          reason: `점수 부족 (${score}점)`,
          score
        };
      }

      // 매수 시뮬레이션 (신호일 종가)
      const buyPrice = chartData[signalIndex].close;
      const buyDate = chartData[signalIndex].date;

      // 매도 시뮬레이션 (holdDays일 후 종가)
      const sellIndex = signalIndex + holdDays;
      if (sellIndex >= chartData.length) {
        return { error: '매도일 데이터 부족' };
      }

      const sellPrice = chartData[sellIndex].close;
      const sellDate = chartData[sellIndex].date;

      // 수익률 계산 (거래비용 0.3% 포함)
      const grossReturn = ((sellPrice - buyPrice) / buyPrice) * 100;
      const tradingCost = 0.3; // 0.15% 매수 + 0.15% 매도
      const netReturn = grossReturn - tradingCost;

      // 최대 손실 (hold 기간 동안)
      let maxDrawdown = 0;
      for (let i = signalIndex; i <= sellIndex; i++) {
        const currentReturn = ((chartData[i].close - buyPrice) / buyPrice) * 100;
        if (currentReturn < maxDrawdown) {
          maxDrawdown = currentReturn;
        }
      }

      return {
        stockCode,
        signalDate: buyDate,
        buyPrice,
        sellDate,
        sellPrice,
        holdDays,
        grossReturn: grossReturn.toFixed(2),
        netReturn: netReturn.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        win: netReturn > 0,
        score,
        indicators: {
          volumeGradual: volumeGradual.detected,
          obvDivergence: obvDivergence.detected,
          uptrend: uptrend.detected
        }
      };

    } catch (error) {
      console.error(`백테스트 실패 [${stockCode}]:`, error.message);
      return { error: error.message };
    }
  }

  /**
   * 오늘 신호 → 실전 추적용
   * @param {number} limit - 종목 수
   * @returns {Promise<Array>} 추적 대상 종목
   */
  async getTodaySignals(limit = 5) {
    console.log('\n📊 오늘 D-5 패턴 기반 신호 발굴 중...\n');

    try {
      // 패턴 캐시 사용 (GitHub Gist 또는 메모리)
      const gistStorage = require('./gistStorage');
      const patternCache = require('./patternCache');

      let patternsData = null;

      // 1. GitHub Gist에서 시도
      if (gistStorage.isConfigured()) {
        console.log('📥 GitHub Gist에서 패턴 데이터 로드 시도...');
        patternsData = await gistStorage.loadPatterns();
      }

      // 2. 메모리 캐시에서 시도
      if (!patternsData) {
        console.log('💾 메모리 캐시에서 패턴 데이터 로드 시도...');
        patternsData = patternCache.getPatterns();
      }

      // 3. 데이터 없으면 빈 배열 반환
      if (!patternsData || !patternsData.stocks || patternsData.stocks.length === 0) {
        console.log('⚠️ 패턴 데이터 없음 - 패턴 분석을 먼저 실행하세요');
        return [];
      }

      // 급등 종목 중 수익률 상위 N개 추출
      const topStocks = patternsData.stocks
        .sort((a, b) => parseFloat(b.returnRate) - parseFloat(a.returnRate))
        .slice(0, limit);

      console.log(`\n✅ 오늘 신호 ${topStocks.length}개 발견 (D-5 패턴 기반)\n`);

      // 각 종목의 현재가 조회
      const signalsWithPrice = [];
      for (const stock of topStocks) {
        try {
          // 현재가 조회
          const currentData = await kisApi.getCurrentPrice(stock.stockCode);
          const currentPrice = currentData?.price || 0;
          const priceChange = currentData?.priceChange || 0;

          // 점수 계산 세부 로직
          const returnRate = parseFloat(stock.returnRate);
          let score = 0;
          const scoreBreakdown = {};

          // 1. 과거 수익률 기반 (최대 40점)
          scoreBreakdown.historicalReturn = Math.min(40, parseInt(returnRate * 1.3));
          score += scoreBreakdown.historicalReturn;

          // 2. 패턴 매칭 보너스 (최대 30점)
          const patternCount = stock.matchedPatterns?.length || 0;
          scoreBreakdown.patternBonus = Math.min(30, patternCount * 5);
          score += scoreBreakdown.patternBonus;

          // 3. 선행 지표 점수 (최대 30점)
          let indicatorScore = 0;
          if (stock.preSurgeIndicators?.accumulation) indicatorScore += 10; // 조용한 매집
          if (stock.preSurgeIndicators?.whale) indicatorScore += 10; // 고래 감지
          if (parseFloat(stock.preSurgeIndicators?.rsi || 0) > 50 && parseFloat(stock.preSurgeIndicators?.rsi || 0) < 80) indicatorScore += 5; // RSI 적정
          if (parseFloat(stock.preSurgeIndicators?.obvTrend || 0) > 0) indicatorScore += 5; // OBV 상승
          scoreBreakdown.indicators = indicatorScore;
          score += indicatorScore;

          // 등급 산정
          let grade = 'D';
          if (score >= 70) grade = 'S';
          else if (score >= 55) grade = 'A';
          else if (score >= 40) grade = 'B';
          else if (score >= 30) grade = 'C';

          signalsWithPrice.push({
            stockCode: stock.stockCode,
            stockName: stock.stockName,
            grade: grade,
            score: score,
            scoreBreakdown: scoreBreakdown,
            currentPrice: currentPrice,
            todayChange: priceChange,
            signalDate: stock.surgeDate,
            expectedSurgeDays: 5, // D-5 패턴
            returnRate: stock.returnRate,
            indicators: {
              accumulation: stock.preSurgeIndicators?.accumulation || false,
              whale: stock.preSurgeIndicators?.whale || false,
              obvTrend: stock.preSurgeIndicators?.obvTrend || 0,
              rsi: stock.preSurgeIndicators?.rsi || 50
            },
            matchedPatterns: stock.matchedPatterns || []
          });

          console.log(`  ✓ ${stock.stockName}: ${currentPrice}원 (${priceChange > 0 ? '+' : ''}${priceChange}%)`);
        } catch (priceError) {
          console.warn(`  ⚠️ ${stock.stockName}: 현재가 조회 실패`);
          // 현재가 조회 실패해도 종목은 포함 (0으로 표시)
          signalsWithPrice.push({
            stockCode: stock.stockCode,
            stockName: stock.stockName,
            grade: parseFloat(stock.returnRate) >= 30 ? 'S' : parseFloat(stock.returnRate) >= 20 ? 'A' : 'B',
            score: Math.min(100, parseInt(parseFloat(stock.returnRate) * 3)),
            scoreBreakdown: { error: '현재가 조회 실패' },
            currentPrice: 0,
            todayChange: 0,
            signalDate: stock.surgeDate,
            expectedSurgeDays: 5,
            returnRate: stock.returnRate,
            indicators: {
              accumulation: stock.preSurgeIndicators?.accumulation || false,
              whale: stock.preSurgeIndicators?.whale || false,
              obvTrend: stock.preSurgeIndicators?.obvTrend || 0,
              rsi: stock.preSurgeIndicators?.rsi || 50
            },
            matchedPatterns: stock.matchedPatterns || []
          });
        }
      }

      return signalsWithPrice;
    } catch (error) {
      console.error('getTodaySignals 실패:', error.message);
      return [];
    }
  }

  /**
   * 종합 통계 계산
   * @param {Array} results - 백테스트 결과 배열
   * @returns {Object} 통계
   */
  calculateStatistics(results) {
    const validResults = results.filter(r => !r.error && r.netReturn);

    if (validResults.length === 0) {
      return { error: '유효한 결과 없음' };
    }

    const wins = validResults.filter(r => r.win);
    const losses = validResults.filter(r => !r.win);

    const winRate = (wins.length / validResults.length) * 100;

    const avgReturn = validResults.reduce((sum, r) =>
      sum + parseFloat(r.netReturn), 0
    ) / validResults.length;

    const avgWin = wins.length > 0
      ? wins.reduce((sum, r) => sum + parseFloat(r.netReturn), 0) / wins.length
      : 0;

    const avgLoss = losses.length > 0
      ? losses.reduce((sum, r) => sum + parseFloat(r.netReturn), 0) / losses.length
      : 0;

    const maxReturn = Math.max(...validResults.map(r => parseFloat(r.netReturn)));
    const minReturn = Math.min(...validResults.map(r => parseFloat(r.netReturn)));

    const maxDrawdown = Math.min(...validResults.map(r => parseFloat(r.maxDrawdown)));

    // 샤프 비율 (간단 계산: 평균 수익률 / 표준편차)
    const stdDev = Math.sqrt(
      validResults.reduce((sum, r) =>
        sum + Math.pow(parseFloat(r.netReturn) - avgReturn, 2), 0
      ) / validResults.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) : 0;

    return {
      totalTrades: validResults.length,
      wins: wins.length,
      losses: losses.length,
      winRate: winRate.toFixed(2) + '%',
      avgReturn: avgReturn.toFixed(2) + '%',
      avgWin: avgWin.toFixed(2) + '%',
      avgLoss: avgLoss.toFixed(2) + '%',
      maxReturn: maxReturn.toFixed(2) + '%',
      minReturn: minReturn.toFixed(2) + '%',
      maxDrawdown: maxDrawdown.toFixed(2) + '%',
      sharpeRatio: sharpeRatio.toFixed(2),
      profitFactor: avgLoss !== 0
        ? (Math.abs(avgWin * wins.length) / Math.abs(avgLoss * losses.length)).toFixed(2)
        : 'N/A'
    };
  }

  /**
   * A/B 테스트: 하이브리드 vs 기존 시스템
   * @param {string} stockCode - 종목 코드
   * @param {string} signalDate - 신호일
   * @param {number} holdDays - 보유 기간
   * @returns {Promise<Object>} 비교 결과
   */
  async compareHybridVsLegacy(stockCode, signalDate, holdDays = 10) {
    try {
      // 하이브리드 결과
      const hybridResult = await this.backtestSingleStockHybrid(
        stockCode,
        signalDate,
        holdDays
      );

      // 기존 시스템 분석 (간단 시뮬레이션)
      const chartData = await kisApi.getDailyChart(stockCode, 60);
      const currentData = await kisApi.getCurrentPrice(stockCode);

      const legacyAnalysis = await screening.analyzeStock(
        stockCode,
        chartData,
        currentData
      );

      const legacyScore = legacyAnalysis?.totalScore || 0;
      const legacyShouldBuy = legacyScore >= 40; // 기존 시스템 B등급 기준

      return {
        stockCode,
        signalDate,
        hybrid: {
          shouldBuy: hybridResult.score >= 70,
          score: hybridResult.score,
          result: hybridResult
        },
        legacy: {
          shouldBuy: legacyShouldBuy,
          score: legacyScore,
          grade: legacyAnalysis?.recommendation?.grade || 'N/A'
        },
        agreement: (hybridResult.score >= 70) === legacyShouldBuy,
        winner: hybridResult.win ? 'HYBRID' : 'N/A'
      };

    } catch (error) {
      console.error('A/B 테스트 실패:', error.message);
      return { error: error.message };
    }
  }
}

module.exports = new BacktestEngine();
