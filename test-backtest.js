/**
 * 단기 백테스트 테스트 스크립트
 *
 * 사용법:
 * node test-backtest.js
 */

const backtestApi = require('./api/backtest/simple');

async function runBacktestTest() {
  console.log('🧪 백테스트 API 테스트 시작\n');

  // Mock request/response 객체
  const req = {
    query: {
      holdingDays: 1 // ⭐ 기본값 1일로 변경 (단기 수익률 중심)
    }
  };

  let jsonResult = null;

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
    await backtestApi(req, res);

    if (!jsonResult) {
      console.error('❌ 응답 없음');
      return;
    }

    if (!jsonResult.success) {
      console.error('❌ 백테스트 실패:', jsonResult.error);
      return;
    }

    // 결과 출력
    console.log('\n' + '='.repeat(80));
    console.log('📊 백테스트 결과 요약');
    console.log('='.repeat(80));

    const { statistics, metadata } = jsonResult;

    if (!statistics) {
      console.log('⚠️  통계 없음');
      return;
    }

    // 전체 통계
    console.log('\n📈 전체 성과');
    console.log('─'.repeat(80));
    console.log(`  총 샘플 수: ${statistics.overall.totalCount}개`);
    console.log(`  승: ${statistics.overall.winCount}개 | 패: ${statistics.overall.lossCount}개`);
    console.log(`  승률: ${statistics.overall.winRate}%`);
    console.log(`  평균 수익률: ${statistics.overall.avgReturn}%`);
    console.log(`  최대 수익: ${statistics.overall.maxReturn}% | 최대 손실: ${statistics.overall.minReturn}%`);
    console.log(`  표준편차: ${statistics.overall.stdDev}%`);
    console.log(`  Sharpe Ratio: ${statistics.overall.sharpeRatio}`);
    console.log(`  MDD (최대 낙폭): ${statistics.overall.maxDrawdown}%`);
    console.log(`  Profit Factor: ${statistics.overall.profitFactor}`);
    console.log(`  평균 수익/손실: +${statistics.overall.avgWin}% / -${statistics.overall.avgLoss}%`);

    // 등급별 성과
    if (statistics.byGrade) {
      console.log('\n🏆 등급별 성과');
      console.log('─'.repeat(80));
      for (const [grade, stats] of Object.entries(statistics.byGrade)) {
        if (!stats) continue;
        console.log(`  ${grade}등급: 승률 ${stats.winRate}% | 평균 ${stats.avgReturn}% | 샘플 ${stats.count}개`);
      }
    }

    // 보유기간별 성과
    if (statistics.byHoldingPeriod) {
      console.log('\n📅 보유기간별 성과 (단기 수익률 중심)');
      console.log('─'.repeat(80));

      const periods = ['1days', '2days', '3days', '5days'];
      periods.forEach(period => {
        const stats = statistics.byHoldingPeriod[period];
        if (!stats) return;

        const days = period.replace('days', '');
        console.log(`\n  📊 D+${days}일 보유 (${days}일 전 매수 → 오늘 매도)`);
        console.log(`     승률: ${stats.winRate}% | 평균: ${stats.avgReturn > 0 ? '+' : ''}${stats.avgReturn}% | 샘플: ${stats.count}개`);
        console.log(`     최고/최저: +${stats.maxReturn}% / ${stats.minReturn}%`);

        // ⭐ 등급별 성과 (D+1일, D+2일이 가장 중요!)
        if (days === '1' || days === '2') {
          console.log(`\n     🏆 D+${days}일 등급별 상세:`);

          const holdingResults = jsonResult.results.filter(r => r.holdingDays === parseInt(days));
          const byGrade = {};

          holdingResults.forEach(r => {
            if (!byGrade[r.grade]) {
              byGrade[r.grade] = [];
            }
            byGrade[r.grade].push(r);
          });

          ['S', 'A', 'B', 'C', 'D'].forEach(grade => {
            const gradeResults = byGrade[grade];
            if (!gradeResults || gradeResults.length === 0) return;

            const avgReturn = gradeResults.reduce((sum, r) => sum + r.returnRate, 0) / gradeResults.length;
            const winCount = gradeResults.filter(r => r.isWin).length;
            const winRate = (winCount / gradeResults.length) * 100;
            const maxReturn = Math.max(...gradeResults.map(r => r.returnRate));

            console.log(`        ${grade}등급: 평균 ${avgReturn > 0 ? '+' : ''}${avgReturn.toFixed(2)}%, 승률 ${winRate.toFixed(1)}%, 최고 +${maxReturn.toFixed(2)}% (${gradeResults.length}개)`);
          });
        }
      });
    }

    // 해석
    if (statistics.interpretation) {
      console.log('\n💡 성과 해석');
      console.log('─'.repeat(80));
      statistics.interpretation.forEach(msg => {
        console.log(`  ${msg}`);
      });
    }

    // 메타데이터
    console.log('\n📋 메타데이터');
    console.log('─'.repeat(80));
    console.log(`  분석 종목 수: ${metadata.totalStocks}개`);
    console.log(`  총 샘플: ${metadata.totalSamples}개`);
    console.log(`  테스트 시점: ${metadata.testPoints.join(', ')}일 전`);
    console.log(`  생성 시각: ${metadata.generatedAt}`);

    // 상위 5개 수익 샘플
    const topWinners = jsonResult.results
      .filter(r => r.isWin)
      .sort((a, b) => b.returnRate - a.returnRate)
      .slice(0, 5);

    if (topWinners.length > 0) {
      console.log('\n🎯 최고 수익 TOP 5');
      console.log('─'.repeat(80));
      topWinners.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.stockName}] ${r.grade}등급 | ${r.holdingDays}일 보유 | +${r.returnRate}%`);
        console.log(`     매수: ${r.buyDate} (${r.buyPrice.toLocaleString()}원) → 매도: ${r.sellDate} (${r.sellPrice.toLocaleString()}원)`);
      });
    }

    // 하위 5개 손실 샘플
    const topLosers = jsonResult.results
      .filter(r => !r.isWin)
      .sort((a, b) => a.returnRate - b.returnRate)
      .slice(0, 5);

    if (topLosers.length > 0) {
      console.log('\n⚠️  최대 손실 TOP 5');
      console.log('─'.repeat(80));
      topLosers.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.stockName}] ${r.grade}등급 | ${r.holdingDays}일 보유 | ${r.returnRate}%`);
        console.log(`     매수: ${r.buyDate} (${r.buyPrice.toLocaleString()}원) → 매도: ${r.sellDate} (${r.sellPrice.toLocaleString()}원)`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ 백테스트 테스트 완료!\n');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    console.error(error.stack);
  }
}

// 실행
runBacktestTest();
