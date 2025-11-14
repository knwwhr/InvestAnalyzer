/**
 * 단기 백테스트 API (30일 데이터 기반)
 *
 * 현실적 제약:
 * - KIS API는 최근 30일 데이터만 제공
 * - "과거 특정 시점"의 스크리닝은 불가능
 *
 * 대안:
 * - 현재 추천 종목들을 대상으로
 * - "N일 전에 매수했다면?" 시뮬레이션
 * - 5일, 10일, 15일, 20일 전 매수 → 현재 수익률
 */

const screener = require('../../backend/screening');
const kisApi = require('../../backend/kisApi');

module.exports = async (req, res) => {
  console.log('\n🔍 단기 백테스트 시작 (30일 데이터 기반)');

  try {
    const { holdingDays = 5 } = req.query; // 보유 기간 (기본 5일)
    const holdingPeriod = parseInt(holdingDays);

    // 검증
    if (holdingPeriod < 1 || holdingPeriod > 25) {
      return res.status(400).json({
        success: false,
        error: '보유 기간은 1~25일 사이여야 합니다 (30일 데이터 제약)'
      });
    }

    // Step 1: 현재 추천 종목 가져오기
    console.log('📊 현재 추천 종목 스크리닝 중...');
    const { stocks } = await screener.screenAllStocks('ALL');

    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: '추천 종목이 없습니다'
      });
    }

    console.log(`  ✅ ${stocks.length}개 종목 분석 대상`);

    // Step 2: 각 종목의 과거 수익률 계산
    const results = [];
    const testPoints = [5, 10, 15, 20, 25]; // 테스트할 과거 시점들

    for (const stock of stocks) {
      try {
        // 차트 데이터는 이미 있지만, 최신 30일 데이터 다시 가져오기
        const chartData = await kisApi.getDailyChart(stock.stockCode, 30);

        if (!chartData || chartData.length < 25) {
          console.log(`  ⚠️  [${stock.stockName}] 데이터 부족 (${chartData?.length || 0}일)`);
          continue;
        }

        const currentPrice = chartData[0].close; // 최신 가격 (매도가)

        // 여러 시점에서 매수했을 때의 수익률 계산
        for (const daysAgo of testPoints) {
          if (daysAgo >= chartData.length) continue;

          const buyPrice = chartData[daysAgo].close; // N일 전 가격 (매수가)
          const buyDate = chartData[daysAgo].date;
          const sellDate = chartData[0].date;

          const returnRate = ((currentPrice - buyPrice) / buyPrice) * 100;
          const isWin = returnRate > 0;

          results.push({
            stockCode: stock.stockCode,
            stockName: stock.stockName,
            grade: stock.recommendation.grade,
            totalScore: stock.totalScore,
            buyDate: buyDate,
            buyPrice: buyPrice,
            sellDate: sellDate,
            sellPrice: currentPrice,
            holdingDays: daysAgo,
            returnRate: parseFloat(returnRate.toFixed(2)),
            isWin: isWin
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ [${stock.stockName}] 분석 실패:`, error.message);
      }
    }

    console.log(`\n✅ 백테스트 완료: ${results.length}개 샘플 분석`);

    // Step 3: 통계 계산
    const statistics = calculateStatistics(results);

    return res.json({
      success: true,
      results: results,
      statistics: statistics,
      metadata: {
        totalStocks: stocks.length,
        totalSamples: results.length,
        testPoints: testPoints,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 백테스트 실패:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 통계 계산
 */
function calculateStatistics(results) {
  if (results.length === 0) {
    return null;
  }

  // 전체 통계
  const totalCount = results.length;
  const winCount = results.filter(r => r.isWin).length;
  const lossCount = totalCount - winCount;
  const winRate = (winCount / totalCount) * 100;

  const returns = results.map(r => r.returnRate);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / totalCount;
  const maxReturn = Math.max(...returns);
  const minReturn = Math.min(...returns);

  // 표준편차 (Sharpe Ratio 계산용)
  const variance = returns.reduce((sum, r) =>
    sum + Math.pow(r - avgReturn, 2), 0) / totalCount;
  const stdDev = Math.sqrt(variance);

  // Sharpe Ratio (무위험 수익률 0% 가정)
  const sharpeRatio = stdDev === 0 ? 0 : avgReturn / stdDev;

  // MDD (Maximum Drawdown) - 포트폴리오 관점 계산
  let portfolioValue = 1.0;  // 초기 자본 100%
  let peak = 1.0;
  let maxDrawdown = 0;

  returns.forEach(r => {
    // 복리 계산 (예: +10% → 1.0 * 1.1 = 1.1)
    portfolioValue *= (1 + r / 100);

    if (portfolioValue > peak) {
      peak = portfolioValue;
    }

    // 낙폭 계산 (백분율)
    const drawdown = (peak - portfolioValue) / peak * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  // Profit Factor
  const wins = results.filter(r => r.isWin);
  const losses = results.filter(r => !r.isWin);
  const totalProfit = wins.reduce((sum, r) => sum + r.returnRate, 0);
  const totalLoss = Math.abs(losses.reduce((sum, r) => sum + r.returnRate, 0));
  const profitFactor = totalLoss === 0 ? totalProfit : totalProfit / totalLoss;

  const avgWin = wins.length > 0 ? totalProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;

  // 등급별 통계
  const byGrade = groupBy(results, 'grade');
  const gradeStats = {};
  for (const [grade, items] of Object.entries(byGrade)) {
    gradeStats[grade] = calculateGroupStats(items);
  }

  // 보유기간별 통계
  const byHolding = groupBy(results, 'holdingDays');
  const holdingStats = {};
  for (const [days, items] of Object.entries(byHolding)) {
    holdingStats[`${days}days`] = calculateGroupStats(items);
  }

  return {
    overall: {
      totalCount,
      winCount,
      lossCount,
      winRate: parseFloat(winRate.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      maxReturn: parseFloat(maxReturn.toFixed(2)),
      minReturn: parseFloat(minReturn.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
      maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
      profitFactor: parseFloat(profitFactor.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2))
    },
    byGrade: gradeStats,
    byHoldingPeriod: holdingStats,
    interpretation: interpretResults({
      winRate,
      avgReturn,
      sharpeRatio,
      maxDrawdown,
      profitFactor
    })
  };
}

/**
 * 그룹별 통계
 */
function calculateGroupStats(items) {
  if (items.length === 0) return null;

  const count = items.length;
  const winCount = items.filter(r => r.isWin).length;
  const winRate = (winCount / count) * 100;
  const returns = items.map(r => r.returnRate);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / count;
  const maxReturn = Math.max(...returns);
  const minReturn = Math.min(...returns);

  return {
    count,
    winCount,
    lossCount: count - winCount,
    winRate: parseFloat(winRate.toFixed(2)),
    avgReturn: parseFloat(avgReturn.toFixed(2)),
    maxReturn: parseFloat(maxReturn.toFixed(2)),
    minReturn: parseFloat(minReturn.toFixed(2))
  };
}

/**
 * 배열 그룹화
 */
function groupBy(array, key) {
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
 * 결과 해석
 */
function interpretResults({ winRate, avgReturn, sharpeRatio, maxDrawdown, profitFactor }) {
  const results = [];

  // 승률 해석
  if (winRate >= 60) results.push('🔥 승률 우수 (60% 이상)');
  else if (winRate >= 50) results.push('✅ 승률 양호 (50% 이상)');
  else if (winRate >= 40) results.push('⚠️ 승률 보통 (40% 이상)');
  else results.push('❌ 승률 부족 (40% 미만)');

  // 평균 수익률 해석
  if (avgReturn >= 5) results.push('💰 평균 수익률 우수 (5% 이상)');
  else if (avgReturn >= 2) results.push('✅ 평균 수익률 양호 (2% 이상)');
  else if (avgReturn >= 0) results.push('⚠️ 평균 수익률 낮음 (0% 이상)');
  else results.push('❌ 평균 손실 발생');

  // Sharpe Ratio 해석
  if (sharpeRatio > 2) results.push('🛡️ 위험 대비 수익 매우 우수 (Sharpe > 2)');
  else if (sharpeRatio > 1) results.push('✅ 위험 대비 수익 양호 (Sharpe > 1)');
  else if (sharpeRatio > 0) results.push('⚠️ 위험 대비 수익 보통 (Sharpe > 0)');
  else results.push('❌ 위험 대비 수익 부족');

  // MDD 해석
  if (maxDrawdown < 5) results.push('🛡️ 낙폭 매우 안정적 (MDD < 5%)');
  else if (maxDrawdown < 10) results.push('✅ 낙폭 양호 (MDD < 10%)');
  else if (maxDrawdown < 20) results.push('⚠️ 낙폭 주의 (MDD < 20%)');
  else results.push('❌ 낙폭 위험 (MDD ≥ 20%)');

  // Profit Factor 해석
  if (profitFactor > 2) results.push('💎 수익/손실 비율 우수 (PF > 2)');
  else if (profitFactor > 1.5) results.push('✅ 수익/손실 비율 양호 (PF > 1.5)');
  else if (profitFactor > 1) results.push('⚠️ 수익/손실 비율 보통 (PF > 1)');
  else results.push('❌ 손실이 수익보다 큼 (PF ≤ 1)');

  return results;
}
