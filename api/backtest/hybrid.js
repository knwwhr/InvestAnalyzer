/**
 * 하이브리드 백테스트 API
 * GET /api/backtest/hybrid?stockCode=005930&signalDate=20251020&holdDays=10
 */

const backtestEngine = require('../../backend/backtestEngine');

module.exports = async (req, res) => {
  console.log('\n========================================');
  console.log('📊 하이브리드 백테스트 실행');
  console.log('========================================\n');

  try {
    const { stockCode, signalDate, holdDays = 10 } = req.query;

    if (!stockCode || !signalDate) {
      return res.status(400).json({
        success: false,
        error: 'stockCode와 signalDate 파라미터 필요'
      });
    }

    console.log(`종목: ${stockCode}, 신호일: ${signalDate}, 보유: ${holdDays}일`);

    const result = await backtestEngine.backtestSingleStockHybrid(
      stockCode,
      signalDate,
      parseInt(holdDays)
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    res.status(200).json({
      success: true,
      backtest: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('백테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
