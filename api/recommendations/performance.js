/**
 * 추천 종목 성과 조회 API
 * GET /api/recommendations/performance?days=30
 *
 * 저장된 추천 종목의 실시간 성과 추적
 */

const supabase = require('../../backend/supabaseClient');
const kisApi = require('../../backend/kisApi');

/**
 * 기하평균 수익률 계산 (복리 수익률)
 * @param {number[]} returns - 수익률 배열 (%)
 * @returns {number} 기하평균 수익률 (%)
 */
function calculateGeometricMean(returns) {
  if (!returns || returns.length === 0) return 0;

  // (1 + r1/100) × (1 + r2/100) × ... × (1 + rn/100)
  const product = returns.reduce((acc, r) => acc * (1 + r / 100), 1);

  // n제곱근 - 1
  const geometricMean = (Math.pow(product, 1 / returns.length) - 1) * 100;

  return geometricMean;
}

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

    // 현재 가격 조회 및 수익률 계산 (순차 처리로 rate limit 방지)
    const stocksWithPerformance = [];

    for (const rec of recommendations) {
      try {
        // 날짜별 가격 데이터 조회 (Supabase에서)
        let dailyPrices = [];
        let currentPrice = rec.recommended_price; // 기본값

        try {
          const { data: priceData, error: priceError } = await supabase
            .from('recommendation_daily_prices')
            .select('*')
            .eq('recommendation_id', rec.id)
            .order('tracking_date', { ascending: true });

          if (!priceError && priceData && priceData.length > 0) {
            // daily_prices 데이터 가공
            dailyPrices = priceData.map(p => ({
              date: p.tracking_date,
              price: p.closing_price,
              return: rec.recommended_price > 0
                ? ((p.closing_price - rec.recommended_price) / rec.recommended_price * 100).toFixed(2)
                : 0,
              volume: p.volume,
              cumulativeReturn: p.cumulative_return,
              daysSince: p.days_since_recommendation
            }));

            // 가장 최근 가격을 현재가로 사용 (KIS API 호출 제거)
            currentPrice = priceData[priceData.length - 1].closing_price;
          }
        } catch (priceErr) {
          console.warn(`일별 가격 조회 실패 [${rec.stock_code}]:`, priceErr.message);
        }

        // 수익률 계산
        const returnPct = rec.recommended_price > 0
          ? ((currentPrice - rec.recommended_price) / rec.recommended_price * 100)
          : 0;

        // 추천 이후 경과일
        const recDate = new Date(rec.recommendation_date);
        const today = new Date();
        const daysSince = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));

        // 연속 상승일 계산 (daily_prices 데이터에서)
        let consecutiveRiseDays = 0;
        if (dailyPrices.length > 1) {
          // 최신 데이터부터 역순으로 확인 (마지막 인덱스부터)
          for (let i = dailyPrices.length - 1; i > 0; i--) {
            const todayPrice = dailyPrices[i].price;
            const yesterdayPrice = dailyPrices[i - 1].price;
            if (todayPrice > yesterdayPrice) {
              consecutiveRiseDays++;
            } else {
              break;
            }
          }
        }

        stocksWithPerformance.push({
          ...rec,
          current_price: currentPrice,
          current_return: parseFloat(returnPct.toFixed(2)),
          days_since_recommendation: daysSince,
          consecutive_rise_days: consecutiveRiseDays,
          is_winning: returnPct > 0,
          is_rising: consecutiveRiseDays >= 2 && returnPct > 0, // 2일 이상 연속 상승 + 수익 중
          daily_prices: dailyPrices // 날짜별 가격 데이터 추가
        });

        // Supabase만 조회하므로 Rate limit 대기 불필요 (KIS API 호출 제거됨)

      } catch (error) {
        console.warn(`현재가 조회 실패 [${rec.stock_code}]:`, error.message);
        stocksWithPerformance.push({
          ...rec,
          current_price: rec.recommended_price,
          current_return: 0,
          days_since_recommendation: 0,
          consecutive_rise_days: 0,
          is_winning: false,
          is_rising: false,
          daily_prices: []
        });
      }
    }

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

    // 카테고리별 성과 계산
    const categoryStats = {
      whale: { label: '🐋 고래 감지', stocks: [], count: 0, winRate: 0, avgReturn: 0, maxReturn: 0 },
      accumulation: { label: '🤫 조용한 매집', stocks: [], count: 0, winRate: 0, avgReturn: 0, maxReturn: 0 },
      both: { label: '🔥 고래 + 매집', stocks: [], count: 0, winRate: 0, avgReturn: 0, maxReturn: 0 },
      normal: { label: '📊 일반', stocks: [], count: 0, winRate: 0, avgReturn: 0, maxReturn: 0 }
    };

    stocksWithPerformance.forEach(stock => {
      if (stock.whale_detected && stock.accumulation_detected) {
        categoryStats.both.stocks.push(stock);
      } else if (stock.whale_detected) {
        categoryStats.whale.stocks.push(stock);
      } else if (stock.accumulation_detected) {
        categoryStats.accumulation.stocks.push(stock);
      } else {
        categoryStats.normal.stocks.push(stock);
      }
    });

    Object.keys(categoryStats).forEach(key => {
      const stats = categoryStats[key];
      stats.count = stats.stocks.length;
      if (stats.count > 0) {
        const winningCount = stats.stocks.filter(s => s.is_winning).length;
        stats.winRate = parseFloat((winningCount / stats.count * 100).toFixed(1));
        // 기하평균 계산 (복리 수익률)
        const returns = stats.stocks.map(s => s.current_return);
        stats.avgReturn = parseFloat(calculateGeometricMean(returns).toFixed(2));
        stats.maxReturn = parseFloat(Math.max(...stats.stocks.map(s => s.current_return)).toFixed(2));
      }
      delete stats.stocks; // 응답에서 stocks 제거 (중복)
    });

    // 추천일자별 그룹화
    const byRecommendationDate = {};
    stocksWithPerformance.forEach(stock => {
      const date = stock.recommendation_date;
      if (!byRecommendationDate[date]) {
        byRecommendationDate[date] = {
          date,
          stocks: [],
          avgReturn: 0,
          winRate: 0
        };
      }
      byRecommendationDate[date].stocks.push({
        stock_code: stock.stock_code,
        stock_name: stock.stock_name || stock.stock_code, // 종목명 fallback
        recommendation_grade: stock.recommendation_grade,
        total_score: stock.total_score, // 정렬용
        recommended_price: stock.recommended_price,
        current_price: stock.current_price,
        current_return: stock.current_return,
        daily_prices: stock.daily_prices,
        consecutive_rise_days: stock.consecutive_rise_days,
        is_winning: stock.is_winning,
        is_rising: stock.is_rising
      });
    });

    // 각 추천일별 통계 계산 + 정렬
    Object.values(byRecommendationDate).forEach(dateGroup => {
      // ⭐ 등급순 정렬 (S → A → B → C → D, 같은 등급 내에서는 점수순)
      const gradeOrder = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
      dateGroup.stocks.sort((a, b) => {
        const gradeCompare = (gradeOrder[a.recommendation_grade] || 99) - (gradeOrder[b.recommendation_grade] || 99);
        if (gradeCompare !== 0) return gradeCompare;
        return (b.total_score || 0) - (a.total_score || 0); // 같은 등급이면 점수순
      });

      const winningCount = dateGroup.stocks.filter(s => s.is_winning).length;
      dateGroup.winRate = parseFloat((winningCount / dateGroup.stocks.length * 100).toFixed(1));
      // 기하평균 계산 (복리 수익률)
      const returns = dateGroup.stocks.map(s => s.current_return);
      dateGroup.avgReturn = parseFloat(calculateGeometricMean(returns).toFixed(2));

      // ⭐ 등급별 통계 추가
      const byGrade = {};
      dateGroup.stocks.forEach(stock => {
        const grade = stock.recommendation_grade;
        if (!byGrade[grade]) {
          byGrade[grade] = { count: 0, winCount: 0, returns: [] };
        }
        byGrade[grade].count++;
        if (stock.is_winning) byGrade[grade].winCount++;
        byGrade[grade].returns.push(stock.current_return);
      });

      dateGroup.byGrade = {};
      Object.entries(byGrade).forEach(([grade, data]) => {
        dateGroup.byGrade[grade] = {
          count: data.count,
          winRate: parseFloat((data.winCount / data.count * 100).toFixed(1)),
          avgReturn: parseFloat(calculateGeometricMean(data.returns).toFixed(2))
        };
      });
    });

    // 추천일자별 정렬 (최신순)
    const recommendationDates = Object.values(byRecommendationDate).sort((a, b) =>
      new Date(b.date) - new Date(a.date)
    );

    // 공통 추천 종목 찾기 (2회 이상 추천된 종목)
    const stockFrequency = {};
    stocksWithPerformance.forEach(stock => {
      const key = stock.stock_code;
      if (!stockFrequency[key]) {
        stockFrequency[key] = {
          stock_code: stock.stock_code,
          stock_name: stock.stock_name,
          recommendation_count: 0,
          recommendation_dates: [],
          avg_return: 0,
          returns: []
        };
      }
      stockFrequency[key].recommendation_count++;
      stockFrequency[key].recommendation_dates.push(stock.recommendation_date);
      stockFrequency[key].returns.push(stock.current_return);
    });

    // 2회 이상 추천된 종목만 필터링
    const commonStocks = Object.values(stockFrequency)
      .filter(s => s.recommendation_count >= 2)
      .map(s => ({
        ...s,
        // 기하평균 계산 (복리 수익률)
        avg_return: parseFloat(calculateGeometricMean(s.returns).toFixed(2))
      }))
      .sort((a, b) => b.recommendation_count - a.recommendation_count || b.avg_return - a.avg_return);

    console.log(`✅ 성과 추적 완료: 승률 ${winRate.toFixed(1)}%, 평균 수익률 ${avgReturn.toFixed(2)}%`);

    return res.status(200).json({
      success: true,
      count: stocksWithPerformance.length,
      stocks: stocksWithPerformance,
      recommendationDates, // 추천일자별 그룹화 추가
      commonStocks, // 공통 추천 종목 추가
      risingStocks, // 연속 급등주 추가 (기존 로직 유지)
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
        winRate: parseFloat(winRate.toFixed(1)),
        byCategory: categoryStats // 카테고리별 성과 추가
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
