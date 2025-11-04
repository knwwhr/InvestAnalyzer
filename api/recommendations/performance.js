/**
 * 추천 종목 성과 조회 API
 * GET /api/recommendations/performance?days=30
 *
 * 저장된 추천 종목의 실시간 성과 추적
 */

const supabase = require('../../backend/supabaseClient');
const kisApi = require('../../backend/kisApi');

module.exports = async (req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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
    const days = parseInt(req.query.days) || 30;

    // 최근 N일 추천 종목 조회
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: recommendations, error } = await supabase
      .from('screening_recommendations')
      .select('*')
      .gte('recommendation_date', startDate.toISOString().slice(0, 10))
      .eq('is_active', true)
      .order('recommendation_date', { ascending: false })
      .order('total_score', { ascending: false });

    if (error) {
      console.error('Supabase 조회 실패:', error);
      return res.status(500).json({
        error: 'Database error',
        message: error.message
      });
    }

    if (!recommendations || recommendations.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        stocks: [],
        statistics: {
          totalRecommendations: 0,
          winningCount: 0,
          losingCount: 0,
          avgReturn: 0,
          winRate: 0
        }
      });
    }

    console.log(`📊 ${recommendations.length}개 추천 종목 성과 추적 중...`);

    // 현재 가격 조회 및 수익률 계산
    const stocksWithPerformance = await Promise.all(
      recommendations.map(async (rec) => {
        try {
          // 현재 가격 조회
          const currentData = await kisApi.getCurrentPrice(rec.stock_code);
          const currentPrice = currentData?.price || rec.recommended_price;

          // 수익률 계산
          const returnPct = rec.recommended_price > 0
            ? ((currentPrice - rec.recommended_price) / rec.recommended_price * 100)
            : 0;

          // 추천 이후 경과일
          const recDate = new Date(rec.recommendation_date);
          const today = new Date();
          const daysSince = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));

          // 날짜별 가격 데이터 조회 (Supabase에서)
          let dailyPrices = [];
          try {
            const { data: priceData, error: priceError } = await supabase
              .from('recommendation_daily_prices')
              .select('*')
              .eq('recommendation_id', rec.id)
              .order('price_date', { ascending: true });

            if (!priceError && priceData) {
              dailyPrices = priceData.map(p => ({
                date: p.price_date,
                price: p.close_price,
                return: rec.recommended_price > 0
                  ? ((p.close_price - rec.recommended_price) / rec.recommended_price * 100).toFixed(2)
                  : 0,
                volume: p.volume,
                high: p.high_price,
                low: p.low_price
              }));
            }
          } catch (priceErr) {
            console.warn(`일별 가격 조회 실패 [${rec.stock_code}]:`, priceErr.message);
          }

          // 연속 상승일 계산 (최근 5일 차트 데이터로 확인)
          let consecutiveRiseDays = 0;
          try {
            const chartData = await kisApi.getDailyChart(rec.stock_code, 5);
            if (chartData && chartData.length > 1) {
              for (let i = 0; i < chartData.length - 1; i++) {
                const today = chartData[i];
                const yesterday = chartData[i + 1];
                if (today.close > yesterday.close) {
                  consecutiveRiseDays++;
                } else {
                  break;
                }
              }
            }
          } catch (chartError) {
            console.warn(`차트 데이터 조회 실패 [${rec.stock_code}]:`, chartError.message);
          }

          return {
            ...rec,
            current_price: currentPrice,
            current_return: parseFloat(returnPct.toFixed(2)),
            days_since_recommendation: daysSince,
            consecutive_rise_days: consecutiveRiseDays,
            is_winning: returnPct > 0,
            is_rising: consecutiveRiseDays >= 2, // 2일 이상 연속 상승
            daily_prices: dailyPrices // 날짜별 가격 데이터 추가
          };
        } catch (error) {
          console.warn(`현재가 조회 실패 [${rec.stock_code}]:`, error.message);
          return {
            ...rec,
            current_price: rec.recommended_price,
            current_return: 0,
            days_since_recommendation: 0,
            consecutive_rise_days: 0,
            is_winning: false,
            is_rising: false,
            daily_prices: []
          };
        }
      })
    );

    // 통계 계산
    const winningStocks = stocksWithPerformance.filter(s => s.is_winning);
    const losingStocks = stocksWithPerformance.filter(s => !s.is_winning);
    const risingStocks = stocksWithPerformance.filter(s => s.is_rising);

    const avgReturn = stocksWithPerformance.length > 0
      ? stocksWithPerformance.reduce((sum, s) => sum + s.current_return, 0) / stocksWithPerformance.length
      : 0;

    const avgWinReturn = winningStocks.length > 0
      ? winningStocks.reduce((sum, s) => sum + s.current_return, 0) / winningStocks.length
      : 0;

    const avgLossReturn = losingStocks.length > 0
      ? losingStocks.reduce((sum, s) => sum + s.current_return, 0) / losingStocks.length
      : 0;

    const maxReturn = stocksWithPerformance.length > 0
      ? Math.max(...stocksWithPerformance.map(s => s.current_return))
      : 0;

    const minReturn = stocksWithPerformance.length > 0
      ? Math.min(...stocksWithPerformance.map(s => s.current_return))
      : 0;

    const winRate = stocksWithPerformance.length > 0
      ? (winningStocks.length / stocksWithPerformance.length * 100)
      : 0;

    console.log(`✅ 성과 추적 완료: 승률 ${winRate.toFixed(1)}%, 평균 수익률 ${avgReturn.toFixed(2)}%`);

    return res.status(200).json({
      success: true,
      count: stocksWithPerformance.length,
      stocks: stocksWithPerformance,
      statistics: {
        totalRecommendations: stocksWithPerformance.length,
        winningCount: winningStocks.length,
        losingCount: losingStocks.length,
        risingCount: risingStocks.length,
        avgReturn: parseFloat(avgReturn.toFixed(2)),
        avgWinReturn: parseFloat(avgWinReturn.toFixed(2)),
        avgLossReturn: parseFloat(avgLossReturn.toFixed(2)),
        maxReturn: parseFloat(maxReturn.toFixed(2)),
        minReturn: parseFloat(minReturn.toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1))
      }
    });

  } catch (error) {
    console.error('성과 조회 실패:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
