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
   * 단일 종목 분석 (Phase 4 통합)
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

      // 창의적 지표 분석 (Phase 4 신규 지표 포함)
      const advancedAnalysis = advancedIndicators.analyzeAdvanced(chartData);

      // 종합 점수 계산
      let totalScore = this.calculateTotalScore(volumeAnalysis, advancedAnalysis);

      // Phase 4C: 과열 감지 필터
      const volumeRatio = volumeAnalysis.current.volumeMA20
        ? volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20
        : 1;
      const overheating = advancedIndicators.checkOverheating(
        chartData,
        currentData.currentPrice,
        volumeRatio,
        volumeAnalysis.indicators.mfi
      );

      // 과열 페널티 적용
      totalScore += overheating.scorePenalty;
      totalScore = Math.min(Math.max(totalScore, 0), 100);

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
        overheating, // Phase 4C 과열 정보 추가
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
   * 종합 점수 계산 (개선된 배점)
   */
  calculateTotalScore(volumeAnalysis, advancedAnalysis) {
    let score = 0;

    // 1. 창의적 지표 점수 (0-40점) - 가중치 40%로 감소
    score += advancedAnalysis.totalScore * 0.4;

    // 2. 거래량 지표 (0-30점)
    if (volumeAnalysis.current.volumeMA20) {
      const volumeRatio = volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20;
      if (volumeRatio >= 5) score += 30;      // 5배 이상 초대량
      else if (volumeRatio >= 3) score += 20; // 3배 이상 대량
      else if (volumeRatio >= 2) score += 12; // 2배 이상 급증
      else if (volumeRatio >= 1.5) score += 5; // 1.5배 이상 증가
    }

    // 3. MFI (자금흐름지수) (0-15점)
    const mfi = volumeAnalysis.indicators.mfi;
    if (mfi <= 20) score += 15;      // 극과매도 -> 최대 기회
    else if (mfi <= 30) score += 10; // 과매도 -> 매수 기회
    else if (mfi >= 80) score += 8;  // 강한 상승세 인정
    else if (mfi >= 70) score += 5;  // 상승세

    // 4. OBV 추세 (0-10점)
    const obvTrend = volumeAnalysis.signals.obvTrend;
    if (obvTrend && obvTrend.includes('상승')) score += 10;
    else if (obvTrend && obvTrend.includes('횡보')) score += 5;

    // 5. 가격 모멘텀 (0-5점)
    if (volumeAnalysis.signals.priceVsVWAP === '상승세') score += 5;

    return Math.min(Math.max(score, 0), 100); // 0-100 범위 제한
  }

  /**
   * 추천 등급 산출 (Phase 4 티어 시스템 반영)
   */
  getRecommendation(score, tier, overheating) {
    let grade, text, color;

    // 기본 등급 산정
    if (score >= 70) {
      grade = 'S';
      text = '🔥 최우선 매수';
      color = '#ff4444';
    } else if (score >= 55) {
      grade = 'A';
      text = '🟢 적극 매수';
      color = '#00cc00';
    } else if (score >= 40) {
      grade = 'B';
      text = '🟡 매수 고려';
      color = '#ffaa00';
    } else if (score >= 30) {
      grade = 'C';
      text = '⚪ 주목';
      color = '#888888';
    } else {
      grade = 'D';
      text = '⚫ 관망';
      color = '#cccccc';
    }

    // Phase 4 티어 수정
    if (tier === 'watch') {
      text = '👁️ 관심종목 (선행지표)';
      color = '#9966ff'; // 보라색
    } else if (tier === 'buy' && score >= 60) {
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

    return { grade, text, color, tier, overheating: overheating.message };
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
   * 거래량 급증 40 + 거래량 30 + 거래대금 20 + 조용한누적 10 = 100개
   */
  async screenAllStocks(market = 'ALL', limit) {
    console.log(`🔍 종합 TOP 스크리닝 시작 (100개 풀${limit ? `, 상위 ${limit}개 반환` : ', 전체 반환'})...\n`);

    // 1단계: 거래량 기반 90개 확보
    const { codes: volumeBasedStocks } = await kisApi.getAllStockList(market);
    console.log(`✅ 1단계 완료: 거래량 기반 ${volumeBasedStocks.length}개 확보\n`);

    // 2단계: 조용한 누적 패턴 10개 추가
    console.log('🐌 2단계: 조용한 누적 패턴 종목 추가 중...');
    const gradualStocks = await this.findGradualAccumulationStocks(market, 10);

    // 3단계: 100개 풀 생성 (중복 제거)
    const stockSet = new Set([...volumeBasedStocks, ...gradualStocks]);
    const finalStockList = Array.from(stockSet);

    console.log(`\n✅ 최종 풀: ${finalStockList.length}개 종목 (목표 100개)`);
    console.log(`  - 거래량 기반: ${volumeBasedStocks.length}개`);
    console.log(`  - 조용한 누적: ${gradualStocks.length}개`);
    console.log(`\n📊 전체 종목 분석 시작...\n`);

    const results = [];
    let analyzed = 0;

    // 전체 100개 분석
    for (const stockCode of finalStockList) {
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
    console.log(`  - 발견: ${results.length}개 (30점 이상)`);
    console.log(`  - 최종: ${limit ? `상위 ${limit}개` : `전체 ${results.length}개`} 반환\n`);

    return limit ? results.slice(0, limit) : results;
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

    // 카테고리별 필터 함수 (Phase 4 추가)
    const categoryFilters = {
      'whale': (analysis) => analysis.advancedAnalysis.indicators.whale.length > 0,
      'accumulation': (analysis) => analysis.advancedAnalysis.indicators.accumulation.detected,
      'escape': (analysis) => analysis.advancedAnalysis.indicators.escape.detected,
      'drain': (analysis) => analysis.advancedAnalysis.indicators.drain.detected,
      'volume-surge': (analysis) =>
        analysis.volumeAnalysis.current.volumeMA20 &&
        analysis.volumeAnalysis.current.volume / analysis.volumeAnalysis.current.volumeMA20 >= 2.5,
      // Phase 4 신규 카테고리
      'gradual-accumulation': (analysis) => analysis.advancedAnalysis.indicators.gradualAccumulation.detected,
      'smart-money': (analysis) => analysis.advancedAnalysis.indicators.smartMoney.detected,
      'bottom-formation': (analysis) => analysis.advancedAnalysis.indicators.bottomFormation.detected,
      'breakout-prep': (analysis) => analysis.advancedAnalysis.indicators.breakoutPrep.detected
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
