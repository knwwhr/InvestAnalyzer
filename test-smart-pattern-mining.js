/**
 * 스마트 패턴 마이닝 테스트
 * 3단계 필터링 방식 검증
 */

const smartPatternMiner = require('./backend/smartPatternMining');

async function testSmartPatternMining() {
  console.log('🧠 스마트 패턴 마이닝 테스트 시작...\n');

  try {
    const result = await smartPatternMiner.analyzeSmartPatterns();

    if (!result) {
      console.log('⚠️ 패턴을 찾지 못했습니다.');
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 최종 결과 요약');
    console.log('='.repeat(60));
    console.log(`\n생성 시각: ${result.generatedAt}`);
    console.log(`\nPhase 1: 거래량 증가율 상위 ${result.parameters.phase1Candidates}개`);
    console.log(`Phase 2: 10거래일 대비 +${result.parameters.phase2MinReturn}% 이상 상승`);
    console.log(`Phase 3: 고가 대비 -${result.parameters.phase3PullbackThreshold}% 이상 되돌림 제외`);
    console.log(`\n✅ 최종 선별: ${result.parameters.totalQualified}개 종목`);
    console.log(`✅ 발견된 패턴: ${result.patterns.length}개\n`);

    console.log('🏆 상위 패턴 목록:\n');
    result.patterns.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   승률: ${p.backtest.winRate}%`);
      console.log(`   평균 수익률: +${p.backtest.avgReturn}%`);
      console.log(`   출현 빈도: ${p.frequency}% (${p.count}/${result.parameters.totalQualified})`);
      console.log(`   샘플 수: ${p.backtest.totalSamples}개\n`);
    });

    console.log('='.repeat(60));
    console.log('✅ 테스트 완료!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 실행
testSmartPatternMining();
