/**
 * 매일 추천 종목 자동 저장 Cron
 *
 * 일정: 월-금 오후 4시 (장마감 후)
 * 목적: A등급(42점) 이상 종목을 Supabase에 자동 저장
 */

const screener = require('../../backend/screening');
const supabase = require('../../backend/supabaseClient');

module.exports = async (req, res) => {
  console.log('📊 일일 추천 종목 자동 저장 시작...\n');

  try {
    // Supabase 비활성화 체크
    if (!supabase) {
      console.log('⚠️ Supabase 미설정 - 저장 건너뜀');
      return res.status(200).json({
        success: false,
        message: 'Supabase not configured'
      });
    }

    // Step 1: 종합 스크리닝 (전체 종목)
    console.log('🔍 종합 스크리닝 실행 중...');
    const { stocks } = await screener.screenAllStocks('ALL');

    if (!stocks || stocks.length === 0) {
      console.log('⚠️ 추천 종목 없음');
      return res.status(200).json({
        success: true,
        saved: 0,
        message: 'No stocks to save'
      });
    }

    // Step 2: S등급(58점) 이상만 필터링
    const filteredStocks = stocks.filter(stock => {
      const grade = stock.recommendation?.grade;
      const score = stock.totalScore;

      // S등급(58-88)만 저장 (보수적 기준)
      return grade === 'S' && score >= 58;
    });

    console.log(`✅ 스크리닝 완료: ${stocks.length}개 중 ${filteredStocks.length}개 (S등급만)`);

    if (filteredStocks.length === 0) {
      return res.status(200).json({
        success: true,
        saved: 0,
        message: 'No S grade stocks found'
      });
    }

    // Step 3: Supabase에 저장
    const today = new Date().toISOString().slice(0, 10);

    const recommendations = filteredStocks.map(stock => ({
      recommendation_date: today,
      stock_code: stock.stockCode,
      stock_name: stock.stockName || stock.stockCode,
      recommended_price: stock.currentPrice || 0,
      recommendation_grade: stock.recommendation?.grade || 'D',
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

    const { data, error } = await supabase
      .from('screening_recommendations')
      .upsert(recommendations, {
        onConflict: 'recommendation_date,stock_code',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Supabase 저장 실패:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    console.log(`✅ ${data.length}개 추천 종목 저장 완료 (${today})`);
    console.log(`   등급: S(${filteredStocks.filter(s => s.recommendation.grade === 'S').length}개)\n`);

    return res.status(200).json({
      success: true,
      saved: data.length,
      date: today,
      grades: {
        S: filteredStocks.filter(s => s.recommendation.grade === 'S').length
      },
      recommendations: data.map(r => ({
        stockCode: r.stock_code,
        stockName: r.stock_name,
        grade: r.recommendation_grade,
        score: r.total_score
      }))
    });

  } catch (error) {
    console.error('❌ 일일 추천 저장 실패:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
