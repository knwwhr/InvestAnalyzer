/**
 * KIS API 일봉 데이터 조회 제한 테스트
 */
const kisApi = require('./backend/kisApi');

async function testDailyChartLimit() {
  console.log('📊 KIS API 일봉 데이터 조회 제한 테스트\n');
  
  const testStock = '005930'; // 삼성전자
  
  try {
    // 30일 요청
    console.log('1️⃣ 30일 요청...');
    const data30 = await kisApi.getDailyChart(testStock, 30);
    console.log(`   ✅ 받은 데이터: ${data30.length}일`);
    console.log(`   📅 최신: ${data30[0]?.date}, 가장 오래된: ${data30[data30.length-1]?.date}\n`);
    
    // 60일 요청
    console.log('2️⃣ 60일 요청...');
    const data60 = await kisApi.getDailyChart(testStock, 60);
    console.log(`   ✅ 받은 데이터: ${data60.length}일`);
    console.log(`   📅 최신: ${data60[0]?.date}, 가장 오래된: ${data60[data60.length-1]?.date}\n`);
    
    // 100일 요청
    console.log('3️⃣ 100일 요청...');
    const data100 = await kisApi.getDailyChart(testStock, 100);
    console.log(`   ✅ 받은 데이터: ${data100.length}일`);
    console.log(`   📅 최신: ${data100[0]?.date}, 가장 오래된: ${data100[data100.length-1]?.date}\n`);
    
    console.log('📊 결론:');
    if (data60.length === data30.length) {
      console.log(`   ⚠️ KIS API는 최대 ${data30.length}일까지만 제공합니다!`);
      console.log(`   💡 60일 데이터가 필요한 추세 분석은 불가능합니다.`);
    } else {
      console.log(`   ✅ 60일 이상 데이터 제공 가능!`);
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testDailyChartLimit();
