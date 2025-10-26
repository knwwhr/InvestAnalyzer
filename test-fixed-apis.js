/**
 * 수정된 등락률 API 테스트
 */

const kisApi = require('./backend/kisApi');

async function testFixedAPIs() {
  console.log('🔍 수정된 등락률 API 테스트...\n');

  try {
    // 1. 등락률 순위 (수정된 파라미터)
    console.log('=== 등락률 상승 순위 (KOSPI) ===');
    const priceChange = await kisApi.getPriceChangeRank('KOSPI', 10);
    console.log(`✅ 결과: ${priceChange.length}개`);
    if (priceChange.length > 0) {
      console.log('샘플:');
      priceChange.slice(0, 3).forEach((stock, idx) => {
        console.log(`  ${idx + 1}. ${stock.name} (${stock.code}): 등락률 ${stock.changeRate}%`);
      });
    } else {
      console.log('⚠️  빈 결과 반환');
    }
    console.log('');

    // 2. 거래량 순위 (기존 작동 확인)
    console.log('=== 거래량 순위 (KOSPI) - 기존 ===');
    const volume = await kisApi.getVolumeRank('KOSPI', 10);
    console.log(`✅ 결과: ${volume.length}개`);
    console.log('');

    console.log('\n🎯 결론:');
    console.log(`- 등락률 순위: ${priceChange.length > 0 ? '✅ 정상' : '❌ 실패'} (${priceChange.length}개)`);
    console.log(`- 거래량 순위: ${volume.length > 0 ? '✅ 정상' : '❌ 실패'} (${volume.length}개)`);
    console.log(`\n📊 총 확보 가능 종목: ${priceChange.length + volume.length}개 (KOSPI 단일 시장)`);
    console.log(`📊 양쪽 시장 합계: ${(priceChange.length + volume.length) * 2}개 (중복 제거 전)`);

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 실행
testFixedAPIs();
