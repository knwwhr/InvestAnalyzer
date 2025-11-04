/**
 * @shaivpidadi/trends-js explore 함수 테스트
 */

const { explore, GoogleTrendsApi } = require('@shaivpidadi/trends-js');

async function testExplore() {
  console.log('\n🔍 Google Trends explore 함수 테스트\n');

  try {
    console.log('1️⃣ explore 함수 직접 호출...');

    const results = await explore({
      keyword: '삼성전자',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      geo: 'KR'
    });

    console.log('   ✅ 성공!');
    console.log('   응답 타입:', typeof results);
    console.log('   응답 키:', Object.keys(results || {}).slice(0, 10));
    console.log('   응답 샘플:', JSON.stringify(results).substring(0, 500));

    return true;

  } catch (error) {
    console.error('   ❌ explore 실패:', error.message);
  }

  try {
    console.log('\n2️⃣ GoogleTrendsApi 클래스 사용...');

    const api = new GoogleTrendsApi();
    const results = await api.explore({
      keyword: '삼성전자',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      geo: 'KR'
    });

    console.log('   ✅ 성공!');
    console.log('   응답 타입:', typeof results);
    console.log('   응답 샘플:', JSON.stringify(results).substring(0, 500));

    return true;

  } catch (error) {
    console.error('   ❌ GoogleTrendsApi 실패:', error.message);
  }

  try {
    console.log('\n3️⃣ dailyTrends 시도 (실시간 트렌드)...');

    const { dailyTrends } = require('@shaivpidadi/trends-js');
    const results = await dailyTrends({ geo: 'KR' });

    console.log('   ✅ 성공!');
    console.log('   응답 타입:', typeof results);
    console.log('   응답 샘플:', JSON.stringify(results).substring(0, 500));

    return true;

  } catch (error) {
    console.error('   ❌ dailyTrends 실패:', error.message);
  }

  return false;
}

testExplore().catch(console.error);
