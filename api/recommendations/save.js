/**
 * 추천 종목 저장 API
 * POST /api/recommendations/save
 *
 * 스크리닝 결과를 Supabase에 저장하여 성과 추적
 */

const supabase = require('../../backend/supabaseClient');

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
      error: 'Supabase not configured',
      message: 'SUPABASE_URL and SUPABASE_ANON_KEY environment variables required'
    });
  }

  try {
    const { stocks } = req.body;

    if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
      return res.status(400).json({ error: 'stocks 배열이 필요합니다' });
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 추천 데이터 변환
    const recommendations = stocks.map(stock => ({
      recommendation_date: today,
      stock_code: stock.stockCode,
      stock_name: stock.stockName || stock.stockCode,
      recommended_price: stock.currentPrice || 0,
      recommendation_grade: stock.recommendation?.grade || 'C',
      total_score: stock.totalScore || 0,

      // 추천 근거
      change_rate: stock.changeRate || 0,
      volume: stock.volume || 0,
      market_cap: stock.marketCap || 0,

      whale_detected: stock.advancedAnalysis?.indicators?.whale?.length > 0 || false,
      accumulation_detected: stock.advancedAnalysis?.indicators?.accumulation?.detected || false,
      mfi: stock.volumeAnalysis?.indicators?.mfi || 50,
      volume_ratio: stock.volumeAnalysis?.current?.volumeMA20
        ? (stock.volume / stock.volumeAnalysis.current.volumeMA20)
        : 0,

      is_active: true
    }));

    // Supabase에 저장 (중복 무시: UNIQUE constraint)
    const { data, error } = await supabase
      .from('screening_recommendations')
      .upsert(recommendations, {
        onConflict: 'recommendation_date,stock_code',
        ignoreDuplicates: false // 기존 데이터 업데이트
      })
      .select();

    if (error) {
      console.error('Supabase 저장 실패:', error);
      return res.status(500).json({
        error: 'Database error',
        message: error.message
      });
    }

    console.log(`✅ ${data.length}개 추천 종목 저장 완료 (${today})`);

    return res.status(200).json({
      success: true,
      saved: data.length,
      date: today,
      recommendations: data
    });

  } catch (error) {
    console.error('추천 저장 실패:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
