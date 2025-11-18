/**
 * 백테스트 우승자 프로필 분석
 * 25-41점 (승률 89.3%) vs 58-88점 비교
 *
 * 목적: 왜 낮은 점수가 더 좋은 성과를 내는지 규명
 */

const fs = require('fs');
const path = require('path');

function analyzeWinnerProfile() {
  console.log('🔍 백테스트 우승자 프로필 분석\n');

  // 스냅샷 로드
  const snapshotPath = path.join(__dirname, 'backtest-stocks-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

  // 점수 범위별 분류
  const range25_41 = snapshot.stocks.filter(s => s.totalScore >= 25 && s.totalScore <= 41);
  const range42_57 = snapshot.stocks.filter(s => s.totalScore >= 42 && s.totalScore <= 57);
  const range58_88 = snapshot.stocks.filter(s => s.totalScore >= 58 && s.totalScore <= 88);

  console.log('📊 범위별 종목 수:\n');
  console.log(`   25-41점 (승률 89.3%): ${range25_41.length}개`);
  console.log(`   42-57점 (수익 +27.5%): ${range42_57.length}개`);
  console.log(`   58-88점 (승률 86.7%): ${range58_88.length}개\n`);

  // 지표별 평균 비교
  const indicators = [
    'baseScore',
    'vpdScore',
    'institutionalScore',
    'confluenceScore',
    'freshnessScore',
    'leadingScore',
    'cupHandleScore',
    'volumeRatio'
  ];

  console.log('📋 지표별 평균 비교:\n');
  console.log('지표                  25-41점(우승)  42-57점  58-88점');
  console.log('─'.repeat(60));

  indicators.forEach(indicator => {
    const avg25_41 = calcAvg(range25_41, indicator);
    const avg42_57 = calcAvg(range42_57, indicator);
    const avg58_88 = calcAvg(range58_88, indicator);

    const name = indicator.padEnd(20);
    const v1 = avg25_41.toFixed(2).padStart(6);
    const v2 = avg42_57.toFixed(2).padStart(6);
    const v3 = avg58_88.toFixed(2).padStart(6);

    // 최저값에 ⭐ 마크
    const values = [avg25_41, avg42_57, avg58_88];
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    let mark1 = avg25_41 === minVal ? ' ⬇️최저' : avg25_41 === maxVal ? ' ⬆️최고' : '';
    let mark2 = avg42_57 === minVal ? ' ⬇️최저' : avg42_57 === maxVal ? ' ⬆️최고' : '';
    let mark3 = avg58_88 === minVal ? ' ⬇️최저' : avg58_88 === maxVal ? ' ⬆️최고' : '';

    console.log(`${name}  ${v1}${mark1.padEnd(8)}  ${v2}${mark2.padEnd(8)}  ${v3}${mark3.padEnd(8)}`);
  });

  console.log('\n');

  // 핵심 인사이트
  console.log('🎯 핵심 인사이트:\n');

  const vpdDiff = calcAvg(range58_88, 'vpdScore') - calcAvg(range25_41, 'vpdScore');
  const volDiff = calcAvg(range58_88, 'volumeRatio') - calcAvg(range25_41, 'volumeRatio');
  const leadDiff = calcAvg(range58_88, 'leadingScore') - calcAvg(range25_41, 'leadingScore');

  console.log(`1️⃣ VPD 점수 차이: ${vpdDiff.toFixed(2)}점`);
  console.log(`   → 우승자(25-41)가 ${Math.abs(vpdDiff).toFixed(1)}점 ${vpdDiff > 0 ? '낮음' : '높음'}`);
  console.log(`   → ${vpdDiff > 0 ? '⚠️ VPD 높음 = 이미 급등 중!' : '✅ VPD 낮음 = 아직 조용함'}\n`);

  console.log(`2️⃣ 거래량 비율 차이: ${volDiff.toFixed(2)}배`);
  console.log(`   → 우승자(25-41)가 ${Math.abs(volDiff).toFixed(1)}배 ${volDiff > 0 ? '낮음' : '높음'}`);
  console.log(`   → ${volDiff > 0 ? '⚠️ 거래량 폭발 = 이미 움직임!' : '✅ 거래량 적당 = 초기 단계'}\n`);

  console.log(`3️⃣ 선행 지표 차이: ${leadDiff.toFixed(2)}점`);
  console.log(`   → 우승자(25-41)가 ${Math.abs(leadDiff).toFixed(1)}점 ${leadDiff > 0 ? '낮음' : '높음'}`);
  console.log(`   → ${leadDiff > 0 ? '⚠️ 패턴 명확 = 이미 포착됨!' : '✅ 패턴 약함 = 아직 초기'}\n`);

  // 결론
  console.log('🎉 결론:\n');
  console.log('❌ 현재 점수 체계는 **"이미 급등 중"** 종목에 높은 점수!');
  console.log('✅ 진짜 우승자는 **"조용하고 아직 안 움직인"** 종목!\n');

  console.log('💡 해결책:\n');
  console.log('1. VPD: 높은 값(25점) → 중간 값(10-15점)에 최고점');
  console.log('2. 거래량: 5배 폭발(8점) → 1.5-2배 적당(8점)');
  console.log('3. 선행 지표: 명확한 패턴(10점) → 약한 초기 신호(10점)');
  console.log('4. 또는: 등급 반전 (S=20-40점, A=41-57점, B=58-88점)\n');
}

function calcAvg(stocks, indicator) {
  if (stocks.length === 0) return 0;
  const sum = stocks.reduce((acc, s) => {
    const val = s.indicators?.[indicator] || 0;
    return acc + val;
  }, 0);
  return sum / stocks.length;
}

// 실행
analyzeWinnerProfile();
