/**
 * 현재 최고점 종목 확인 스크립트
 */

const screener = require('./backend/screening');

async function checkTopStocks() {
  try {
    console.log('🔍 스크리닝 시작...\n');
    const { stocks } = await screener.screenAllStocks('ALL', 10);

    if (!stocks || stocks.length === 0) {
      console.log('❌ 추천 종목이 없습니다.');
      return;
    }

    console.log('\n🏆 현재 TOP 10 종목 (변화율 기반 점수):\n');
    console.log('─'.repeat(80));
    stocks.slice(0, 10).forEach((s, i) => {
      const momentum = s.scoreBreakdown?.momentumScore || 0;
      const base = s.scoreBreakdown?.baseScore || 0;
      const trend = s.scoreBreakdown?.trendScore || 0;
      console.log(`${i+1}. [${s.stockName}] ${s.totalScore}점 (${s.recommendation.grade}등급)`);
      console.log(`   └ 기본: ${base}점 | 변화율: ${momentum}점 | 추세: ${trend}점`);
    });

    console.log('\n' + '='.repeat(80));
    console.log(`⭐ 최고점 종목: [${stocks[0].stockName}] ${stocks[0].totalScore}점 (${stocks[0].recommendation.grade}등급)`);
    console.log('='.repeat(80) + '\n');

    // 최고점 종목 상세 정보
    const top = stocks[0];
    if (top.scoreBreakdown?.momentumComponents) {
      console.log('\n📊 최고점 종목 변화율 상세:\n');
      const mc = top.scoreBreakdown.momentumComponents;
      console.log(`  거래량 가속도: ${mc.volumeAcceleration.score}점 (${mc.volumeAcceleration.trend})`);
      console.log(`  VPD 개선도: ${mc.vpdImprovement.score}점 (${mc.vpdImprovement.trend})`);
      console.log(`  패턴 강화도: ${mc.patternStrengthening.score}점 (${mc.patternStrengthening.trend})`);
      console.log(`  기관 진입: ${mc.institutionalEntry.score}점 (${mc.institutionalEntry.trend})\n`);
    }
  } catch (error) {
    console.error('❌ 스크리닝 실패:', error.message);
    console.error(error.stack);
  }
}

checkTopStocks();
