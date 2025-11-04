const kisApi = require('./kisApi');
const volumeIndicators = require('./volumeIndicators');
const advancedIndicators = require('./advancedIndicators');
const smartPatternMiner = require('./smartPatternMining');
const trendScoring = require('./trendScoring');

/**
 * 전체 종목 스크리닝 및 추천
 */
class StockScreener {
  constructor() {
    this.cachedResults = null;
    this.cacheTimestamp = null;
    this.cacheDuration = 60 * 60 * 1000; // 1시간 캐시
    this.savedPatterns = smartPatternMiner.loadSavedPatterns(); // 저장된 패턴 로드
  }

  /**
   * 추세 분석 (최근 5일 일자별)
   */
  calculateTrendAnalysis(chartData) {
    if (!chartData || chartData.length < 6) {
      return null;
    }

    // 최근 5일 + 기준일(6일전) 필요
    const dailyData = [];

    for (let i = 0; i < 5; i++) {
      const today = chartData[i];
      const yesterday = chartData[i + 1];

      if (!today || !yesterday) continue;

      // 전일 대비 주가 변동률
      const priceChange = ((today.close - yesterday.close) / yesterday.close) * 100;

      // 전일 대비 거래량 증가율
      const volumeChange = ((today.volume - yesterday.volume) / yesterday.volume) * 100;

      // 해당 기간(1일~5일)의 누적 변동률
      const periodStart = chartData[i];
      const periodEnd = chartData[Math.min(i + (i + 1), chartData.length - 1)]; // i일 전부터 현재까지
      const periodPriceChange = periodEnd ? ((periodStart.close - periodEnd.close) / periodEnd.close) * 100 : 0;
      const periodVolumeChange = periodEnd ? ((periodStart.volume - periodEnd.volume) / periodEnd.volume) * 100 : 0;

      dailyData.push({
        dayIndex: i + 1, // 1일전 = 오늘, 2일전 = 어제, ...
        date: today.date,
        close: today.close,
        volume: today.volume,
        priceChange: parseFloat(priceChange.toFixed(2)),
        volumeChange: parseFloat(volumeChange.toFixed(2)),
        periodPriceChange: parseFloat(periodPriceChange.toFixed(2)),
        periodVolumeChange: parseFloat(periodVolumeChange.toFixed(2))
      });
    }

    return {
      dailyData: dailyData, // 최근 5일 (0=오늘, 1=어제, 2=그저께, ...)
      summary: {
        totalPriceChange: dailyData.length > 0 ? dailyData[dailyData.length - 1].periodPriceChange : 0,
        totalVolumeChange: dailyData.length > 0 ? dailyData[dailyData.length - 1].periodVolumeChange : 0,
        avgDailyPriceChange: dailyData.length > 0 ?
          (dailyData.reduce((sum, d) => sum + d.priceChange, 0) / dailyData.length).toFixed(2) : 0,
        avgDailyVolumeChange: dailyData.length > 0 ?
          (dailyData.reduce((sum, d) => sum + d.volumeChange, 0) / dailyData.length).toFixed(2) : 0
      }
    };
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

      // getCurrentPrice가 null 반환하면 스킵
      if (!currentData) {
        return null;
      }

      // 거래량 지표 분석
      const volumeAnalysis = volumeIndicators.analyzeVolume(chartData);

      // 창의적 지표 분석 (Phase 4 신규 지표 포함)
      const advancedAnalysis = advancedIndicators.analyzeAdvanced(chartData);

      // 추세 분석 (5일/10일/20일)
      const trendAnalysis = this.calculateTrendAnalysis(chartData);

      // 트렌드 점수 조회 (Google Trends + 뉴스 + AI 감성)
      const trendScore = await trendScoring.getStockTrendScore(stockCode);

      // 종합 점수 계산 (기술적 지표 + 트렌드 점수)
      let totalScore = this.calculateTotalScore(volumeAnalysis, advancedAnalysis, trendScore);

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

      // 패턴 매칭 보너스 (최대 +20점)
      const patternMatch = smartPatternMiner.checkPatternMatch(
        { volumeAnalysis, advancedAnalysis },
        this.savedPatterns
      );
      totalScore += patternMatch.bonusScore;

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
        trendAnalysis, // 추세 분석 추가
        trendScore: trendScore ? { // 트렌드 점수 추가
          total: trendScore.total_trend_score,
          search: trendScore.search_score,
          news: trendScore.news_score,
          sentiment: trendScore.sentiment_score,
          isHotIssue: trendScore.is_hot_issue,
          searchSurge: trendScore.search_surge
        } : null,
        overheating, // Phase 4C 과열 정보 추가
        patternMatch, // 패턴 매칭 정보 추가
        totalScore,
        recommendation: this.getRecommendation(totalScore, advancedAnalysis.tier, overheating, trendScore),
        rankBadges: rankBadges || {}
      };
    } catch (error) {
      console.error(`❌ 종목 분석 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 종합 점수 계산 (개선된 배점 + 트렌드 점수 통합)
   * 기술적 지표 70% + 트렌드 점수 30%
   */
  calculateTotalScore(volumeAnalysis, advancedAnalysis, trendScore = null) {
    let technicalScore = 0;

    // 1. 창의적 지표 점수 (0-40점) - 가중치 40%로 감소
    technicalScore += advancedAnalysis.totalScore * 0.4;

    // 2. 거래량 지표 (0-30점)
    if (volumeAnalysis.current.volumeMA20) {
      const volumeRatio = volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20;
      if (volumeRatio >= 5) technicalScore += 30;      // 5배 이상 초대량
      else if (volumeRatio >= 3) technicalScore += 20; // 3배 이상 대량
      else if (volumeRatio >= 2) technicalScore += 12; // 2배 이상 급증
      else if (volumeRatio >= 1.5) technicalScore += 5; // 1.5배 이상 증가
    }

    // 3. MFI (자금흐름지수) (0-15점)
    const mfi = volumeAnalysis.indicators.mfi;
    if (mfi <= 20) technicalScore += 15;      // 극과매도 -> 최대 기회
    else if (mfi <= 30) technicalScore += 10; // 과매도 -> 매수 기회
    else if (mfi >= 80) technicalScore += 8;  // 강한 상승세 인정
    else if (mfi >= 70) technicalScore += 5;  // 상승세

    // 4. OBV 추세 (0-10점)
    const obvTrend = volumeAnalysis.signals.obvTrend;
    if (obvTrend && obvTrend.includes('상승')) technicalScore += 10;
    else if (obvTrend && obvTrend.includes('횡보')) technicalScore += 5;

    // 5. 가격 모멘텀 (0-5점)
    if (volumeAnalysis.signals.priceVsVWAP === '상승세') technicalScore += 5;

    technicalScore = Math.min(Math.max(technicalScore, 0), 100);

    // 6. 트렌드 점수 통합 (70% 기술 + 30% 트렌드)
    if (trendScore && trendScore.total_trend_score !== undefined) {
      const finalScore = (technicalScore * 0.7) + (trendScore.total_trend_score * 0.3);
      return Math.min(Math.max(finalScore, 0), 100);
    }

    // 트렌드 점수 없으면 기술적 점수만 반환
    return technicalScore;
  }

  /**
   * 추천 등급 산출 (Phase 4 티어 시스템 + 트렌드 점수 반영)
   */
  getRecommendation(score, tier, overheating, trendScore = null) {
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

    // HOT 이슈 배지 추가 (트렌드 점수 70점 이상)
    if (trendScore && trendScore.total_trend_score >= 70) {
      text = `🔥 HOT 이슈 - ${text}`;
      grade = grade === 'S' ? 'S+' : grade; // S등급은 S+로 업그레이드
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

        // skipScoreFilter가 true면 점수 무시, false면 30점 이상만
        if (analysis && (skipScoreFilter || analysis.totalScore >= 30)) {
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
    console.log(`  - 발견: ${results.length}개 (30점 이상)`);
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
