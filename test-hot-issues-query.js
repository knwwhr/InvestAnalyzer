/**
 * HOT 이슈 조회 디버깅
 */

require('dotenv').config();
const supabase = require('./backend/supabaseClient');

async function testHotIssuesQuery() {
  console.log('\n🔥 HOT 이슈 조회 디버깅\n');

  if (!supabase) {
    console.log('❌ Supabase 미설정\n');
    return;
  }

  try {
    // 1. stock_trend_scores 테이블에서 직접 조회
    const { data: scores, error: e1 } = await supabase
      .from('stock_trend_scores')
      .select('*')
      .eq('is_hot_issue', true)
      .order('total_trend_score', { ascending: false });

    console.log(`📊 stock_trend_scores 테이블 (is_hot_issue=true): ${scores?.length || 0}개\n`);

    if (scores && scores.length > 0) {
      scores.forEach((stock, idx) => {
        console.log(`${idx + 1}. ${stock.stock_name} (${stock.stock_code})`);
        console.log(`   총점: ${stock.total_trend_score}점`);
        console.log(`   뉴스: ${stock.news_score}점 (${stock.mentions_24h}개)`);
        console.log(`   감성: ${stock.sentiment_score}점 (긍정 ${stock.positive_ratio}%)`);
        console.log(`   업데이트: ${stock.updated_at}\n`);
      });
    }

    // 2. hot_issue_stocks 뷰에서 조회
    const { data: hotIssues, error: e2 } = await supabase
      .from('hot_issue_stocks')
      .select('*')
      .order('total_trend_score', { ascending: false });

    console.log(`🔥 hot_issue_stocks 뷰: ${hotIssues?.length || 0}개\n`);

    if (e2) {
      console.error('뷰 조회 에러:', e2.message);
      console.error('상세:', e2);
    }

    if (hotIssues && hotIssues.length > 0) {
      hotIssues.forEach((stock, idx) => {
        console.log(`${idx + 1}. ${stock.stock_name} (${stock.stock_code})`);
        console.log(`   총점: ${stock.total_trend_score}점`);
        console.log(`   검색 급증: ${stock.surge_detected || false}\n`);
      });
    } else if (scores && scores.length > 0 && (!hotIssues || hotIssues.length === 0)) {
      console.log('⚠️  stock_trend_scores에는 HOT 이슈가 있지만 hot_issue_stocks 뷰에는 없습니다.');
      console.log('    뷰 정의에 문제가 있을 수 있습니다.\n');
    }

  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    console.error(error.stack);
  }

  console.log('========================================\n');
}

testHotIssuesQuery().catch(console.error);
