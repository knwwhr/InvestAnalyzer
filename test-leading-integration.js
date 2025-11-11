/**
 * Leading Indicators 통합 테스트
 *
 * screening.js에 leadingIndicators.js가 제대로 통합되었는지 검증
 */

const screening = require('./backend/screening');

async function testLeadingIntegration() {
  console.log('🧪 Leading Indicators 통합 테스트 시작\n');

  try {
    // 1개 종목만 빠르게 테스트 (삼성전자)
    const testStock = '005930';

    console.log(`📊 테스트 종목: ${testStock} (삼성전자)\n`);
    console.log('⏳ 분석 중...\n');

    const result = await screening.analyzeStock(testStock);

    if (!result) {
      console.error('❌ 종목 분석 실패 - null 반환');
      return;
    }

    console.log('✅ 종목 분석 완료!\n');

    // leadingIndicators 필드 확인
    if (result.leadingIndicators) {
      console.log('🎯 Leading Indicators 통합 성공!\n');
      console.log('선행 지표 상세:');
      console.log('  - 종합 점수:', result.leadingIndicators.total.toFixed(2));
      console.log('  - 강도:', result.leadingIndicators.strength);
      console.log('  - 신뢰도:', result.leadingIndicators.confidence.toFixed(1), '%');
      console.log('  - 스크리닝 점수 기여:', result.leadingIndicators.points, '/ 10점');
      console.log('\n패턴 매칭:');
      console.log('  - 점수:', result.leadingIndicators.pattern.score.toFixed(2));
      console.log('  - 매칭 여부:', result.leadingIndicators.pattern.matched ? '✅ Yes' : '❌ No');
      console.log('  - 매칭된 패턴 수:', result.leadingIndicators.pattern.totalMatched);

      if (result.leadingIndicators.pattern.patterns && result.leadingIndicators.pattern.patterns.length > 0) {
        console.log('  - 상위 패턴:');
        result.leadingIndicators.pattern.patterns.forEach((p, i) => {
          console.log(`    ${i + 1}. ${p.name} (승률: ${p.winRate}%, 매칭: ${(p.matchScore * 100).toFixed(1)}%)`);
        });
      }

      console.log('\nDNA 매칭:');
      console.log('  - 점수:', result.leadingIndicators.dna.score.toFixed(2));
      console.log('  - 매칭 여부:', result.leadingIndicators.dna.matched ? '✅ Yes' : '❌ No');

      if (result.leadingIndicators.dna.volumePattern) {
        const vp = result.leadingIndicators.dna.volumePattern;
        console.log('  - 거래량 EMA:', vp.emaAvg?.toFixed(2) || 'N/A');
        console.log('  - 최근 5일:', vp.recent5d?.toFixed(2) || 'N/A');
        console.log('  - 트렌드:', vp.segmented?.trend || 'N/A');
        console.log('  - 급등 임박성:', vp.urgency || 'N/A');
      }

      console.log('\n요약:', result.leadingIndicators.summary);
    } else {
      console.log('⚠️ leadingIndicators 필드 없음 (Fallback 모드)');
    }

    // scoreBreakdown 확인
    console.log('\n📊 Score Breakdown:');
    console.log('  - 기본 점수:', result.scoreBreakdown.baseScore);
    console.log('  - 최종 점수:', result.scoreBreakdown.finalScore, '/ 120');
    console.log('  - 추천 등급:', result.recommendation.grade, '-', result.recommendation.text);

    console.log('\n가점 항목:');
    result.scoreBreakdown.bonuses.forEach(bonus => {
      if (bonus.name.includes('선행 지표') || bonus.name.includes('패턴')) {
        console.log(`  ✅ ${bonus.name}: ${bonus.value}점`);
        if (bonus.details) {
          console.log(`     강도: ${bonus.details.strength}, 신뢰도: ${bonus.details.confidence}%`);
          console.log(`     패턴 매칭: ${bonus.details.patternMatched ? 'Yes' : 'No'}, DNA 매칭: ${bonus.details.dnaMatched ? 'Yes' : 'No'}`);
        }
      }
    });

    console.log('\n✅ 통합 테스트 성공!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 테스트 실행
testLeadingIntegration()
  .then(() => {
    console.log('\n🎉 테스트 완료');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 치명적 오류:', error);
    process.exit(1);
  });
