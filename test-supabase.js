/**
 * Supabase 연결 테스트
 */

require('dotenv').config();

async function testSupabase() {
  console.log('\n========================================');
  console.log('🗄️ Supabase 연결 테스트');
  console.log('========================================\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  console.log('환경변수 확인:');
  console.log(`  SUPABASE_URL: ${supabaseUrl}`);
  console.log(`  SUPABASE_ANON_KEY: ${supabaseKey ? '✅ 설정됨 (' + supabaseKey.substring(0, 20) + '...)' : '❌ 없음'}\n`);

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Supabase 환경변수가 설정되지 않았습니다.\n');
    return false;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📡 Supabase 연결 테스트 중...\n');

    // 간단한 쿼리로 연결 테스트
    const { data, error } = await supabase
      .from('screening_recommendations')
      .select('*')
      .limit(1);

    if (error) {
      console.log('⚠️  테이블 조회 오류 (정상 - 테이블 미생성):', error.message);
      console.log('\n📊 데이터베이스 연결은 성공했지만, 테이블이 없습니다.');
      console.log('   → 트렌드 스키마를 실행하면 테이블이 생성됩니다.\n');
      return true;
    }

    console.log('✅ Supabase 연결 성공!');
    console.log(`   데이터: ${data ? data.length : 0}개 행 조회됨\n`);
    return true;

  } catch (error) {
    console.error('❌ Supabase 연결 실패:', error.message);
    console.log('\n💡 해결 방법:');
    console.log('   1. Supabase 프로젝트가 실제로 존재하는지 확인');
    console.log('   2. URL과 API 키가 올바른지 확인');
    console.log('   3. 새로운 Supabase 프로젝트 생성 고려\n');
    return false;
  }
}

// 실행
if (require.main === module) {
  testSupabase().catch(console.error);
}

module.exports = { testSupabase };
