/**
 * 패턴 마이닝 테스트 스크립트
 * 실행: node test-pattern-mining.js
 */

const patternMiner = require('./backend/patternMining');

async function runTest() {
  console.log('🚀 패턴 마이닝 시스템 테스트 시작\n');
  console.log('=' .repeat(60));

  try {
    // 패턴 분석 실행 (최근 30일, 15% 이상 급등)
    const result = await patternMiner.analyzeSurgePatterns(30, 15);

    if (result) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 패턴 분석 완료!\n');

      console.log('📋 분석 결과 요약:');
      console.log(`  - 분석 기간: ${result.parameters.lookbackDays}일`);
      console.log(`  - 급등 기준: ${result.parameters.minReturn}%`);
      console.log(`  - 발견된 급등 종목: ${result.parameters.totalSurgeStocks}개`);
      console.log(`  - 추출된 패턴: ${result.patterns.length}개\n`);

      console.log('🏆 상위 패턴:');
      result.patterns.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.name}`);
        console.log(`   📊 출현율: ${p.frequency}% (${p.count}회)`);
        console.log(`   💰 평균 익일 수익률: +${p.avgReturn}%`);
        console.log(`   📌 샘플 종목: ${p.sampleStocks.join(', ')}`);
      });

      // JSON 파일로 저장
      const fs = require('fs');
      const savePath = './data/patterns.json';

      // data 폴더 생성 (없으면)
      if (!fs.existsSync('./data')) {
        fs.mkdirSync('./data');
      }

      // 저장 (rawData 제외 - 용량 절약)
      const saveData = {
        generatedAt: result.generatedAt,
        parameters: result.parameters,
        patterns: result.patterns
      };

      fs.writeFileSync(savePath, JSON.stringify(saveData, null, 2));
      console.log(`\n💾 결과 저장: ${savePath}`);

    } else {
      console.log('\n⚠️ 충분한 데이터가 없어 패턴을 추출할 수 없습니다.');
    }

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error);
    process.exit(1);
  }

  console.log('\n✅ 테스트 완료!\n');
  process.exit(0);
}

runTest();
