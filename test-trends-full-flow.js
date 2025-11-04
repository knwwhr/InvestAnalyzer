/**
 * 트렌드 시스템 전체 워크플로우 테스트
 * 1. 뉴스 수집
 * 2. 감성 분석
 * 3. 점수 계산
 * 4. HOT 이슈 조회
 */

require('dotenv').config();
const newsCollector = require('./backend/newsCollector');
const sentimentAnalyzer = require('./backend/sentimentAnalyzer');
const trendScoring = require('./backend/trendScoring');

async function testFullFlow() {
  console.log('\n========================================');
  console.log('🔍 트렌드 시스템 전체 테스트');
  console.log('========================================\n');

  // 환경변수 확인
  console.log('📋 환경변수 확인:');
  console.log(`  NAVER_CLIENT_ID: ${process.env.NAVER_CLIENT_ID ? '✅' : '❌'}`);
  console.log(`  NAVER_CLIENT_SECRET: ${process.env.NAVER_CLIENT_SECRET ? '✅' : '❌'}`);
  console.log(`  GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);
  console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`  SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅' : '❌'}\n`);

  try {
    // 1️⃣ 뉴스 수집
    console.log('1️⃣  뉴스 수집 테스트...\n');
    const testStocks = [
      { stockCode: '005930', stockName: '삼성전자' },
      { stockCode: '000660', stockName: 'SK하이닉스' }
    ];

    const newsResult = await newsCollector.collectBatch(testStocks, 3);
    console.log(`✅ 뉴스 수집 완료: ${newsResult.totalNews}개\n`);

    if (newsResult.totalNews === 0) {
      console.log('❌ 뉴스가 수집되지 않았습니다. 종료합니다.\n');
      return;
    }

    // 2️⃣ 감성 분석
    console.log('2️⃣  감성 분석 테스트...\n');
    const sentimentResult = await sentimentAnalyzer.analyzeBatchStocks(testStocks);
    console.log(`✅ 감성 분석 완료: ${sentimentResult.totalNewsAnalyzed}개\n`);

    // 3️⃣ 트렌드 점수 계산
    console.log('3️⃣  트렌드 점수 계산...\n');
    const scoreResults = await trendScoring.calculateBatchScores(testStocks);
    console.log(`✅ 점수 계산 완료: ${scoreResults.length}개\n`);

    if (scoreResults.length > 0) {
      console.log('📊 점수 결과:');
      scoreResults.forEach(score => {
        console.log(`  ${score.stock_name}: ${score.total_trend_score}점 (${score.is_hot_issue ? '🔥 HOT' : '⚪'})`);
        console.log(`    - 뉴스: ${score.news_score}점 (${score.mentions_24h}개)`);
        console.log(`    - 감성: ${score.sentiment_score}점 (긍정 ${score.positive_ratio}%)`);
      });
      console.log();
    }

    // 4️⃣ HOT 이슈 조회
    console.log('4️⃣  HOT 이슈 조회...\n');
    const hotIssues = await trendScoring.getHotIssueStocks();
    console.log(`✅ HOT 이슈: ${hotIssues.length}개\n`);

    if (hotIssues.length > 0) {
      console.log('🔥 HOT 이슈 목록:');
      hotIssues.slice(0, 5).forEach((stock, index) => {
        console.log(`  ${index + 1}. ${stock.stock_name} (${stock.stock_code})`);
        console.log(`     점수: ${stock.total_trend_score}점`);
        console.log(`     뉴스: ${stock.mentions_24h}개 (변화율: ${stock.mention_change_rate}%)`);
        console.log(`     감성: ${stock.positive_ratio}% 긍정\n`);
      });
    }

    console.log('========================================');
    console.log('✅ 전체 테스트 완료!');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 실행
testFullFlow().catch(console.error);
