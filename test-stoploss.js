/**
 * 손절매 백테스트 테스트 스크립트
 *
 * 테스트 시나리오:
 * 1. 손절 없음 (기존)
 * 2. 손절 -5%
 * 3. 손절 -7%
 * 4. 손절 -10%
 *
 * 비교 지표:
 * - 승률
 * - 평균 수익률
 * - Sharpe Ratio
 * - MDD
 * - Profit Factor
 */

const stopLossApi = require('./api/backtest/stoploss');
const simpleApi = require('./api/backtest/simple');

async function runStopLossTests() {
  console.log('🧪 손절매 백테스트 비교 테스트 시작\n');
  console.log('=' .repeat(80));

  const scenarios = [
    { name: '손절 없음 (기존)', stopLoss: null },
    { name: '손절 -5%', stopLoss: -5 },
    { name: '손절 -7%', stopLoss: -7 },
    { name: '손절 -10%', stopLoss: -10 }
  ];

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\n🔍 시나리오: ${scenario.name}`);
    console.log('─'.repeat(80));

    let jsonResult = null;

    const req = {
      query: scenario.stopLoss === null ? {} : { stopLossRate: scenario.stopLoss }
    };

    const res = {
      json: (data) => {
        jsonResult = data;
        return res;
      },
      status: (code) => {
        console.log(`HTTP Status: ${code}`);
        return res;
      }
    };

    try {
      // API 실행
      if (scenario.stopLoss === null) {
        await simpleApi(req, res);
      } else {
        await stopLossApi(req, res);
      }

      if (!jsonResult || !jsonResult.success) {
        console.error(`❌ ${scenario.name} 실패:`, jsonResult?.error);
        continue;
      }

      const { statistics } = jsonResult;

      if (!statistics) {
        console.log('⚠️  통계 없음');
        continue;
      }

      // 결과 저장
      results.push({
        name: scenario.name,
        stopLoss: scenario.stopLoss,
        stats: statistics.overall,
        stopLossStats: statistics.stopLoss || null,
        interpretation: statistics.interpretation
      });

      // 간단 요약 출력
      console.log(`  승률: ${statistics.overall.winRate}%`);
      console.log(`  평균 수익률: ${statistics.overall.avgReturn}%`);
      console.log(`  Sharpe Ratio: ${statistics.overall.sharpeRatio}`);
      console.log(`  MDD: ${statistics.overall.maxDrawdown}%`);
      console.log(`  Profit Factor: ${statistics.overall.profitFactor}`);

      if (statistics.stopLoss) {
        console.log(`  손절 발동: ${statistics.stopLoss.triggeredCount}회 (${statistics.stopLoss.triggeredRate}%)`);
        console.log(`  평균 손절일: ${statistics.stopLoss.avgDayToStopLoss}일차`);
      }

    } catch (error) {
      console.error(`❌ ${scenario.name} 실패:`, error.message);
    }

    // API 호출 간격
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 비교 테이블 출력
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 손절매 시나리오 비교표');
  console.log('='.repeat(80));

  console.log('\n┌─────────────┬──────┬──────────┬────────┬──────┬────────┬────────┐');
  console.log('│ 시나리오    │ 승률 │ 평균수익 │ Sharpe │ MDD  │ PF     │ 손절률 │');
  console.log('├─────────────┼──────┼──────────┼────────┼──────┼────────┼────────┤');

  results.forEach(r => {
    const name = r.name.padEnd(13, ' ');
    const winRate = (r.stats.winRate + '%').padStart(6, ' ');
    const avgReturn = (r.stats.avgReturn >= 0 ? '+' : '') + r.stats.avgReturn + '%';
    const avgReturnPad = avgReturn.padStart(10, ' ');
    const sharpe = r.stats.sharpeRatio.toFixed(2).padStart(8, ' ');
    const mdd = (r.stats.maxDrawdown + '%').padStart(6, ' ');
    const pf = r.stats.profitFactor.toFixed(1).padStart(8, ' ');
    const stopRate = r.stopLossStats
      ? (r.stopLossStats.triggeredRate + '%').padStart(8, ' ')
      : 'N/A'.padStart(8, ' ');

    console.log(`│ ${name}│${winRate}│${avgReturnPad}│${sharpe}│${mdd}│${pf}│${stopRate}│`);
  });

  console.log('└─────────────┴──────┴──────────┴────────┴──────┴────────┴────────┘');

  // 핵심 지표 변화 분석
  console.log('\n📈 핵심 지표 변화 분석');
  console.log('─'.repeat(80));

  if (results.length >= 2) {
    const baseline = results[0];  // 손절 없음

    for (let i = 1; i < results.length; i++) {
      const scenario = results[i];
      const winRateDiff = scenario.stats.winRate - baseline.stats.winRate;
      const avgReturnDiff = scenario.stats.avgReturn - baseline.stats.avgReturn;
      const sharpeDiff = scenario.stats.sharpeRatio - baseline.stats.sharpeRatio;
      const mddDiff = scenario.stats.maxDrawdown - baseline.stats.maxDrawdown;

      console.log(`\n${scenario.name} vs 손절 없음:`);
      console.log(`  승률: ${baseline.stats.winRate}% → ${scenario.stats.winRate}% (${winRateDiff >= 0 ? '+' : ''}${winRateDiff.toFixed(2)}%p)`);
      console.log(`  평균 수익률: ${baseline.stats.avgReturn}% → ${scenario.stats.avgReturn}% (${avgReturnDiff >= 0 ? '+' : ''}${avgReturnDiff.toFixed(2)}%p)`);
      console.log(`  Sharpe Ratio: ${baseline.stats.sharpeRatio} → ${scenario.stats.sharpeRatio} (${sharpeDiff >= 0 ? '+' : ''}${sharpeDiff.toFixed(2)})`);
      console.log(`  MDD: ${baseline.stats.maxDrawdown}% → ${scenario.stats.maxDrawdown}% (${mddDiff >= 0 ? '+' : ''}${mddDiff.toFixed(2)}%p)`);

      // 평가
      const improvements = [];
      if (sharpeDiff > 0) improvements.push('Sharpe ↑');
      if (mddDiff < 0) improvements.push('MDD ↓');
      if (avgReturnDiff > -5) improvements.push('수익률 유지');

      if (improvements.length >= 2) {
        console.log(`  ✅ 종합: ${improvements.join(', ')} → 개선됨`);
      } else {
        console.log(`  ⚠️ 종합: 트레이드오프 확인 필요`);
      }
    }
  }

  // 권장 손절 기준
  console.log('\n\n💡 권장 손절 기준');
  console.log('─'.repeat(80));

  let bestScenario = null;
  let bestScore = -Infinity;

  results.forEach((r, i) => {
    if (i === 0) return; // 손절 없음 제외

    // 평가 점수 = Sharpe * 100 + (MDD < 15% ? 50 : 0) + (avgReturn > 15% ? 30 : 0)
    const sharpeScore = r.stats.sharpeRatio * 100;
    const mddBonus = r.stats.maxDrawdown < 15 ? 50 : 0;
    const returnBonus = r.stats.avgReturn > 15 ? 30 : 0;
    const score = sharpeScore + mddBonus + returnBonus;

    if (score > bestScore) {
      bestScore = score;
      bestScenario = r;
    }
  });

  if (bestScenario) {
    console.log(`\n🏆 최적 손절 기준: ${bestScenario.name}`);
    console.log(`  승률: ${bestScenario.stats.winRate}%`);
    console.log(`  평균 수익률: ${bestScenario.stats.avgReturn}%`);
    console.log(`  Sharpe Ratio: ${bestScenario.stats.sharpeRatio}`);
    console.log(`  MDD: ${bestScenario.stats.maxDrawdown}%`);
    console.log(`  Profit Factor: ${bestScenario.stats.profitFactor}`);

    if (bestScenario.stopLossStats) {
      console.log(`\n  손절 통계:`);
      console.log(`  - 손절 발동률: ${bestScenario.stopLossStats.triggeredRate}%`);
      console.log(`  - 평균 손절일: ${bestScenario.stopLossStats.avgDayToStopLoss}일차`);
      console.log(`  - 평균 손실 절감: ${bestScenario.stopLossStats.savedFromWorst.toFixed(2)}%p`);
    }

    console.log(`\n  성과 해석:`);
    bestScenario.interpretation.forEach(msg => {
      console.log(`  ${msg}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 손절매 백테스트 비교 완료!\n');
}

// 실행
runStopLossTests();
