/**
 * Google Trends API 원시 테스트
 */

const googleTrends = require('google-trends-api');

async function testRaw() {
  console.log('\n🔍 Google Trends API 원시 테스트\n');

  try {
    console.log('1️⃣ 실시간 검색어 테스트...');
    const realtime = await googleTrends.realTimeTrends({
      geo: 'KR',
      category: 'all'
    }, (err, results) => {
      if (err) {
        console.error('   ❌ 에러:', err.message);
      } else {
        console.log('   ✅ 실시간 검색어 성공');
        console.log('   응답 길이:', results.length);
      }
    });

  } catch (error) {
    console.error('\n❌ 실시간 검색어 실패:', error.message);
  }

  try {
    console.log('\n2️⃣ Interest Over Time 테스트 (간단한 키워드)...');

    const results = await googleTrends.interestOverTime({
      keyword: '삼성',
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1일
      geo: 'KR'
    });

    console.log('   ✅ 성공!');
    console.log('   응답:', results.substring(0, 200), '...');

    const parsed = JSON.parse(results);
    console.log('   데이터 포인트:', parsed.default?.timelineData?.length || 0);

  } catch (error) {
    console.error('\n❌ Interest Over Time 실패:', error.message);
    if (error.message.includes('Unexpected token')) {
      console.error('\n💡 Google Trends API가 차단되었을 가능성이 있습니다.');
      console.error('   대안:');
      console.error('   1. 다른 라이브러리 사용 (serpapi, pytrends 등)');
      console.error('   2. 프록시 서버 사용');
      console.error('   3. 공식 API가 나올 때까지 대기');
    }
  }
}

testRaw().catch(console.error);
