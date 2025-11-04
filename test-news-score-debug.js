/**
 * 뉴스 점수 계산 디버깅
 */

require('dotenv').config();
const trendScoring = require('./backend/trendScoring');
const supabase = require('./backend/supabaseClient');

async function testNewsScoreDebug() {
  console.log('\n🔍 뉴스 점수 계산 디버깅\n');

  const stockCode = '005930';

  try {
    // 1. 직접 Supabase 쿼리
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    console.log(`현재 시간: ${now.toISOString()}`);
    console.log(`24시간 전: ${oneDayAgo.toISOString()}`);
    console.log(`7일 전: ${sevenDaysAgo.toISOString()}\n`);

    // 24시간 내 뉴스
    const { data: news24h, error: e1 } = await supabase
      .from('news_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('stock_code', stockCode)
      .gte('published_at', oneDayAgo.toISOString());

    console.log(`직접 쿼리 - 24시간 내 뉴스: ${news24h?.length || 0}개`);
    if (e1) console.error('에러:', e1);

    // 7일 내 뉴스
    const { data: news7d, error: e2 } = await supabase
      .from('news_mentions')
      .select('id', { count: 'exact', head: true })
      .eq('stock_code', stockCode)
      .gte('published_at', sevenDaysAgo.toISOString());

    console.log(`직접 쿼리 - 7일 내 뉴스: ${news7d?.length || 0}개\n`);
    if (e2) console.error('에러:', e2);

    // 2. trendScoring.calculateNewsScore 호출
    console.log('📊 trendScoring.calculateNewsScore 호출...\n');
    const scoreResult = await trendScoring.calculateNewsScore(stockCode);

    console.log('결과:');
    console.log(`  점수: ${scoreResult.score}점`);
    console.log(`  24시간 언급: ${scoreResult.mentions24h || 0}개`);
    console.log(`  7일 언급: ${scoreResult.mentions7d || 0}개`);
    console.log(`  변화율: ${scoreResult.changeRate || 0}%\n`);

    // 3. 전체 뉴스 조회 (디버깅용)
    const { data: allNews } = await supabase
      .from('news_mentions')
      .select('*')
      .eq('stock_code', stockCode)
      .order('published_at', { ascending: false });

    if (allNews && allNews.length > 0) {
      console.log(`전체 뉴스: ${allNews.length}개\n`);
      console.log('최근 뉴스 목록:');
      allNews.forEach((news, idx) => {
        const hoursAgo = Math.floor((now - new Date(news.published_at)) / (1000 * 60 * 60));
        const is24h = hoursAgo < 24;
        console.log(`  ${idx + 1}. ${news.news_title.substring(0, 40)}...`);
        console.log(`     발행: ${news.published_at} (${hoursAgo}시간 전) ${is24h ? '✅' : '❌'}`);
      });
    }

  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    console.error(error.stack);
  }

  console.log('\n========================================\n');
}

testNewsScoreDebug().catch(console.error);
