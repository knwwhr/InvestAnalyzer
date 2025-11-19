/**
 * 현재 가중치의 최대 점수 계산
 */

console.log('📊 Phase 1 (원본) 최대 점수 계산\n');

console.log('기본 점수 (0-20점):');
console.log('  거래량 비율: 0-8점');
console.log('  OBV 추세: 0-7점');
console.log('  VWAP 모멘텀: 0-5점');
console.log('  비대칭 비율: 0-5점');
console.log('  되돌림 페널티: -5~0점');
console.log('  → 최대: 8+7+5+5 = 25점 (페널티 없을 때)\n');

console.log('선행 지표 (Phase 1):');
console.log('  VPD: 0-25점');
console.log('  기관/외국인: 0-15점');
console.log('  Confluence: 0-12점');
console.log('  당일/전일 신호: 0-8점');
console.log('  선행 지표(패턴+DNA): 0-10점');
console.log('  Cup&Handle: 0-5점');
console.log('  돌파 확인: 0-3점');
console.log('  Triangle: 0-2점');
const phase1Max = 25+15+12+8+10+5+3+2;
console.log(`  → 최대: ${phase1Max}점\n`);

console.log(`총 최대 점수 (Phase 1): 20 + ${phase1Max} = ${20 + phase1Max}점`);
console.log(`(페널티 없을 때: 25 + ${phase1Max} = ${25 + phase1Max}점)\n`);

console.log('─────────────────────────────────\n');

console.log('📊 Phase 2 (수정) 최대 점수 계산\n');
console.log('선행 지표 (Phase 2):');
console.log('  VPD: 0-15점 (25→15, -10)');
console.log('  기관/외국인: 0-15점 (유지)');
console.log('  Confluence: 0-12점 (유지)');
console.log('  당일/전일 신호: 0-10점 (8→10, +2)');
console.log('  선행 지표(패턴+DNA): 0-30점 (10→30, +20)');
console.log('  Cup&Handle: 0-3점 (5→3, -2)');
console.log('  돌파 확인: 제거 (3→0, -3)');
console.log('  Triangle: 제거 (2→0, -2)');
const phase2Max = 15+15+12+10+30+3;
console.log(`  → 최대: ${phase2Max}점\n`);

console.log(`총 최대 점수 (Phase 2): 20 + ${phase2Max} = ${20 + phase2Max}점`);
console.log(`변화: ${20 + phase2Max - 100}점\n`);
