/**
 * 트렌드 점수 저장 테스트
 */

require('dotenv').config();
const supabase = require('./backend/supabaseClient');

async function testSaveTrendScore() {
  console.log('\n💾 트렌드 점수 저장 테스트\n');

  if (!supabase) {
    console.log('❌ Supabase 미설정\n');
    return;
  }

  const testScoreData = {
    stock_code: '005930',
    stock_name: '삼성전자',
    search_score: 0,
    search_surge: false,
    news_score: 38,
    mentions_24h: 9,
    mentions_7d: 9,
    mention_change_rate: 0,
    sentiment_score: 9.52,
    positive_ratio: 33.33,
    total_trend_score: 47.52,
    is_hot_issue: true
  };

  try {
    console.log('저장할 데이터:');
    console.log(JSON.stringify(testScoreData, null, 2));
    console.log();

    // 1. 기존 방식 (onConflict 사용)
    console.log('1️⃣  기존 방식 테스트 (onConflict)...\n');

    const { data: d1, error: e1 } = await supabase
      .from('stock_trend_scores')
      .upsert(testScoreData, {
        onConflict: 'stock_code,DATE(updated_at)',
        ignoreDuplicates: false
      })
      .select();

    if (e1) {
      console.error('❌ 에러:', e1.message);
      console.error('상세:', e1);
    } else {
      console.log('✅ 저장 성공:', d1);
    }

    // 2. 단순 upsert (onConflict 없이)
    console.log('\n2️⃣  단순 upsert 테스트...\n');

    const { data: d2, error: e2 } = await supabase
      .from('stock_trend_scores')
      .upsert(testScoreData)
      .select();

    if (e2) {
      console.error('❌ 에러:', e2.message);
      console.error('상세:', e2);
    } else {
      console.log('✅ 저장 성공:', d2);
    }

    // 3. 저장 확인
    console.log('\n3️⃣  저장 확인...\n');

    const { data: scores, error: e3 } = await supabase
      .from('stock_trend_scores')
      .select('*')
      .eq('stock_code', '005930')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (e3) {
      console.error('❌ 조회 에러:', e3.message);
    } else if (scores && scores.length > 0) {
      console.log('✅ 저장된 데이터:');
      console.log(JSON.stringify(scores[0], null, 2));
    } else {
      console.log('⚠️  저장된 데이터 없음');
    }

  } catch (error) {
    console.error('\n❌ 예외 발생:', error.message);
    console.error(error.stack);
  }

  console.log('\n========================================\n');
}

testSaveTrendScore().catch(console.error);
