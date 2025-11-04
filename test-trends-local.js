/**
 * 로컬 트렌드 수집 테스트
 */

require('dotenv').config();

async function testTrendCollection() {
  console.log('\n========================================');
  console.log('🔍 트렌드 수집 로컬 테스트');
  console.log('========================================\n');

  try {
    // 1. Google Trends 테스트
    console.log('1️⃣ Google Trends 수집 테스트...');
    const trendCollector = require('./backend/trendCollector');

    const testStock = {
      stockCode: '005930',
      stockName: '삼성전자'
    };

    console.log(`   테스트 종목: ${testStock.stockName} (${testStock.stockCode})`);

    const trendResult = await trendCollector.collectStockTrend(
      testStock.stockCode,
      testStock.stockName
    );

    console.log('   ✅ Google Trends 결과:', {
      searchValue: trendResult.search_value,
      changeRate: trendResult.change_rate,
      surgeDetected: trendResult.surge_detected
    });

    // 2. 네이버 뉴스 테스트
    console.log('\n2️⃣ 네이버 뉴스 수집 테스트...');
    const newsCollector = require('./backend/newsCollector');

    const newsResults = await newsCollector.searchStockNews(
      testStock.stockCode,
      testStock.stockName,
      5
    );

    console.log(`   ✅ 네이버 뉴스 결과: ${newsResults.length}개 뉴스 수집`);
    if (newsResults.length > 0) {
      console.log(`   첫 번째 뉴스: ${newsResults[0].news_title.substring(0, 50)}...`);
    }

    // 3. 감성 분석 테스트
    console.log('\n3️⃣ Gemini AI 감성 분석 테스트...');
    const sentimentAnalyzer = require('./backend/sentimentAnalyzer');

    if (newsResults.length > 0) {
      const sentimentResult = await sentimentAnalyzer.analyzeSentiment(
        newsResults[0].news_title,
        testStock.stockName
      );

      console.log('   ✅ 감성 분석 결과:', {
        sentiment: sentimentResult.sentiment,
        impactScore: sentimentResult.impact_score,
        keywords: sentimentResult.keywords
      });
    }

    console.log('\n✅ 모든 테스트 성공!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세 에러:', error);
    process.exit(1);
  }
}

// 실행
testTrendCollection().catch(console.error);
