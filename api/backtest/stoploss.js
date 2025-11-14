/**
 * 손절매 적용 백테스트 API
 *
 * 목적:
 * - MDD(Maximum Drawdown)를 15% 이하로 낮추기
 * - 실전 투자자의 리스크 관리 시뮬레이션
 * - Sharpe Ratio 개선 검증
 *
 * 테스트 시나리오:
 * - 손절 -5%, -7%, -10% 각각 적용
 * - 손절 없음 vs 손절 있음 비교
 */

const screener = require('../../backend/screening');
const kisApi = require('../../backend/kisApi');

module.exports = async (req, res) => {
  console.log('\n🔍 손절매 백테스트 시작\n');

  try {
    const {
      stopLossRate = -7,  // 기본 손절 -7%
      holdingDays = 5
    } = req.query;

    const stopLoss = parseFloat(stopLossRate);

    // 검증
    if (stopLoss >= 0 || stopLoss < -20) {
      return res.status(400).json({
        success: false,
        error: '손절 비율은 -0.1 ~ -20 사이여야 합니다'
      });
    }

    console.log(`📊 손절 기준: ${stopLoss}%`);

    // Step 1: 현재 추천 종목 가져오기
    const { stocks } = await screener.screenAllStocks('ALL');

    if (!stocks || stocks.length === 0) {
      return res.status(404).json({
        success: false,
        error: '추천 종목이 없습니다'
      });
    }

    console.log(`  ✅ ${stocks.length}개 종목 분석 대상`);

    // Step 2: 손절매 적용 백테스트
    const results = [];
    const testPoints = [5, 10, 15, 20, 25];

    for (const stock of stocks) {
      try {
        const chartData = await kisApi.getDailyChart(stock.stockCode, 30);

        if (!chartData || chartData.length < 25) {
          console.log(`  ⚠️  [${stock.stockName}] 데이터 부족`);
          continue;
        }

        // 여러 시점에서 매수 시뮬레이션
        for (const daysAgo of testPoints) {
          if (daysAgo >= chartData.length) continue;

          const result = calculateReturnsWithStopLoss(
            chartData,
            daysAgo,
            stopLoss,
            stock
          );

          if (result) {
            results.push(result);
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`  ❌ [${stock.stockName}] 분석 실패:`, error.message);
      }
    }

    console.log(`\n✅ 백테스트 완료: ${results.length}개 샘플`);

    // Step 3: 통계 계산
    const statistics = calculateStatistics(results, stopLoss);

    // Step 4: 손절 없음 vs 있음 비교
    const comparison = compareWithNoStopLoss(results);

    return res.json({
      success: true,
      stopLossRate: stopLoss,
      results: results,
      statistics: statistics,
      comparison: comparison,
      metadata: {
        totalStocks: stocks.length,
        totalSamples: results.length,
        testPoints: testPoints,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 손절매 백테스트 실패:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 손절매 적용 수익률 계산
 */
function calculateReturnsWithStopLoss(chartData, buyIndex, stopLossRate, stock) {
  try {
    const buyPrice = chartData[buyIndex].close;
    const buyDate = chartData[buyIndex].date;

    // 매수 시점부터 현재까지 매일 손절 체크
    for (let i = buyIndex - 1; i >= 0; i--) {
      const currentPrice = chartData[i].close;
      const currentReturn = ((currentPrice - buyPrice) / buyPrice) * 100;

      // 손절 조건 도달
      if (currentReturn <= stopLossRate) {
        return {
          stockCode: stock.stockCode,
          stockName: stock.stockName,
          grade: stock.recommendation.grade,
          totalScore: stock.totalScore,
          buyDate: buyDate,
          buyPrice: buyPrice,
          sellDate: chartData[i].date,
          sellPrice: currentPrice,
          holdingDays: buyIndex - i,
          returnRate: parseFloat(currentReturn.toFixed(2)),
          isWin: false,  // 손절은 항상 손실
          stopLossTriggered: true,
          stopLossDay: buyIndex - i  // 손절까지 걸린 일수
        };
      }
    }

    // 손절 안 됨 → 현재까지 보유
    const currentPrice = chartData[0].close;
    const sellDate = chartData[0].date;
    const finalReturn = ((currentPrice - buyPrice) / buyPrice) * 100;

    return {
      stockCode: stock.stockCode,
      stockName: stock.stockName,
      grade: stock.recommendation.grade,
      totalScore: stock.totalScore,
      buyDate: buyDate,
      buyPrice: buyPrice,
      sellDate: sellDate,
      sellPrice: currentPrice,
      holdingDays: buyIndex,
      returnRate: parseFloat(finalReturn.toFixed(2)),
      isWin: finalReturn > 0,
      stopLossTriggered: false,
      stopLossDay: null
    };

  } catch (error) {
    console.error('수익률 계산 실패:', error);
    return null;
  }
}

/**
 * 통계 계산
 */
function calculateStatistics(results, stopLossRate) {
  if (results.length === 0) return null;

  const totalCount = results.length;
  const winCount = results.filter(r => r.isWin).length;
  const lossCount = totalCount - winCount;
  const winRate = (winCount / totalCount) * 100;

  const returns = results.map(r => r.returnRate);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / totalCount;
  const maxReturn = Math.max(...returns);
  const minReturn = Math.min(...returns);

  // 표준편차
  const variance = returns.reduce((sum, r) =>
    sum + Math.pow(r - avgReturn, 2), 0) / totalCount;
  const stdDev = Math.sqrt(variance);

  // Sharpe Ratio
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

  // 손절 통계
  const stopLossTriggered = results.filter(r => r.stopLossTriggered);
  const stopLossCount = stopLossTriggered.length;
  const stopLossRate_actual = (stopLossCount / totalCount) * 100;
  const avgStopLossDay = stopLossTriggered.length > 0
    ? stopLossTriggered.reduce((sum, r) => sum + r.stopLossDay, 0) / stopLossTriggered.length
    : 0;

  // 등급별 통계
  const byGrade = groupBy(results, 'grade');
  const gradeStats = {};
  for (const [grade, items] of Object.entries(byGrade)) {
    gradeStats[grade] = calculateGroupStats(items);
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
    stopLoss: {
      rate: stopLossRate,
      triggeredCount: stopLossCount,
      triggeredRate: parseFloat(stopLossRate_actual.toFixed(2)),
      avgDayToStopLoss: parseFloat(avgStopLossDay.toFixed(2)),
      savedFromWorst: parseFloat((avgLoss - Math.abs(stopLossRate)).toFixed(2))
    },
    byGrade: gradeStats,
    interpretation: interpretResults({
      winRate,
      avgReturn,
      sharpeRatio,
      maxDrawdown,
      profitFactor,
      stopLossRate: stopLossRate_actual
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
 * 손절 없음과 비교
 */
function compareWithNoStopLoss(results) {
  // 손절 발동된 케이스만 추출
  const stoppedLosses = results.filter(r => r.stopLossTriggered);

  if (stoppedLosses.length === 0) {
    return {
      message: '손절 발동 케이스 없음 (모든 종목이 손절선 위에서 유지)',
      comparison: null
    };
  }

  // 손절로 방어한 추가 손실 계산
  const avgStoppedLoss = stoppedLosses.reduce((sum, r) =>
    sum + r.returnRate, 0) / stoppedLosses.length;

  return {
    message: `${stoppedLosses.length}개 종목에서 손절 발동`,
    stoppedLossCount: stoppedLosses.length,
    avgStoppedLoss: parseFloat(avgStoppedLoss.toFixed(2)),
    examples: stoppedLosses.slice(0, 5).map(r => ({
      name: r.stockName,
      grade: r.grade,
      stopLoss: r.returnRate,
      stoppedAt: r.stopLossDay + '일차'
    }))
  };
}

/**
 * 결과 해석
 */
function interpretResults({ winRate, avgReturn, sharpeRatio, maxDrawdown, profitFactor, stopLossRate }) {
  const results = [];

  // 승률
  if (winRate >= 60) results.push('🔥 승률 우수 (60% 이상)');
  else if (winRate >= 50) results.push('✅ 승률 양호 (50% 이상)');
  else if (winRate >= 40) results.push('⚠️ 승률 보통 (40% 이상)');
  else results.push('❌ 승률 부족 (40% 미만)');

  // 평균 수익률
  if (avgReturn >= 5) results.push('💰 평균 수익률 우수 (5% 이상)');
  else if (avgReturn >= 2) results.push('✅ 평균 수익률 양호 (2% 이상)');
  else if (avgReturn >= 0) results.push('⚠️ 평균 수익률 낮음 (0% 이상)');
  else results.push('❌ 평균 손실 발생');

  // Sharpe Ratio
  if (sharpeRatio > 2) results.push('🛡️ 위험 대비 수익 매우 우수 (Sharpe > 2)');
  else if (sharpeRatio > 1) results.push('✅ 위험 대비 수익 양호 (Sharpe > 1)');
  else if (sharpeRatio > 0) results.push('⚠️ 위험 대비 수익 보통 (Sharpe > 0)');
  else results.push('❌ 위험 대비 수익 부족');

  // MDD
  if (maxDrawdown < 10) results.push('🛡️ 낙폭 매우 안정적 (MDD < 10%)');
  else if (maxDrawdown < 15) results.push('✅ 낙폭 양호 (MDD < 15%)');
  else if (maxDrawdown < 20) results.push('⚠️ 낙폭 주의 (MDD < 20%)');
  else results.push('❌ 낙폭 위험 (MDD ≥ 20%)');

  // Profit Factor
  if (profitFactor > 2) results.push('💎 수익/손실 비율 우수 (PF > 2)');
  else if (profitFactor > 1.5) results.push('✅ 수익/손실 비율 양호 (PF > 1.5)');
  else if (profitFactor > 1) results.push('⚠️ 수익/손실 비율 보통 (PF > 1)');
  else results.push('❌ 손실이 수익보다 큼 (PF ≤ 1)');

  // 손절 발동률
  if (stopLossRate < 10) results.push(`✅ 손절 최소화 (${stopLossRate.toFixed(1)}%)`);
  else if (stopLossRate < 20) results.push(`⚠️ 손절 보통 (${stopLossRate.toFixed(1)}%)`);
  else results.push(`❌ 손절 빈번 (${stopLossRate.toFixed(1)}%)`);

  return results;
}
