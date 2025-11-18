/**
 * 가중치 재조정 검증 스크립트
 *
 * 목적:
 * 1. 고정된 종목 리스트를 새로운 가중치로 재분석
 * 2. 기존 점수 vs 신규 점수 비교
 * 3. 우수 종목(25-41, 42-57)이 S등급(58-88)으로 상승했는지 검증
 */

const screener = require('./backend/screening');
const fs = require('fs');
const path = require('path');

async function retestWithNewWeights() {
  console.log('🔄 가중치 재조정 검증 시작\n');

  try {
    // Step 1: 고정된 종목 리스트 로드
    const snapshotPath = path.join(__dirname, 'backtest-stocks-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

    console.log(`📂 고정 종목 로드: ${snapshot.totalStocks}개`);
    console.log(`   캡처 시각: ${snapshot.capturedAt}\n`);

    // Step 2: 각 종목을 새로운 가중치로 재분석
    console.log('🔍 새로운 가중치로 재분석 시작...\n');

    const results = [];
    let analyzed = 0;

    for (const stock of snapshot.stocks) {
      try {
        const newAnalysis = await screener.analyzeStock(stock.stockCode);
        analyzed++;

        if (newAnalysis) {
          results.push({
            stockCode: stock.stockCode,
            stockName: stock.stockName,
            oldScore: stock.totalScore,
            newScore: newAnalysis.totalScore,
            scoreDiff: newAnalysis.totalScore - stock.totalScore,
            oldGrade: stock.grade,
            newGrade: newAnalysis.recommendation.grade,
            gradeChanged: stock.grade !== newAnalysis.recommendation.grade
          });

          const arrow = newAnalysis.totalScore > stock.totalScore ? '⬆️' :
                       newAnalysis.totalScore < stock.totalScore ? '⬇️' : '→';
          console.log(`✅ [${analyzed}/${snapshot.totalStocks}] ${stock.stockName}`);
          console.log(`   ${stock.grade}등급 ${stock.totalScore}점 → ${newAnalysis.recommendation.grade}등급 ${newAnalysis.totalScore.toFixed(1)}점 ${arrow} (${newAnalysis.totalScore - stock.totalScore > 0 ? '+' : ''}${(newAnalysis.totalScore - stock.totalScore).toFixed(1)}점)`);
        }

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ 재분석 실패 [${stock.stockCode}]:`, error.message);
      }
    }

    console.log('\n✅ 재분석 완료!\n');

    // Step 3: 결과 분석
    console.log('📊 가중치 재조정 효과 분석\n');

    // 3-1. 전체 점수 변화
    const avgOldScore = results.reduce((sum, r) => sum + r.oldScore, 0) / results.length;
    const avgNewScore = results.reduce((sum, r) => sum + r.newScore, 0) / results.length;
    const avgScoreDiff = avgNewScore - avgOldScore;

    console.log('1️⃣ 전체 점수 변화:');
    console.log(`   평균 점수: ${avgOldScore.toFixed(2)}점 → ${avgNewScore.toFixed(2)}점 (${avgScoreDiff > 0 ? '+' : ''}${avgScoreDiff.toFixed(2)}점)\n`);

    // 3-2. 우수 종목 (구 25-41, 42-57) 점수 변화
    const old25_41 = results.filter(r => r.oldScore >= 25 && r.oldScore <= 41);
    const old42_57 = results.filter(r => r.oldScore >= 42 && r.oldScore <= 57);

    console.log('2️⃣ 우수 종목 점수 상승 검증:\n');

    if (old25_41.length > 0) {
      const avg25_41_old = old25_41.reduce((sum, r) => sum + r.oldScore, 0) / old25_41.length;
      const avg25_41_new = old25_41.reduce((sum, r) => sum + r.newScore, 0) / old25_41.length;
      const becameS = old25_41.filter(r => r.newScore >= 58 && r.newScore <= 88).length;

      console.log(`🎯 구 25-41점 범위 (${old25_41.length}개) - 승률 89.3%, 평균 +24.9%`);
      console.log(`   평균 점수: ${avg25_41_old.toFixed(2)}점 → ${avg25_41_new.toFixed(2)}점 (${avg25_41_new > avg25_41_old ? '+' : ''}${(avg25_41_new - avg25_41_old).toFixed(2)}점)`);
      console.log(`   S등급 진입: ${becameS}개 (${(becameS / old25_41.length * 100).toFixed(1)}%)\n`);

      // 상세 목록
      console.log('   📋 상세:');
      old25_41.forEach(r => {
        const marker = r.newScore >= 58 && r.newScore <= 88 ? '⭐ S등급!' : '';
        console.log(`      ${r.stockName}: ${r.oldScore.toFixed(1)} → ${r.newScore.toFixed(1)}점 (${r.oldGrade}→${r.newGrade}) ${marker}`);
      });
      console.log('');
    }

    if (old42_57.length > 0) {
      const avg42_57_old = old42_57.reduce((sum, r) => sum + r.oldScore, 0) / old42_57.length;
      const avg42_57_new = old42_57.reduce((sum, r) => sum + r.newScore, 0) / old42_57.length;
      const becameS = old42_57.filter(r => r.newScore >= 58 && r.newScore <= 88).length;

      console.log(`🎯 구 42-57점 범위 (${old42_57.length}개) - 승률 77.8%, 평균 +27.5%`);
      console.log(`   평균 점수: ${avg42_57_old.toFixed(2)}점 → ${avg42_57_new.toFixed(2)}점 (${avg42_57_new > avg42_57_old ? '+' : ''}${(avg42_57_new - avg42_57_old).toFixed(2)}점)`);
      console.log(`   S등급 진입: ${becameS}개 (${(becameS / old42_57.length * 100).toFixed(1)}%)\n`);

      // 상세 목록
      console.log('   📋 상세:');
      old42_57.forEach(r => {
        const marker = r.newScore >= 58 && r.newScore <= 88 ? '⭐ S등급!' : '';
        console.log(`      ${r.stockName}: ${r.oldScore.toFixed(1)} → ${r.newScore.toFixed(1)}점 (${r.oldGrade}→${r.newGrade}) ${marker}`);
      });
      console.log('');
    }

    // 3-3. 등급 변화 요약
    console.log('3️⃣ 등급 변화 요약:\n');
    const gradeChanges = results.filter(r => r.gradeChanged);
    const upgrades = gradeChanges.filter(r => {
      const gradeOrder = { 'D': 0, 'B': 1, 'A': 2, 'S': 3, 'C': 4 };
      return gradeOrder[r.newGrade] > gradeOrder[r.oldGrade];
    });

    console.log(`   등급 변화: ${gradeChanges.length}개 (${(gradeChanges.length / results.length * 100).toFixed(1)}%)`);
    console.log(`   등급 상승: ${upgrades.length}개\n`);

    // 등급별 분포
    const newGradeCount = {
      S: results.filter(r => r.newGrade === 'S').length,
      A: results.filter(r => r.newGrade === 'A').length,
      B: results.filter(r => r.newGrade === 'B').length,
      C: results.filter(r => r.newGrade === 'C').length,
      D: results.filter(r => r.newGrade === 'D').length
    };

    console.log('   신규 등급 분포:');
    console.log(`      S등급: ${newGradeCount.S}개`);
    console.log(`      A등급: ${newGradeCount.A}개`);
    console.log(`      B등급: ${newGradeCount.B}개`);
    console.log(`      C등급: ${newGradeCount.C}개`);
    console.log(`      D등급: ${newGradeCount.D}개\n`);

    // Step 4: 결과 저장
    const outputPath = path.join(__dirname, 'weight-adjustment-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        totalStocks: results.length,
        avgScoreChange: avgScoreDiff,
        avgOldScore,
        avgNewScore,
        gradeChanges: gradeChanges.length,
        upgrades: upgrades.length
      },
      old25_41: old25_41.length > 0 ? {
        count: old25_41.length,
        avgOldScore: old25_41.reduce((sum, r) => sum + r.oldScore, 0) / old25_41.length,
        avgNewScore: old25_41.reduce((sum, r) => sum + r.newScore, 0) / old25_41.length,
        becameSGrade: old25_41.filter(r => r.newScore >= 58 && r.newScore <= 88).length
      } : null,
      old42_57: old42_57.length > 0 ? {
        count: old42_57.length,
        avgOldScore: old42_57.reduce((sum, r) => sum + r.oldScore, 0) / old42_57.length,
        avgNewScore: old42_57.reduce((sum, r) => sum + r.newScore, 0) / old42_57.length,
        becameSGrade: old42_57.filter(r => r.newScore >= 58 && r.newScore <= 88).length
      } : null,
      newGradeDistribution: newGradeCount,
      detailedResults: results
    }, null, 2));

    console.log(`📁 결과 저장: ${outputPath}\n`);

    // Step 5: 결론
    console.log('🎉 결론:\n');
    const successRate25_41 = old25_41.length > 0
      ? (old25_41.filter(r => r.newScore >= 58 && r.newScore <= 88).length / old25_41.length * 100)
      : 0;
    const successRate42_57 = old42_57.length > 0
      ? (old42_57.filter(r => r.newScore >= 58 && r.newScore <= 88).length / old42_57.length * 100)
      : 0;

    if (successRate25_41 >= 50 || successRate42_57 >= 50) {
      console.log('✅ 성공! 우수 종목들이 S등급으로 상승했습니다!');
      console.log(`   25-41점 범위 → S등급: ${successRate25_41.toFixed(1)}%`);
      console.log(`   42-57점 범위 → S등급: ${successRate42_57.toFixed(1)}%`);
      console.log('\n👉 다음 단계: 커밋 및 배포');
    } else {
      console.log('⚠️ 부분 성공: 일부 종목만 S등급으로 상승했습니다.');
      console.log(`   25-41점 범위 → S등급: ${successRate25_41.toFixed(1)}%`);
      console.log(`   42-57점 범위 → S등급: ${successRate42_57.toFixed(1)}%`);
      console.log('\n👉 추가 가중치 조정이 필요할 수 있습니다.');
    }

  } catch (error) {
    console.error('❌ 검증 실패:', error);
    console.error(error.stack);
  }
}

// 실행
retestWithNewWeights();
