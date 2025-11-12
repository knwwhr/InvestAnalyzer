/**
 * 추천 종목 일별 가격 업데이트 API
 * POST /api/recommendations/update-prices
 *
 * 활성 추천 종목의 오늘 종가를 기록 (Cron Job용)
 */

const { createClient } = require('@supabase/supabase-js');
const kisApi = require('../../backend/kisApi');

// Supabase 서비스 롤 클라이언트 (RLS 우회 가능)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

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
        // 현재가 조회 (실시간 시세)
        let closingPrice = rec.recommended_price; // 기본값
        let changeRate = 0;
        let volume = 0;

        const currentData = await kisApi.getCurrentPrice(rec.stock_code);

        if (currentData?.currentPrice) {
          // 실시간 시세 조회 성공 (장 시간)
          closingPrice = currentData.currentPrice;
          changeRate = currentData.changeRate || 0;
          volume = currentData.volume || 0;
        } else {
          // 폐장 시간 등으로 실시간 시세 조회 실패 → 최근 종가 조회
          console.log(`⏰ 실시간 시세 없음 [${rec.stock_code}] - 최근 종가 조회 중...`);
          try {
            // 2일치 데이터를 받아서 확실하게 종가 확보
            const chartData = await kisApi.getDailyChart(rec.stock_code, 2);
            if (chartData && chartData.length > 0) {
              // chartData는 내림차순 (최신 데이터가 첫 번째)
              closingPrice = chartData[0].close || rec.recommended_price;
              volume = chartData[0].volume || 0;
              // changeRate 계산 (전일 대비)
              if (chartData.length > 1 && chartData[1].close > 0) {
                const prevClose = chartData[1].close;
                changeRate = ((closingPrice - prevClose) / prevClose * 100);
              }
              console.log(`✅ 종가 조회 성공 [${rec.stock_code}]: ${closingPrice}원 (${chartData[0].date})`);
            } else {
              console.warn(`⚠️ 차트 데이터 없음 [${rec.stock_code}]`);
            }
          } catch (chartError) {
            console.warn(`❌ 종가 조회 실패 [${rec.stock_code}]:`, chartError.message);
          }
        }

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
          change_rate: parseFloat(changeRate.toFixed(2)),
          volume: volume,
          cumulative_return: parseFloat(cumulativeReturn.toFixed(2)),
          days_since_recommendation: daysSince
        });

        successCount++;

        // Rate limit 방지 (초당 8회 안전 마진)
        await new Promise(resolve => setTimeout(resolve, 120));

      } catch (error) {
        console.warn(`가격 조회 실패 [${rec.stock_code}]:`, error.message);
      }
    }

    // Supabase에 일괄 저장 (upsert = 있으면 업데이트, 없으면 삽입)
    if (dailyPrices.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('recommendation_daily_prices')
        .upsert(dailyPrices, {
          onConflict: 'recommendation_id,tracking_date',
          ignoreDuplicates: false  // 항상 최신 데이터로 업데이트
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
