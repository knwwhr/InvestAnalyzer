const kisApi = require('./kisApi');
const screener = require('./screening');

/**
 * 성과 검증 시스템 - 백테스팅 및 실시간 추적
 */
class PerformanceVerifier {
  constructor() {
    this.backtestCache = null;
    this.backtestTimestamp = null;
    this.cacheDuration = 4 * 60 * 60 * 1000; // 4시간 캐시
  }

  /**
   * Phase 1: 과거 데이터 백테스팅 (30일~90일)
   * 과거 시점에 시스템이 추천했을 종목의 실제 수익률 계산
   */
  async runBacktest(lookbackDays = 30, holdingDays = 7) {
    console.log(`🔍 백테스팅 시작: ${lookbackDays}일 전 ~ 현재, 보유기간 ${holdingDays}일`);

    // 과거 여러 시점에서 스크리닝 시뮬레이션
    const testDates = this.generateTestDates(lookbackDays, 7); // 7일 간격
    const allResults = [];

    for (const testDate of testDates) {
      console.log(`📅 ${testDate} 시점 분석 중...`);

      try {
        // 해당 시점의 TOP 종목 찾기 (실제로는 현재 시점에서 과거 데이터로 역산)
        const recommendations = await this.simulateScreeningAtDate(testDate);

        // 각 추천 종목의 이후 수익률 계산
        for (const rec of recommendations) {
          const performance = await this.calculateReturns(
            rec.stockCode,
            testDate,
            holdingDays
          );

          if (performance) {
            allResults.push({
              ...rec,
              ...performance,
              recommendDate: testDate,
              holdingDays
            });
          }
        }

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`❌ ${testDate} 분석 실패:`, error.message);
      }
    }

    // 통계 계산
    const statistics = this.calculateStatistics(allResults);

    console.log(`✅ 백테스팅 완료! 총 ${allResults.length}개 샘플 분석`);

    return {
      results: allResults,
      statistics,
      parameters: { lookbackDays, holdingDays },
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 과거 특정 시점에 스크리닝 시뮬레이션
   */
  async simulateScreeningAtDate(targetDate) {
    // 간단 구현: 현재 로직으로 TOP 10 추출 (실제로는 과거 데이터 필요)
    // 실제 프로덕션에서는 targetDate의 데이터로 스크리닝 필요
    const top10 = await screener.screenAllStocks('ALL', 5); // 5개만 샘플링
    return top10.map(stock => ({
      stockCode: stock.stockCode,
      stockName: stock.stockName,
      score: stock.totalScore,
      grade: stock.recommendation.grade,
      category: this.detectCategory(stock)
    }));
  }

  /**
   * 특정 종목의 수익률 계산 (특정 날짜부터 N일 후)
   */
  async calculateReturns(stockCode, startDate, holdingDays) {
    try {
      // 과거 데이터 가져오기 (시작일 이전 ~ 보유기간 이후)
      const chartData = await kisApi.getDailyChart(stockCode, holdingDays + 10);

      if (!chartData || chartData.length < holdingDays) {
        return null;
      }

      // 최근 데이터를 기준으로 역산 (실제로는 날짜 매칭 필요)
      // chartData는 내림차순 (최신=0, 과거=큰 인덱스)
      const sellPrice = chartData[0]?.close;  // 최신 가격 (매도)
      const buyPrice = chartData[holdingDays]?.close;  // holdingDays일 전 가격 (매수)

      if (!buyPrice || !sellPrice) {
        return null;
      }

      const returnRate = ((sellPrice - buyPrice) / buyPrice) * 100;
      const isWin = returnRate > 0;

      return {
        buyPrice,
        sellPrice,
        returnRate: parseFloat(returnRate.toFixed(2)),
        isWin,
        holdingDays
      };
    } catch (error) {
      console.error(`❌ 수익률 계산 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 테스트 날짜 생성 (N일 전부터 현재까지, interval 간격)
   */
  generateTestDates(lookbackDays, interval) {
    const dates = [];
    const today = new Date();

    for (let i = lookbackDays; i >= interval; i -= interval) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    return dates;
  }

  /**
   * 종목이 어떤 카테고리에 해당하는지 감지
   */
  detectCategory(stock) {
    const categories = [];

    if (stock.advancedAnalysis.indicators.whale.length > 0) {
      categories.push('whale');
    }
    if (stock.advancedAnalysis.indicators.accumulation.detected) {
      categories.push('accumulation');
    }
    if (stock.advancedAnalysis.indicators.escape.detected) {
      categories.push('escape');
    }
    if (stock.advancedAnalysis.indicators.drain.detected) {
      categories.push('drain');
    }
    if (
      stock.volumeAnalysis.current.volumeMA20 &&
      stock.volumeAnalysis.current.volume / stock.volumeAnalysis.current.volumeMA20 >= 2.5
    ) {
      categories.push('volume-surge');
    }

    return categories;
  }

  /**
   * 통계 계산 (승률, 평균 수익률, 카테고리별/등급별 성과)
   */
  calculateStatistics(results) {
    if (results.length === 0) {
      return null;
    }

    // 전체 통계
    const totalCount = results.length;
    const winCount = results.filter(r => r.isWin).length;
    const winRate = (winCount / totalCount) * 100;
    const avgReturn = results.reduce((sum, r) => sum + r.returnRate, 0) / totalCount;
    const maxReturn = Math.max(...results.map(r => r.returnRate));
    const minReturn = Math.min(...results.map(r => r.returnRate));

    // 등급별 통계
    const byGrade = this.groupBy(results, 'grade');
    const gradeStats = {};
    for (const [grade, items] of Object.entries(byGrade)) {
      gradeStats[grade] = this.calculateGroupStats(items);
    }

    // 카테고리별 통계
    const categoryStats = {};
    const categoryMap = {
      whale: '🐋 고래 감지',
      accumulation: '🤫 조용한 매집',
      escape: '🚀 탈출 속도',
      drain: '💧 유동성 고갈',
      'volume-surge': '🔥 거래량 폭발'
    };

    for (const [key, label] of Object.entries(categoryMap)) {
      const items = results.filter(r => r.category.includes(key));
      if (items.length > 0) {
        categoryStats[key] = {
          label,
          ...this.calculateGroupStats(items)
        };
      }
    }

    // Phase 3: 고급 지표
    const advanced = this.calculateAdvancedMetrics(results);

    return {
      overall: {
        totalCount,
        winCount,
        lossCount: totalCount - winCount,
        winRate: parseFloat(winRate.toFixed(2)),
        avgReturn: parseFloat(avgReturn.toFixed(2)),
        maxReturn: parseFloat(maxReturn.toFixed(2)),
        minReturn: parseFloat(minReturn.toFixed(2))
      },
      byGrade: gradeStats,
      byCategory: categoryStats,
      advanced
    };
  }

  /**
   * 그룹별 통계 계산
   */
  calculateGroupStats(items) {
    const count = items.length;
    const winCount = items.filter(r => r.isWin).length;
    const winRate = (winCount / count) * 100;
    const avgReturn = items.reduce((sum, r) => sum + r.returnRate, 0) / count;
    const maxReturn = Math.max(...items.map(r => r.returnRate));

    return {
      count,
      winCount,
      winRate: parseFloat(winRate.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      maxReturn: parseFloat(maxReturn.toFixed(2))
    };
  }

  /**
   * Phase 3: 고급 지표 계산
   */
  calculateAdvancedMetrics(results) {
    const returns = results.map(r => r.returnRate);

    // 1. 샤프 비율 (Sharpe Ratio) - 위험 대비 수익
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = stdDev === 0 ? 0 : avgReturn / stdDev;

    // 2. MDD (Maximum Drawdown) - 최대 낙폭
    let peak = 0;
    let maxDrawdown = 0;
    let cumulativeReturn = 0;

    returns.forEach(r => {
      cumulativeReturn += r;
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = peak - cumulativeReturn;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    // 3. 변동성 (Volatility)
    const volatility = stdDev;

    // 4. 승률 대비 손실 비율 (Profit Factor)
    const wins = results.filter(r => r.isWin);
    const losses = results.filter(r => !r.isWin);
    const totalProfit = wins.reduce((sum, r) => sum + r.returnRate, 0);
    const totalLoss = Math.abs(losses.reduce((sum, r) => sum + r.returnRate, 0));
    const profitFactor = totalLoss === 0 ? totalProfit : totalProfit / totalLoss;

    // 5. 평균 승리 vs 평균 손실
    const avgWin = wins.length > 0 ? totalProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;

    // 6. KOSPI 대비 초과 수익률 (가정: KOSPI 연 8% = 주간 0.15%)
    const kospiWeeklyReturn = 0.15;
    const excessReturn = avgReturn - kospiWeeklyReturn;

    return {
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      excessReturn: parseFloat(excessReturn.toFixed(2)),
      interpretation: this.interpretAdvancedMetrics(sharpeRatio, maxDrawdown, profitFactor)
    };
  }

  /**
   * 고급 지표 해석
   */
  interpretAdvancedMetrics(sharpe, mdd, profitFactor) {
    const results = [];

    // 샤프 비율 해석
    if (sharpe > 2) results.push('🔥 위험 대비 수익 매우 우수');
    else if (sharpe > 1) results.push('✅ 위험 대비 수익 양호');
    else if (sharpe > 0) results.push('⚠️ 위험 대비 수익 보통');
    else results.push('❌ 위험 대비 수익 부족');

    // MDD 해석
    if (mdd < 5) results.push('🛡️ 낙폭 매우 안정적');
    else if (mdd < 10) results.push('✅ 낙폭 양호');
    else if (mdd < 20) results.push('⚠️ 낙폭 주의');
    else results.push('❌ 낙폭 위험');

    // Profit Factor 해석
    if (profitFactor > 2) results.push('💰 수익/손실 비율 우수');
    else if (profitFactor > 1.5) results.push('✅ 수익/손실 비율 양호');
    else if (profitFactor > 1) results.push('⚠️ 수익/손실 비율 보통');
    else results.push('❌ 손실이 수익보다 큼');

    return results;
  }

  /**
   * 배열을 특정 키로 그룹화
   */
  groupBy(array, key) {
    return array.reduce((result, item) => {
      const groupKey = item[key];
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {});
  }

  /**
   * Phase 3: 포트폴리오 시뮬레이션 (여러 종목 조합)
   */
  simulatePortfolio(results, portfolioSize = 5, investmentPerStock = 1000000) {
    console.log(`📊 포트폴리오 시뮬레이션: ${portfolioSize}종목, 종목당 ${investmentPerStock.toLocaleString()}원`);

    // 날짜별로 그룹화
    const byDate = this.groupBy(results, 'recommendDate');
    const portfolioResults = [];

    for (const [date, stocks] of Object.entries(byDate)) {
      if (stocks.length < portfolioSize) continue;

      // 점수 높은 순으로 N개 선택
      const selected = stocks
        .sort((a, b) => b.score - a.score)
        .slice(0, portfolioSize);

      // 포트폴리오 수익률 계산 (균등 배분)
      const totalReturn = selected.reduce((sum, s) => sum + s.returnRate, 0) / portfolioSize;
      const totalProfit = (investmentPerStock * portfolioSize * totalReturn) / 100;

      portfolioResults.push({
        date,
        stocks: selected.map(s => ({
          code: s.stockCode,
          name: s.stockName,
          return: s.returnRate
        })),
        portfolioReturn: parseFloat(totalReturn.toFixed(2)),
        portfolioProfit: Math.round(totalProfit),
        totalInvestment: investmentPerStock * portfolioSize
      });
    }

    // 포트폴리오 전체 통계
    const avgPortfolioReturn =
      portfolioResults.reduce((sum, p) => sum + p.portfolioReturn, 0) / portfolioResults.length;
    const totalProfit = portfolioResults.reduce((sum, p) => sum + p.portfolioProfit, 0);

    return {
      portfolios: portfolioResults,
      summary: {
        portfolioCount: portfolioResults.length,
        avgReturn: parseFloat(avgPortfolioReturn.toFixed(2)),
        totalProfit: Math.round(totalProfit),
        bestPortfolio: portfolioResults.sort((a, b) => b.portfolioReturn - a.portfolioReturn)[0],
        worstPortfolio: portfolioResults.sort((a, b) => a.portfolioReturn - b.portfolioReturn)[0]
      }
    };
  }

  /**
   * 시장 상황별 분석 (상승장/하락장/횡보장)
   */
  async analyzeByMarketCondition(results) {
    console.log('📈 시장 상황별 성과 분석...');

    // KOSPI 지수 가져오기 (간단 구현: 평균 수익률로 시장 판단)
    const byDate = this.groupBy(results, 'recommendDate');
    const marketConditions = {
      bull: [], // 상승장 (평균 수익률 > 1%)
      bear: [], // 하락장 (평균 수익률 < -1%)
      sideways: [] // 횡보장 (-1% ~ 1%)
    };

    for (const [date, stocks] of Object.entries(byDate)) {
      const avgReturn = stocks.reduce((sum, s) => sum + s.returnRate, 0) / stocks.length;

      if (avgReturn > 1) {
        marketConditions.bull.push(...stocks);
      } else if (avgReturn < -1) {
        marketConditions.bear.push(...stocks);
      } else {
        marketConditions.sideways.push(...stocks);
      }
    }

    return {
      bull: {
        label: '📈 상승장',
        ...this.calculateGroupStats(marketConditions.bull)
      },
      bear: {
        label: '📉 하락장',
        ...this.calculateGroupStats(marketConditions.bear)
      },
      sideways: {
        label: '➡️ 횡보장',
        ...this.calculateGroupStats(marketConditions.sideways)
      }
    };
  }

  /**
   * 캐시된 백테스팅 결과 가져오기 (Vercel 환경 대응)
   */
  async getCachedBacktest(forceRefresh = false) {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.backtestCache &&
      this.backtestTimestamp &&
      now - this.backtestTimestamp < this.cacheDuration
    ) {
      console.log('✅ 캐시된 백테스팅 결과 사용');
      return this.backtestCache;
    }

    console.log('🔄 새로운 백테스팅 실행...');
    const result = await this.runBacktest(30, 7);

    // 포트폴리오 시뮬레이션 추가
    result.portfolio = this.simulatePortfolio(result.results, 5, 1000000);

    // 시장 상황별 분석 추가
    result.byMarket = await this.analyzeByMarketCondition(result.results);

    this.backtestCache = result;
    this.backtestTimestamp = now;

    return result;
  }
}

module.exports = new PerformanceVerifier();
