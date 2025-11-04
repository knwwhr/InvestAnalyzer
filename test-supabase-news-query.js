/**
 * Supabase 뉴스 쿼리 디버깅
 */

require('dotenv').config();
const supabase = require('./backend/supabaseClient');

async function testNewsQuery() {
  console.log('\n🔍 Supabase 뉴스 조회 테스트\n');

  if (!supabase) {
    console.log('❌ Supabase 미설정\n');
    return;
  }

  try {
    // 1. 전체 뉴스 조회
    const { data: allNews, error: e1 } = await supabase
      .from('news_mentions')
      .select('*')
      .order('collected_at', { ascending: false })
      .limit(10);

    if (e1) throw e1;

    console.log(`📰 전체 뉴스 개수: ${allNews.length}개\n`);

    if (allNews.length > 0) {
      console.log('최근 뉴스 샘플:');
      allNews.slice(0, 3).forEach((news, idx) => {
        console.log(`\n${idx + 1}. ${news.stock_name} (${news.stock_code})`);
        console.log(`   제목: ${news.news_title.substring(0, 50)}...`);
        console.log(`   발행일: ${news.published_at}`);
        console.log(`   수집일: ${news.collected_at}`);
        console.log(`   감성: ${news.sentiment || '미분석'} (${news.impact_score || 0}점)`);
      });
    }

    // 2. 삼성전자 뉴스 조회
    console.log('\n\n🔍 삼성전자 뉴스 조회...\n');
    const { data: samsungNews, error: e2 } = await supabase
      .from('news_mentions')
      .select('*')
      .eq('stock_code', '005930')
      .order('published_at', { ascending: false });

    if (e2) throw e2;

    console.log(`삼성전자 전체 뉴스: ${samsungNews.length}개`);

    // 3. 24시간 이내 뉴스 조회
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`24시간 기준: ${oneDayAgo.toISOString()}\n`);

    const { data: recent24h, error: e3 } = await supabase
      .from('news_mentions')
      .select('*')
      .eq('stock_code', '005930')
      .gte('published_at', oneDayAgo.toISOString());

    if (e3) throw e3;

    console.log(`삼성전자 24시간 내 뉴스: ${recent24h.length}개`);

    if (recent24h.length > 0) {
      console.log('\n24시간 내 뉴스 목록:');
      recent24h.forEach((news, idx) => {
        const hoursAgo = Math.floor((Date.now() - new Date(news.published_at)) / (1000 * 60 * 60));
        console.log(`  ${idx + 1}. ${news.news_title.substring(0, 40)}... (${hoursAgo}시간 전)`);
      });
    } else {
      console.log('\n⚠️  24시간 내 뉴스가 없습니다.');
      if (samsungNews.length > 0) {
        console.log('\n가장 최근 뉴스:');
        const latest = samsungNews[0];
        const hoursAgo = Math.floor((Date.now() - new Date(latest.published_at)) / (1000 * 60 * 60));
        console.log(`  제목: ${latest.news_title}`);
        console.log(`  발행일: ${latest.published_at} (${hoursAgo}시간 전)`);
      }
    }

    // 4. 감성 분석된 뉴스 조회
    console.log('\n\n🤖 감성 분석 완료된 뉴스...\n');
    const { data: analyzedNews, error: e4 } = await supabase
      .from('news_mentions')
      .select('*')
      .not('sentiment', 'is', null);

    if (e4) throw e4;

    console.log(`감성 분석 완료: ${analyzedNews.length}개`);

    if (analyzedNews.length > 0) {
      const sentimentCount = {
        positive: analyzedNews.filter(n => n.sentiment === 'positive').length,
        neutral: analyzedNews.filter(n => n.sentiment === 'neutral').length,
        negative: analyzedNews.filter(n => n.sentiment === 'negative').length
      };

      console.log(`  긍정: ${sentimentCount.positive}개`);
      console.log(`  중립: ${sentimentCount.neutral}개`);
      console.log(`  부정: ${sentimentCount.negative}개`);
    }

  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    console.error(error);
  }

  console.log('\n========================================\n');
}

testNewsQuery().catch(console.error);
