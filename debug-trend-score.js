/**
 * 추세 점수 디버그 스크립트
 * 특정 종목의 추세 점수 계산 과정을 상세하게 출력
 */

const screener = require('./backend/screening');

async function debugTrendScore() {
  console.log('🔍 추세 점수 디버그\n');

  // 테스트 종목: 참좋은여행 (40.2 → 58.6점, +18.4점)
  const stockCode = '094850';

  try {
    const analysis = await screener.analyzeStock(stockCode);

    if (!analysis) {
      console.error('❌ 종목 분석 실패');
      return;
    }

    console.log(`📊 종목: ${analysis.stockName} (${analysis.stockCode})`);
    console.log(`   총점: ${analysis.totalScore}점\n`);

    // ScoreBreakdown 출력
    console.log('📋 점수 구성:\n');
    console.log(`   기본 점수: ${analysis.scoreBreakdown.baseScore}점`);
    console.log(`   가점 총합: ${analysis.scoreBreakdown.bonuses.reduce((sum, b) => sum + b.value, 0)}점\n`);

    console.log('   가점 상세:');
    analysis.scoreBreakdown.bonuses.forEach(bonus => {
      console.log(`      - ${bonus.name}: ${bonus.value}점`);
      if (bonus.details) {
        console.log(`         └─ ${JSON.stringify(bonus.details, null, 10)}`);
      }
    });

    // 추세 점수 상세
    console.log('\n🔥 추세 점수 상세:\n');
    const ts = analysis.trendScore;

    console.log(`   총 추세 점수: ${ts.totalScore}점 / 20점`);
    console.log(`\n   1️⃣ 거래량 점진 증가 (Volume Acceleration): ${ts.volumeAcceleration.score}점 / 10점`);
    console.log(`      트렌드: ${ts.volumeAcceleration.trend}`);
    console.log(`      감지: ${ts.volumeAcceleration.detected ? 'YES' : 'NO'}`);
    if (ts.volumeAcceleration.details) {
      console.log(`      최근 5일 평균: ${ts.volumeAcceleration.details.avgRecent.toLocaleString()}주`);
      console.log(`      중간 5일 평균: ${ts.volumeAcceleration.details.avgMid.toLocaleString()}주`);
      console.log(`      이전 10일 평균: ${ts.volumeAcceleration.details.avgOld.toLocaleString()}주`);
      console.log(`      가장 오래된 10일 평균: ${ts.volumeAcceleration.details.avgOldest.toLocaleString()}주`);
      console.log(`      최근 vs 중간: ${ts.volumeAcceleration.details.recentVsMid}배`);
      console.log(`      중간 vs 이전: ${ts.volumeAcceleration.details.midVsOld}배`);
      console.log(`      이전 vs 가장 오래된: ${ts.volumeAcceleration.details.oldVsOldest}배`);
    }

    console.log(`\n   2️⃣ 기관/외국인 장기 매집: ${ts.institutionalAccumulation.score}점 / 5점`);
    console.log(`      강도: ${ts.institutionalAccumulation.strength}`);
    console.log(`      연속 매수일: ${ts.institutionalAccumulation.days}일`);
    console.log(`      순매수 총액: ${ts.institutionalAccumulation.totalNetBuy.toLocaleString()}주`);
    console.log(`      감지: ${ts.institutionalAccumulation.detected ? 'YES' : 'NO'}`);

    console.log(`\n   3️⃣ VPD 강화 추세: ${ts.vpdStrengthening.score}점 / 5점`);
    console.log(`      트렌드: ${ts.vpdStrengthening.trend}`);
    console.log(`      감지: ${ts.vpdStrengthening.detected ? 'YES' : 'NO'}`);
    if (ts.vpdStrengthening.details) {
      console.log(`      최근 VPD: ${ts.vpdStrengthening.details.recentVPD}`);
      console.log(`      이전 VPD: ${ts.vpdStrengthening.details.oldVPD}`);
      console.log(`      개선도: ${ts.vpdStrengthening.details.improvement}`);
    }

    // 원점수 vs 스케일링 점수
    console.log(`\n📐 스케일링:\n`);
    console.log(`   원점수 (120점 만점): ${analysis.scoreBreakdown.rawScore}점`);
    console.log(`   최종 점수 (100점 스케일): ${analysis.scoreBreakdown.finalScore}점`);
    console.log(`   스케일링 비율: ${analysis.scoreBreakdown.scalingFactor}`);

  } catch (error) {
    console.error('❌ 에러:', error);
    console.error(error.stack);
  }
}

// 실행
debugTrendScore();
