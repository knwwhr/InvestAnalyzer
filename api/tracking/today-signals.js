/**
 * 오늘 신호 추적 API
 * GET /api/tracking/today-signals?limit=5
 *
 * 용도: 실전 소량 테스트용 - 오늘 S/A 등급 5종목 추출
 */

const backtestEngine = require('../../backend/backtestEngine');

module.exports = async (req, res) => {
  console.log('\n========================================');
  console.log('🎯 오늘 신호 추적 대상 추출');
  console.log('========================================\n');

  try {
    const limit = parseInt(req.query.limit) || 5;

    const signals = await backtestEngine.getTodaySignals(limit);

    res.status(200).json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      count: signals.length,
      signals: signals.map(s => ({
        stockCode: s.stockCode,
        stockName: s.stockName,
        grade: s.grade,
        score: s.score,
        currentPrice: s.currentPrice,
        todayChange: s.todayChange,
        signalDate: s.signalDate,
        expectedSurgeDays: s.expectedSurgeDays,
        indicators: s.indicators,
        trackingPlan: {
          buyPrice: s.currentPrice,
          targetDate: this.addDays(new Date(), s.expectedSurgeDays || 10),
          stopLoss: (s.currentPrice * 0.95).toFixed(0), // -5%
          takeProfit1: (s.currentPrice * 1.12).toFixed(0), // +12%
          takeProfit2: (s.currentPrice * 1.20).toFixed(0)  // +20%
        }
      })),
      instructions: [
        '1. 장 마감 10분 전 (14:50) 매수 실행',
        '2. 스톱로스 -5% 자동 주문 설정',
        '3. +12% 달성 시 50% 익절',
        '4. +20% 달성 시 30% 익절',
        '5. D+10일 전량 매도',
        '6. 매일 결과 기록 (스프레드시트 권장)'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('신호 추출 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }

  addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result.toISOString().split('T')[0];
  }
};
