/**
 * 점수 계산 시스템 테스트 (모의 데이터)
 * OBV/비대칭/VWAP 가중치 증가 + 고점 되돌림 페널티 검증
 */

const volumeIndicators = require('./backend/volumeIndicators');
const advancedIndicators = require('./backend/advancedIndicators');
const StockScreener = require('./backend/screening');

// 모의 차트 데이터 생성 (30일)
function generateMockChartData(scenario = 'bullish') {
  const data = [];
  let basePrice = 50000;
  let baseVolume = 1000000;

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    let priceChange = 0;
    let volumeChange = 1;

    // 시나리오별 패턴
    switch(scenario) {
      case 'bullish': // 상승 + OBV 상승
        priceChange = Math.random() * 0.03 + 0.01; // +1~4%
        volumeChange = 1 + Math.random() * 0.5; // 거래량 증가
        break;
      case 'accumulation': // 조용한 매집 (가격 횡보 + 거래량 증가)
        priceChange = (Math.random() - 0.5) * 0.02; // ±1%
        volumeChange = 1 + Math.random() * 0.8; // 거래량 큰 증가
        break;
      case 'drawdown': // 고점 대비 15% 되돌림
        if (i > 10) {
          priceChange = Math.random() * 0.02 + 0.01; // 상승
        } else {
          priceChange = -Math.random() * 0.03 - 0.01; // 하락
        }
        volumeChange = 1 + Math.random() * 0.3;
        break;
      case 'vwap_strong': // VWAP 상승세 강함
        priceChange = Math.random() * 0.04 + 0.02; // +2~6%
        volumeChange = 1 + Math.random() * 1.0; // 거래량 대폭 증가
        break;
    }

    basePrice = basePrice * (1 + priceChange);
    baseVolume = Math.floor(baseVolume * volumeChange);

    const open = basePrice;
    const close = basePrice;
    const high = basePrice * (1 + Math.random() * 0.01);
    const low = basePrice * (1 - Math.random() * 0.01);

    data.push({
      date: date.toISOString().split('T')[0].replace(/-/g, ''),
      open: Math.floor(open),
      high: Math.floor(high),
      low: Math.floor(low),
      close: Math.floor(close),
      volume: baseVolume
    });
  }

  return data.reverse(); // 최신 날짜부터
}

// 테스트 시나리오
const testScenarios = [
  {
    name: '📈 강세 종목 (OBV 상승 + VWAP 상승)',
    scenario: 'bullish',
    description: 'OBV 7점 + VWAP 5점 → 기대 점수 12점 이상'
  },
  {
    name: '🤫 조용한 매집 (비대칭 비율 높음)',
    scenario: 'accumulation',
    description: '비대칭 비율 5점 → 기대 점수 증가'
  },
  {
    name: '⚠️ 고점 대비 15% 되돌림',
    scenario: 'drawdown',
    description: '되돌림 페널티 -3점 → 기대 점수 감소'
  },
  {
    name: '🚀 VWAP 강세',
    scenario: 'vwap_strong',
    description: 'VWAP 5점 + 거래량 8점 → 기대 점수 13점 이상'
  }
];

console.log('========================================');
console.log('🧪 점수 계산 시스템 테스트');
console.log('========================================\n');

console.log('📊 변경 내역:');
console.log('  1. 거래량 비율: 12점 → 8점 (↓4)');
console.log('  2. OBV 추세: 5점 → 7점 (↑2)');
console.log('  3. VWAP 모멘텀: 3점 → 5점 (↑2)');
console.log('  4. 비대칭 비율: 0점 → 5점 (신규)');
console.log('  5. 고점 되돌림: 10% 이상 시 -2~-5점 (신규)\n');

console.log('========================================\n');

// 각 시나리오 테스트
for (const test of testScenarios) {
  console.log(`\n🎬 ${test.name}`);
  console.log(`   ${test.description}\n`);

  const chartData = generateMockChartData(test.scenario);
  const currentPrice = chartData[0].close;

  // 거래량 분석
  const volumeAnalysis = volumeIndicators.analyzeVolume(chartData);

  // 창의적 지표 분석
  const advancedAnalysis = advancedIndicators.analyzeAdvanced(chartData);

  // 기본 점수 계산 (NEW 시스템)
  const screener = new StockScreener.constructor();
  const baseScore = screener.calculateTotalScore(
    volumeAnalysis,
    advancedAnalysis,
    null,
    chartData,
    currentPrice
  );

  // 구성 요소 분석
  const volumeRatio = volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20;
  const obvTrend = volumeAnalysis.signals.obvTrend;
  const vwapSignal = volumeAnalysis.signals.priceVsVWAP;
  const asymmetricScore = advancedAnalysis.indicators.asymmetric?.score || 0;

  // 고점 대비 되돌림 계산
  const recentHigh = Math.max(...chartData.slice(0, 30).map(d => d.high));
  const drawdownPercent = ((recentHigh - currentPrice) / recentHigh) * 100;

  console.log('  📊 지표 분석:');
  console.log(`     거래량 비율: ${volumeRatio.toFixed(2)}배`);
  console.log(`     OBV 추세: ${obvTrend}`);
  console.log(`     VWAP 신호: ${vwapSignal}`);
  console.log(`     비대칭 점수: ${asymmetricScore.toFixed(1)}/50`);
  console.log(`     고점 대비: ${drawdownPercent.toFixed(1)}% 되돌림\n`);

  console.log('  🎯 점수 결과:');
  console.log(`     기본 점수 (0-20): ${baseScore}점`);

  // 예상 점수 범위
  let expectedMin = 0;
  let expectedMax = 20;

  if (test.scenario === 'bullish' || test.scenario === 'vwap_strong') {
    expectedMin = 10;
    expectedMax = 20;
  } else if (test.scenario === 'accumulation') {
    expectedMin = 5;
    expectedMax = 15;
  } else if (test.scenario === 'drawdown') {
    expectedMin = 0;
    expectedMax = 10;
  }

  console.log(`     예상 범위: ${expectedMin}-${expectedMax}점`);

  const isInRange = baseScore >= expectedMin && baseScore <= expectedMax;
  console.log(`     결과: ${isInRange ? '✅ 정상' : '⚠️ 범위 이탈'}\n`);

  console.log('  📈 점수 구성 (추정):');

  // 거래량 비율 점수 추정
  let volumeScore = 0;
  if (volumeRatio >= 5) volumeScore = 8;
  else if (volumeRatio >= 3) volumeScore = 5;
  else if (volumeRatio >= 2) volumeScore = 3;
  else if (volumeRatio >= 1.5) volumeScore = 1;

  // OBV 추세 점수
  let obvScore = 0;
  if (obvTrend.includes('상승')) obvScore = 7;
  else if (obvTrend.includes('횡보')) obvScore = 3;

  // VWAP 점수
  const vwapScore = vwapSignal === '상승세' ? 5 : 0;

  // 비대칭 점수
  const asymScore = Math.min(asymmetricScore / 10, 5);

  // 되돌림 페널티
  let drawdownPenalty = 0;
  if (drawdownPercent >= 20) drawdownPenalty = -5;
  else if (drawdownPercent >= 15) drawdownPenalty = -3;
  else if (drawdownPercent >= 10) drawdownPenalty = -2;

  console.log(`     거래량 비율: ${volumeScore}점`);
  console.log(`     OBV 추세: ${obvScore}점`);
  console.log(`     VWAP: ${vwapScore}점`);
  console.log(`     비대칭: ${asymScore.toFixed(1)}점`);
  console.log(`     되돌림 페널티: ${drawdownPenalty}점`);
  console.log(`     합계: ${(volumeScore + obvScore + vwapScore + asymScore + drawdownPenalty).toFixed(1)}점`);

  console.log('\n' + '─'.repeat(50));
}

console.log('\n\n✅ 테스트 완료!');
console.log('\n📋 결론:');
console.log('  1. OBV/VWAP 가중치 증가로 자금 흐름 중시');
console.log('  2. 비대칭 비율 추가로 매수세/매도세 측정');
console.log('  3. 되돌림 페널티로 고점 대비 10% 이상 하락 종목 감점');
console.log('  4. 거래량 과다 의존 완화 (12→8점)');
console.log('\n  → 선행 지표 중심으로 급등 예정 종목 발굴 최적화');
