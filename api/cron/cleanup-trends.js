/**
 * 트렌드 데이터 자동 정리 (Vercel Cron)
 * 7일 이상 된 stock_trend_scores 데이터 삭제
 * 실행: 매일 새벽 3시 (KST)
 */

const supabase = require('../../backend/supabaseClient');

module.exports = async function handler(req, res) {
  // Vercel Cron 인증 (CRON_SECRET 환경변수로 보안 강화 가능)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'default-secret'}`) {
    console.warn('⚠️ Unauthorized cron request');
    // 보안상 에러 메시지를 자세히 주지 않음
  }

  console.log('\n🗑️  트렌드 데이터 정리 시작...\n');

  if (!supabase) {
    console.error('❌ Supabase 미설정');
    return res.status(500).json({
      success: false,
      error: 'Supabase not configured'
    });
  }

  try {
    // 7일 전 날짜 계산
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    console.log(`📅 삭제 기준: ${sevenDaysAgo.toISOString()} 이전 데이터`);

    // 1. 삭제 전 조회 (로깅용)
    const { data: oldRecords, error: selectError } = await supabase
      .from('stock_trend_scores')
      .select('stock_code, stock_name, updated_at')
      .lt('updated_at', sevenDaysAgo.toISOString());

    if (selectError) {
      throw new Error(`조회 실패: ${selectError.message}`);
    }

    const deleteCount = oldRecords ? oldRecords.length : 0;

    if (deleteCount === 0) {
      console.log('✅ 삭제할 데이터 없음\n');
      return res.status(200).json({
        success: true,
        deleted: 0,
        message: '삭제할 데이터가 없습니다.',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📊 삭제 대상: ${deleteCount}개 종목`);
    oldRecords.forEach((record, idx) => {
      console.log(`  ${idx + 1}. ${record.stock_name} (${record.stock_code}) - ${record.updated_at}`);
    });

    // 2. 7일 이상 된 데이터 삭제
    const { error: deleteError } = await supabase
      .from('stock_trend_scores')
      .delete()
      .lt('updated_at', sevenDaysAgo.toISOString());

    if (deleteError) {
      throw new Error(`삭제 실패: ${deleteError.message}`);
    }

    console.log(`\n✅ ${deleteCount}개 종목 데이터 삭제 완료\n`);

    return res.status(200).json({
      success: true,
      deleted: deleteCount,
      deletedStocks: oldRecords.map(r => ({
        code: r.stock_code,
        name: r.stock_name,
        updatedAt: r.updated_at
      })),
      cutoffDate: sevenDaysAgo.toISOString(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 트렌드 데이터 정리 실패:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
