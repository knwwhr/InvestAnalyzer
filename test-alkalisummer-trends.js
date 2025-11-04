/**
 * @alkalisummer/google-trends-js 테스트
 */

async function testAlkalisummer() {
  console.log('\n🔍 Alkalisummer Google Trends 테스트\n');

  try {
    const GoogleTrends = require('@alkalisummer/google-trends-js');

    console.log('1️⃣ 라이브러리 로드 확인...');
    console.log('   타입:', typeof GoogleTrends);
    console.log('   키:', Object.keys(GoogleTrends));

    if (typeof GoogleTrends === 'function') {
      console.log('\n2️⃣ 클래스 인스턴스 생성...');
      const trends = new GoogleTrends();
      console.log('   인스턴스 메소드:', Object.getOwnPropertyNames(Object.getPrototypeOf(trends)));
    }

    console.log('\n3️⃣ Interest Over Time 호출...');

    const result = await GoogleTrends.interestOverTime({
      keyword: '삼성전자',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      geo: 'KR'
    });

    console.log('   ✅ 성공!');
    console.log('   응답 타입:', typeof result);

    if (typeof result === 'string') {
      const parsed = JSON.parse(result);
      const timeline = parsed.default?.timelineData;
      if (timeline) {
        console.log(`   📊 데이터 포인트: ${timeline.length}개`);
        const values = timeline.map(d => d.value[0]);
        const latest = values[values.length - 1];
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        console.log(`   최신 검색량: ${latest}`);
        console.log(`   평균 검색량: ${avg.toFixed(1)}`);
        console.log(`   변화율: ${((latest - avg) / avg * 100).toFixed(1)}%`);
      }
    } else {
      console.log('   응답 샘플:', JSON.stringify(result).substring(0, 300));
    }

    return true;

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세:', error);
    return false;
  }
}

testAlkalisummer().catch(console.error);
