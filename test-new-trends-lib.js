/**
 * @shaivpidadi/trends-js 라이브러리 테스트
 */

const { interestOverTime, relatedQueries } = require('@shaivpidadi/trends-js');

async function testNewLib() {
  console.log('\n🔍 새 Google Trends 라이브러리 테스트\n');

  try {
    console.log('1️⃣ Interest Over Time 테스트 (삼성전자)...');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const results = await interestOverTime({
      keyword: '삼성전자',
      startTime: startDate,
      endTime: new Date(),
      geo: 'KR'
    });

    console.log('   ✅ 성공!');
    console.log('   응답 타입:', typeof results);
    console.log('   응답:', JSON.stringify(results).substring(0, 300), '...');

    // 데이터 파싱
    if (typeof results === 'object') {
      const timeline = results.default?.timelineData || results.timelineData;
      if (timeline) {
        console.log(`   📊 데이터 포인트: ${timeline.length}개`);
        if (timeline.length > 0) {
          const values = timeline.map(d => d.value?.[0] || d.value);
          const latest = values[values.length - 1];
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          console.log(`   최신 검색량: ${latest}`);
          console.log(`   평균 검색량: ${avg.toFixed(1)}`);
          console.log(`   변화율: ${((latest - avg) / avg * 100).toFixed(1)}%`);
        }
      }
    }

    return true;

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세:', error);
    return false;
  }
}

testNewLib().catch(console.error);
