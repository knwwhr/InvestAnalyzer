/**
 * KIS API TR_ID 디버깅 테스트
 * volumeSurge와 tradingValue API가 빈 데이터를 반환하는 원인 규명
 */

const kisApi = require('./backend/kisApi');

async function testKISApis() {
  console.log('🔍 KIS API TR_ID 테스트 시작...\n');

  try {
    // 1. 거래량 급증 순위 (FHPST01730000) - 문제 API
    console.log('=== 1. 거래량 급증 순위 (FHPST01730000) ===');
    const volumeSurge = await kisApi.getVolumeSurgeRank('KOSPI', 5);
    console.log(`✅ 결과: ${volumeSurge.length}개`);
    if (volumeSurge.length > 0) {
      console.log('샘플:', volumeSurge[0]);
    } else {
      console.log('⚠️  빈 결과 반환');
    }
    console.log('');

    // 2. 거래대금 순위 (FHPST01720000) - 문제 API
    console.log('=== 2. 거래대금 순위 (FHPST01720000) ===');
    const tradingValue = await kisApi.getTradingValueRank('KOSPI', 5);
    console.log(`✅ 결과: ${tradingValue.length}개`);
    if (tradingValue.length > 0) {
      console.log('샘플:', tradingValue[0]);
    } else {
      console.log('⚠️  빈 결과 반환');
    }
    console.log('');

    // 3. 거래량 순위 (FHPST01710000) - 정상 API
    console.log('=== 3. 거래량 순위 (FHPST01710000) ===');
    const volume = await kisApi.getVolumeRank('KOSPI', 5);
    console.log(`✅ 결과: ${volume.length}개`);
    if (volume.length > 0) {
      console.log('샘플:', volume[0]);
    } else {
      console.log('⚠️  빈 결과 반환');
    }
    console.log('');

    // 에러 로그 확인
    if (kisApi._apiErrors && kisApi._apiErrors.length > 0) {
      console.log('=== API 에러 로그 ===');
      kisApi._apiErrors.forEach((err, idx) => {
        console.log(`\n[${idx + 1}] ${err.method} (${err.market})`);
        console.log(`Status: ${err.status || 'N/A'}`);
        console.log(`Error: ${err.error}`);
      });
    }

    console.log('\n🔍 결론:');
    console.log(`- volumeSurge: ${volumeSurge.length > 0 ? '✅ 정상' : '❌ 실패'}`);
    console.log(`- tradingValue: ${tradingValue.length > 0 ? '✅ 정상' : '❌ 실패'}`);
    console.log(`- volume: ${volume.length > 0 ? '✅ 정상' : '❌ 실패'}`);

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 실행
testKISApis();
