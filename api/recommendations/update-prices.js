/**
 * 추천 종목 일별 가격 업데이트 API
 * POST /api/recommendations/update-prices
 *
 * 활성 추천 종목의 오늘 종가를 기록 (Cron Job용)
 */

const supabase = require('../../backend/supabaseClient');
const kisApi = require('../../backend/kisApi');

module.exports = async (req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Supabase 비활성화 시
  if (!supabase) {
    return res.status(503).json({
      error: 'Supabase not configured'
    });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

    console.log(`\n📊 [${today}] 추천 종목 가격 업데이트 시작...\n`);

    // 활성 추천 종목 조회
    const { data: activeRecs, error: fetchError } = await supabase
      .from('screening_recommendations')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      console.error('활성 추천 조회 실패:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!activeRecs || activeRecs.length === 0) {
      console.log('활성 추천 종목 없음');
      return res.status(200).json({
        success: true,
        updated: 0,
        message: 'No active recommendations'
      });
    }

    console.log(`활성 추천: ${activeRecs.length}개`);

    // 각 종목 가격 조회 및 저장
    const dailyPrices = [];
    let successCount = 0;

    for (const rec of activeRecs) {
      try {
        // 현재가 조회
        const currentData = await kisApi.getCurrentPrice(rec.stock_code);
        const closingPrice = currentData?.price || rec.recommended_price;

        // 경과일 계산
        const recDate = new Date(rec.recommendation_date);
        const todayDate = new Date(today);
        const daysSince = Math.floor((todayDate - recDate) / (1000 * 60 * 60 * 24));

        // 누적 수익률 계산
        const cumulativeReturn = rec.recommended_price > 0
          ? ((closingPrice - rec.recommended_price) / rec.recommended_price * 100)
          : 0;

        // 일별 가격 데이터
        dailyPrices.push({
          recommendation_id: rec.id,
          tracking_date: today,
          closing_price: closingPrice,
          change_rate: currentData?.changeRate || 0,
          volume: currentData?.volume || 0,
          cumulative_return: parseFloat(cumulativeReturn.toFixed(2)),
          days_since_recommendation: daysSince
        });

        successCount++;

        // Rate limit 방지 (초당 18회)
        await new Promise(resolve => setTimeout(resolve, 60));

      } catch (error) {
        console.warn(`가격 조회 실패 [${rec.stock_code}]:`, error.message);
      }
    }

    // Supabase에 일괄 저장
    if (dailyPrices.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('recommendation_daily_prices')
        .upsert(dailyPrices, {
          onConflict: 'recommendation_id,tracking_date',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('일별 가격 저장 실패:', insertError);
        return res.status(500).json({ error: insertError.message });
      }
    }

    console.log(`\n✅ 가격 업데이트 완료: ${successCount}/${activeRecs.length}개\n`);

    return res.status(200).json({
      success: true,
      date: today,
      total: activeRecs.length,
      updated: successCount,
      failed: activeRecs.length - successCount
    });

  } catch (error) {
    console.error('가격 업데이트 실패:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
