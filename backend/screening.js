const kisApi = require('./kisApi');
const volumeIndicators = require('./volumeIndicators');
const advancedIndicators = require('./advancedIndicators');
const smartPatternMiner = require('./smartPatternMining');
const trendScoring = require('./trendScoring');
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

      // VPM 통합 지표: 거래량 예측 + VPT + Divergence → 가격 방향 예측
      const vpm = advancedIndicators.calculateVPM(
        chartData,
        currentData.currentPrice,
        currentData.volume,
        institutionalFlow
      );

      // 차트 패턴 인식
      const cupAndHandle = advancedIndicators.detectCupAndHandle(chartData);
      const triangle = advancedIndicators.detectTriangle(chartData);

      // 추세 분석 (5일/10일/20일) - 현재가 정보 포함
      const trendAnalysis = this.calculateTrendAnalysis(chartData, currentData);

      // 트렌드 점수 조회 (Google Trends + 뉴스 + AI 감성)
      const trendScore = await trendScoring.getStockTrendScore(stockCode);

      // 종합 점수 계산 (기술적 지표 + 트렌드 점수 + 고점 되돌림 페널티)
      let totalScore = this.calculateTotalScore(volumeAnalysis, advancedAnalysis, trendScore, chartData, currentData.currentPrice);

      // ========================================
      // 점수 계산: 100점 만점 (스케일링 제거)
      // ========================================

      // 1. 신규 지표 점수 추가 (선행 지표 중심 강화, 총 80점)
      // VPM (0-25점) - 가장 중요한 선행 지표
      const vpmScore = Math.max(0, Math.min((vpm.score || 0) * 0.7, 25));
      totalScore += vpmScore;

      totalScore += (institutionalFlow.score || 0); // 0-15점
      totalScore += Math.min((confluence.confluenceScore || 0) * 0.6, 12); // 0-12점
      totalScore += Math.min((freshness.freshnessScore || 0) * 0.53, 8); // 0-8점
      totalScore += Math.min((cupAndHandle.score || 0) * 0.25, 5); // 0-5점
      totalScore += Math.min((breakoutConfirmation.score || 0) * 0.2, 3); // 0-3점
      totalScore += Math.min((triangle.score || 0) * 0.13, 2); // 0-2점

      // anomaly 제거 (이미 급등 중 신호)
      // riskAdjusted 제거 (선행성 낮음)

      // 2. 페널티 전면 제거 (순수 가점 시스템)
      // - 유동성 페널티 제거 (NaN 오류 + 급등주 발굴에 역효과)
      // - 과열/작전주/과거급등 페널티 제거 (사용자 요청)

      // Phase 4C: 과열 감지 (정보용으로만 유지, 페널티 제거)
      const volumeRatio = volumeAnalysis.current.volumeMA20
        ? volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20
        : 1;
      const overheating = advancedIndicators.checkOverheating(
        chartData,
        currentData.currentPrice,
        volumeRatio,
        volumeAnalysis.indicators.mfi
      );

      // 3. 선행 지표 통합 (패턴+DNA, 0-80점 → 0-10점 스케일링)
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

          // 0-80점을 0-10점으로 스케일링 (임시 - Phase 4에서 전체 재설계)
          const fullScore = leadingIndicators.convertToScreeningScore(leadingScore);
          leadingPoints = Math.min(fullScore * 0.125, 10); // 80 * 0.125 = 10
        } catch (error) {
          console.error('선행 지표 분석 실패:', error.message);
          leadingPoints = 0;
        }
      } else {
        // Fallback: 기존 패턴 매칭 사용
        const patternMatch = smartPatternMiner.checkPatternMatch(
          { volumeAnalysis, advancedAnalysis },
          this.savedPatterns
        );
        leadingPoints = Math.min((patternMatch.bonusScore || 0) * 0.5, 10);
      }

      totalScore += leadingPoints;

      // 4. 트렌드 점수 (0-15점)
      let trendBonus = 0;
      if (trendScore && trendScore.total_trend_score >= 70) {
        trendBonus = Math.min((trendScore.total_trend_score - 70) / 2, 15);
        // 트렌드 점수 70점: +0, 100점: +15
      }
      totalScore += trendBonus;

      // 5. 최종 점수 (0-100점 범위, NaN 방지)
      totalScore = isNaN(totalScore) ? 0 : Math.min(Math.max(totalScore, 0), 100);

      // ========================================
      // 가점/감점 상세 내역 (스코어 카드)
      // ========================================
      const scoreBreakdown = {
        // 기본 점수 (0-20점: 거래량 + OBV + VWAP + 비대칭 - 되돌림)
        baseScore: Math.round(this.calculateTotalScore(volumeAnalysis, advancedAnalysis, trendScore, chartData, currentData.currentPrice)),

        // 가점 요인 (선행 지표 중심, 총 95점)
        bonuses: [
          { name: "VPM (거래량-가격 모멘텀)", value: Math.round(vpmScore), active: vpm.score > 0 },
          { name: "기관/외국인 수급", value: Math.round(institutionalFlow.score || 0), active: institutionalFlow.detected },
          { name: "트렌드 (뉴스+감성)", value: Math.round(trendBonus), active: trendBonus > 0 },
          { name: "합류점 (Confluence)", value: Math.round(Math.min((confluence.confluenceScore || 0) * 0.6, 12)), active: confluence.confluenceCount >= 2 },
          {
            name: leadingScore ? "선행 지표 (패턴+DNA)" : "패턴 매칭 (Fallback)",
            value: Math.round(leadingPoints),
            active: leadingPoints > 0,
            details: leadingScore ? {
              strength: leadingScore.strength,
              patternMatched: leadingScore.pattern.matched,
              dnaMatched: leadingScore.dna.matched,
              confidence: Math.round(leadingScore.confidence)
            } : null
          }, // ⭐ 선행 지표 통합 (NEW)
          { name: "신호 신선도", value: Math.round(Math.min((freshness.freshnessScore || 0) * 0.53, 8)), active: freshness.freshCount >= 2 },
          { name: "Cup&Handle 패턴", value: Math.round(Math.min((cupAndHandle.score || 0) * 0.25, 5)), active: cupAndHandle.detected },
          { name: "돌파 확인", value: Math.round(Math.min((breakoutConfirmation.score || 0) * 0.2, 3)), active: breakoutConfirmation.detected },
          { name: "Triangle 패턴", value: Math.round(Math.min((triangle.score || 0) * 0.13, 2)), active: triangle.detected }
        ].filter(b => b.active),

        // 감점 요인 (전면 제거 - 순수 가점 시스템)
        penalties: [],

        // 최종 점수
        finalScore: Math.round(totalScore)
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
        vpm, // 신규: VPM 통합 지표 (거래량 예측 + 가격 방향)
        cupAndHandle, // 신규: Cup&Handle 패턴
        triangle, // 신규: Triangle 패턴
        scoreBreakdown, // 신규: 가점/감점 상세 내역
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
        recommendation: this.getRecommendation(totalScore, advancedAnalysis.tier, overheating, trendScore),
        rankBadges: rankBadges || {}
      };
    } catch (error) {
      console.error(`❌ 종목 분석 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 기본 점수 계산 (선행 지표 중심 단순화 + 비대칭 비율 추가)
   * 급등 '예정' 종목 발굴에 최적화
   */
  calculateTotalScore(volumeAnalysis, advancedAnalysis, trendScore = null, chartData = null, currentPrice = null) {
    let baseScore = 0;

    // 1. 거래량 비율 (0-8점) - 가중치 감소
    if (volumeAnalysis.current.volumeMA20) {
      const volumeRatio = volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20;
      if (volumeRatio >= 5) baseScore += 8;       // 5배 이상 초대량
      else if (volumeRatio >= 3) baseScore += 5;  // 3배 이상 대량
      else if (volumeRatio >= 2) baseScore += 3;  // 2배 이상 급증
      else if (volumeRatio >= 1.5) baseScore += 1; // 1.5배 이상 증가
    }

    // 2. OBV 추세 (0-7점) - 자금 흐름 가중치 증가
    const obvTrend = volumeAnalysis.signals.obvTrend;
    if (obvTrend && obvTrend.includes('상승')) baseScore += 7;
    else if (obvTrend && obvTrend.includes('횡보')) baseScore += 3;

    // 3. VWAP 모멘텀 (0-5점) - 가중치 증가
    if (volumeAnalysis.signals.priceVsVWAP === '상승세') baseScore += 5;

    // 4. 비대칭 비율 (0-5점) - 신규 추가
    const asymmetric = advancedAnalysis?.indicators?.asymmetric;
    if (asymmetric && asymmetric.score) {
      baseScore += Math.min(asymmetric.score / 10, 5); // 최대 5점
    }

    // 5. 고점 대비 되돌림 페널티 (-5~0점)
    if (chartData && currentPrice) {
      const recentHigh = Math.max(...chartData.slice(0, 30).map(d => d.high));
      const drawdownPercent = ((recentHigh - currentPrice) / recentHigh) * 100;

      if (drawdownPercent >= 20) baseScore -= 5;      // 20% 이상 되돌림: -5점
      else if (drawdownPercent >= 15) baseScore -= 3; // 15% 이상 되돌림: -3점
      else if (drawdownPercent >= 10) baseScore -= 2; // 10% 이상 되돌림: -2점
    }

    // MFI 제거 (급등 예정 신호 아님 - 현재 상태 지표)
    // 창의적 지표 제거 (선행/후행 혼재)

    return Math.min(Math.max(baseScore, 0), 20);
  }

  /**
   * 추천 등급 산출 (100점 만점 기준, 선행 지표 중심)
   * 트렌드(0-15점) 통합으로 100점 만점
   */
  getRecommendation(score, tier, overheating, trendScore = null) {
    let grade, text, color;

    // 기본 등급 산정 (100점 만점)
    if (score >= 75) {
      grade = 'S';
      text = '🔥 최우선 매수';
      color = '#ff4444';
    } else if (score >= 58) {
      grade = 'A';
      text = '🟢 적극 매수';
      color = '#00cc00';
    } else if (score >= 42) {
      grade = 'B';
      text = '🟡 매수 고려';
      color = '#ffaa00';
    } else if (score >= 25) {
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
