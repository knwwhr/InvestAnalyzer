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
   * 전체 종목 스크리닝
   */
  async screenAllStocks(market = 'ALL', limit = 10) {
    // 캐시 확인
    if (this.cachedResults && this.cacheTimestamp) {
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge < this.cacheDuration) {
        console.log('✅ 캐시된 결과 사용');
        return this.cachedResults.slice(0, limit);
      }
    }

    console.log('🔍 전체 종목 스크리닝 시작...');

    const { codes: stockList } = await kisApi.getAllStockList(market);
    const results = [];

    // API 호출 제한 대응 (초당 5건 -> 200ms 간격)
    for (let i = 0; i < stockList.length; i++) {
      const stockCode = stockList[i];
      console.log(`분석 중 [${i + 1}/${stockList.length}]: ${stockCode}`);

      const analysis = await this.analyzeStock(stockCode);

      if (analysis && analysis.totalScore >= 30) { // 최소 점수 30점 이상만
        results.push(analysis);
      }

      // API 호출 간격 (200ms)
      await new Promise(resolve => setTimeout(resolve, 200));

      // 진행률 로그 (10% 단위)
      if ((i + 1) % Math.ceil(stockList.length / 10) === 0) {
        console.log(`📊 진행률: ${Math.round((i + 1) / stockList.length * 100)}%`);
      }
    }

    // 점수 기준 내림차순 정렬
    results.sort((a, b) => b.totalScore - a.totalScore);

    // 캐시 저장
    this.cachedResults = results;
    this.cacheTimestamp = Date.now();

    console.log(`✅ 스크리닝 완료! 총 ${results.length}개 종목 발견`);

    return results.slice(0, limit);
  }

  /**
   * 특정 카테고리 필터링
   */
  async screenByCategory(category, market = 'ALL') {
    // 캐시가 있으면 캐시 사용, 없으면 스크리닝 시도 (타임아웃 가능)
    let allResults;

    if (this.cachedResults && this.cacheTimestamp) {
      const cacheAge = Date.now() - this.cacheTimestamp;
      if (cacheAge < this.cacheDuration) {
        console.log('✅ 카테고리 필터링: 캐시된 결과 사용');
        allResults = this.cachedResults;
      } else {
        console.log('⚠️ 캐시 만료, 새로운 스크리닝 시작...');
        allResults = await this.screenAllStocks(market, 100);
      }
    } else {
      console.log('⚠️ 캐시 없음, 새로운 스크리닝 시작...');
      allResults = await this.screenAllStocks(market, 100);
    }

    switch (category) {
      case 'whale': // 고래 감지
        return allResults.filter(r =>
          r.advancedAnalysis.indicators.whale.length > 0
        ).slice(0, 10);

      case 'accumulation': // 조용한 매집
        return allResults.filter(r =>
          r.advancedAnalysis.indicators.accumulation.detected
        ).slice(0, 10);

      case 'escape': // 탈출 속도
        return allResults.filter(r =>
          r.advancedAnalysis.indicators.escape.detected
        ).slice(0, 10);

      case 'drain': // 유동성 고갈
        return allResults.filter(r =>
          r.advancedAnalysis.indicators.drain.detected
        ).slice(0, 10);

      case 'volume-surge': // 거래량 폭발
        return allResults.filter(r =>
          r.volumeAnalysis.current.volumeMA20 &&
          r.volumeAnalysis.current.volume / r.volumeAnalysis.current.volumeMA20 >= 2.5
        ).slice(0, 10);

      default:
        return allResults.slice(0, 10);
    }
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
