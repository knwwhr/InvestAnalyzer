/**
 * 과거 추천 종목 일별 가격 소급 저장 API
 * POST /api/recommendations/backfill
 *
 * 활성 추천 종목의 추천일부터 오늘까지 일별 가격 데이터를 소급해서 저장
 */

const { createClient } = require('@supabase/supabase-js');
const kisApi = require('../../backend/kisApi');

// Supabase 서비스 롤 클라이언트 (RLS 우회)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * 날짜 문자열을 Date 객체로 변환
 */
function parseDate(dateStr) {
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  } else {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }
}

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
    console.log('\n📊 과거 추천 종목 일별 가격 소급 저장 시작...\n');

    // 1. 활성 추천 종목 조회
    const { data: recommendations, error: fetchError } = await supabase
      .from('screening_recommendations')
      .select('*')
      .eq('is_active', true)
      .order('recommendation_date', { ascending: false });

    if (fetchError) {
      console.error('추천 조회 실패:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!recommendations || recommendations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active recommendations',
        inserted: 0
      });
    }

    console.log(`활성 추천: ${recommendations.length}개`);

    // 2. 각 종목별로 과거 데이터 채우기
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const rec of recommendations) {
      try {
        const recDate = parseDate(rec.recommendation_date);
        const today = new Date();
        const daysSince = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));

        // 당일 추천은 스킵 (이미 update-prices로 처리됨)
        if (daysSince === 0) {
          totalSkipped++;
          continue;
        }

        console.log(`[${rec.stock_code}] ${rec.stock_name} - ${daysSince}일 전 추천`);

        // 3. 일봉 데이터 조회
        const chartDays = Math.min(daysSince + 2, 30);
        const chartData = await kisApi.getDailyChart(rec.stock_code, chartDays);

        if (!chartData || chartData.length === 0) {
          console.log(`  ⚠️ 차트 데이터 없음`);
          totalSkipped++;
          continue;
        }

        // 4. 추천일 이후 데이터만 필터링
        const filteredData = chartData.filter(d => {
          const chartDate = parseDate(d.date);
          return chartDate >= recDate;
        });

        if (filteredData.length === 0) {
          console.log(`  ⚠️ 추천일 이후 데이터 없음`);
          totalSkipped++;
          continue;
        }

        // 5. 일별 가격 데이터 생성
        const dailyPrices = filteredData.map((dayData, idx) => {
          const trackingDate = dayData.date; // YYYYMMDD
          const formattedDate = trackingDate.slice(0, 4) + '-' + trackingDate.slice(4, 6) + '-' + trackingDate.slice(6, 8);

          const trackingDateObj = parseDate(formattedDate);
          const daysSinceRec = Math.floor((trackingDateObj - recDate) / (1000 * 60 * 60 * 24));

          // 전일 대비 변화율
          let changeRate = 0;
          if (idx + 1 < filteredData.length) {
            const prevClose = filteredData[idx + 1].close;
            if (prevClose > 0) {
              changeRate = ((dayData.close - prevClose) / prevClose * 100);
            }
          }

          // 누적 수익률
          const cumulativeReturn = rec.recommended_price > 0
            ? ((dayData.close - rec.recommended_price) / rec.recommended_price * 100)
            : 0;

          return {
            recommendation_id: rec.id,
            tracking_date: formattedDate,
            closing_price: dayData.close,
            change_rate: parseFloat(changeRate.toFixed(2)),
            volume: dayData.volume || 0,
            cumulative_return: parseFloat(cumulativeReturn.toFixed(2)),
            days_since_recommendation: daysSinceRec
          };
        });

        // 6. Supabase에 저장
        if (dailyPrices.length > 0) {
          const { error: insertError } = await supabase
            .from('recommendation_daily_prices')
            .upsert(dailyPrices, {
              onConflict: 'recommendation_id,tracking_date',
              ignoreDuplicates: false
            });

          if (insertError) {
            console.log(`  ❌ 저장 실패: ${insertError.message}`);
            totalFailed++;
          } else {
            console.log(`  ✅ ${dailyPrices.length}일치 저장`);
            totalInserted += dailyPrices.length;
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 120));

      } catch (error) {
        console.warn(`[${rec.stock_code}] 오류:`, error.message);
        totalFailed++;
      }
    }

    console.log(`\n✅ 소급 저장 완료: ${totalInserted}건 (스킵 ${totalSkipped}, 실패 ${totalFailed})\n`);

    return res.status(200).json({
      success: true,
      total: recommendations.length,
      inserted: totalInserted,
      skipped: totalSkipped,
      failed: totalFailed
    });

  } catch (error) {
    console.error('소급 저장 실패:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
