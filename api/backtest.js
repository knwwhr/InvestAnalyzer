// Vercel Serverless Function
// GET /api/backtest?lookback=30&holding=7

const backtest = require('../backend/backtest');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🔍 백테스팅 API 호출:', req.query);

    const lookbackDays = parseInt(req.query.lookback) || 30;
    const holdingDays = parseInt(req.query.holding) || 7;
    const forceRefresh = req.query.refresh === 'true';

    // 캐시된 결과 사용 (Vercel 60초 타임아웃 대응)
    const result = await backtest.getCachedBacktest(forceRefresh);

    res.status(200).json({
      success: true,
      data: result,
      cached: !forceRefresh,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 백테스팅 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
