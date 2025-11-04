/**
 * 감성 분석만 단독 테스트
 */

require('dotenv').config();
const sentimentAnalyzer = require('./backend/sentimentAnalyzer');

async function testSentimentOnly() {
  console.log('\n🤖 감성 분석 단독 테스트\n');

  const testStocks = [
    { stockCode: '005930', stockName: '삼성전자' },
    { stockCode: '000660', stockName: 'SK하이닉스' }
  ];

  try {
    const result = await sentimentAnalyzer.analyzeBatchStocks(testStocks);

    console.log('\n📊 결과:');
    console.log(`  전체 종목: ${result.totalStocks}개`);
    console.log(`  분석 완료: ${result.totalNewsAnalyzed}개 뉴스\n`);

    if (result.results.length > 0) {
      console.log('종목별 상세:');
      result.results.forEach(r => {
        console.log(`\n  ${r.stockName} (${r.stockCode})`);
        console.log(`    분석: ${r.analyzed || 0}개`);
        if (r.results) {
          console.log(`    긍정: ${r.results.positive || 0}개`);
          console.log(`    중립: ${r.results.neutral || 0}개`);
          console.log(`    부정: ${r.results.negative || 0}개`);
          console.log(`    평균 영향도: ${r.results.avgImpact || 0}점`);
        }
      });
    }

  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    console.error(error.stack);
  }

  console.log('\n========================================\n');
}

testSentimentOnly().catch(console.error);
