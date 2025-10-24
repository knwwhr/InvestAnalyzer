const kisApi = require('./kisApi');
const volumeIndicators = require('./volumeIndicators');
const advancedIndicators = require('./advancedIndicators');

/**
 * 전체 종목 스크리닝 및 추천
 */
class StockScreener {
  constructor() {
    this.cachedResults = null;
    this.cacheTimestamp = null;
    this.cacheDuration = 60 * 60 * 1000; // 1시간 캐시
  }

  /**
   * 단일 종목 분석
   */
  async analyzeStock(stockCode) {
    try {
      // 현재가 및 일봉 데이터 가져오기
      const [currentData, chartData] = await Promise.all([
        kisApi.getCurrentPrice(stockCode),
        kisApi.getDailyChart(stockCode, 30)
      ]);

      // 거래량 지표 분석
      const volumeAnalysis = volumeIndicators.analyzeVolume(chartData);

      // 창의적 지표 분석
      const advancedAnalysis = advancedIndicators.analyzeAdvanced(chartData);

      // 종합 점수 계산
      const totalScore = this.calculateTotalScore(volumeAnalysis, advancedAnalysis);

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
        totalScore,
        recommendation: this.getRecommendation(totalScore),
        rankBadges: rankBadges || {} // 랭킹 뱃지 추가
      };
    } catch (error) {
      console.error(`❌ 종목 분석 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 종합 점수 계산
   */
  calculateTotalScore(volumeAnalysis, advancedAnalysis) {
    let score = 0;

    // 1. 창의적 지표 점수 (0-100)
    score += advancedAnalysis.totalScore * 0.6; // 60% 가중치

    // 2. MFI 점수 (0-20)
    const mfi = volumeAnalysis.indicators.mfi;
    if (mfi <= 30) score += 20; // 과매도 -> 매수 기회
    else if (mfi >= 70) score -= 10; // 과매수 -> 감점

    // 3. 거래량 급증 점수 (0-20)
    if (volumeAnalysis.current.volumeMA20) {
      const volumeRatio = volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20;
      if (volumeRatio >= 3) score += 20;
      else if (volumeRatio >= 2) score += 10;
    }

    return Math.min(Math.max(score, 0), 100); // 0-100 범위 제한
  }

  /**
   * 추천 등급 산출
   */
  getRecommendation(score) {
    if (score >= 80) return { grade: 'S', text: '🔥 최우선 매수', color: '#ff4444' };
    if (score >= 65) return { grade: 'A', text: '🟢 적극 매수', color: '#00cc00' };
    if (score >= 50) return { grade: 'B', text: '🟡 매수 고려', color: '#ffaa00' };
    if (score >= 35) return { grade: 'C', text: '⚪ 주목', color: '#888888' };
    return { grade: 'D', text: '⚫ 관망', color: '#cccccc' };
  }

  /**
   * 전체 종목 스크리닝 (Vercel 60초 타임아웃 대응 - 부분 스크리닝)
   */
  async screenAllStocks(market = 'ALL', limit = 10) {
    console.log('🔍 종합 TOP 스크리닝 시작...');

    const { codes: stockList } = await kisApi.getAllStockList(market);
    const results = [];
    let analyzed = 0;

    // 최소 점수 30점 이상인 종목을 limit개 찾을 때까지 분석
    for (let i = 0; i < stockList.length && results.length < limit * 3; i++) {
      const stockCode = stockList[i];

      try {
        const analysis = await this.analyzeStock(stockCode);
        analyzed++;

        if (analysis && analysis.totalScore >= 30) {
          results.push(analysis);
          console.log(`✅ [${results.length}] ${analysis.stockName} - 점수: ${analysis.totalScore.toFixed(1)}`);
        }

        // API 호출 간격 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 10 === 0) {
          console.log(`📊 분석: ${analyzed}개, 발견: ${results.length}개`);
        }
      } catch (error) {
        console.error(`❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`✅ 종합 스크리닝 완료! ${analyzed}개 분석, ${results.length}개 발견`);

    return results.slice(0, limit);
  }

  /**
   * 특정 카테고리 필터링 (Vercel stateless 환경 대응)
   */
  async screenByCategory(category, market = 'ALL', limit = 10) {
    console.log(`🔍 ${category} 카테고리 스크리닝 시작...`);

    const { codes: stockList } = await kisApi.getAllStockList(market);
    const results = [];
    let analyzed = 0;
    let found = 0;

    // 카테고리별 필터 함수
    const categoryFilters = {
      'whale': (analysis) => analysis.advancedAnalysis.indicators.whale.length > 0,
      'accumulation': (analysis) => analysis.advancedAnalysis.indicators.accumulation.detected,
      'escape': (analysis) => analysis.advancedAnalysis.indicators.escape.detected,
      'drain': (analysis) => analysis.advancedAnalysis.indicators.drain.detected,
      'volume-surge': (analysis) =>
        analysis.volumeAnalysis.current.volumeMA20 &&
        analysis.volumeAnalysis.current.volume / analysis.volumeAnalysis.current.volumeMA20 >= 2.5
    };

    const filterFn = categoryFilters[category] || (() => true);

    // 조건에 맞는 종목을 찾을 때까지 분석 (최대 전체 리스트)
    for (let i = 0; i < stockList.length && found < limit; i++) {
      const stockCode = stockList[i];

      try {
        const analysis = await this.analyzeStock(stockCode);
        analyzed++;

        if (analysis && filterFn(analysis)) {
          results.push(analysis);
          found++;
          console.log(`✅ [${found}/${limit}] ${analysis.stockName} - ${category} 조건 충족`);
        }

        // API 호출 간격 (200ms)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 10 === 0) {
          console.log(`📊 분석: ${analyzed}개, 발견: ${found}/${limit}개`);
        }
      } catch (error) {
        console.error(`❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    console.log(`✅ ${category} 스크리닝 완료! ${analyzed}개 분석, ${found}개 발견`);

    return results;
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
