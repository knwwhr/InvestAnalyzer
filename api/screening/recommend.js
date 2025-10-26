// Vercel Serverless Function
// GET /api/screening/recommend

const screener = require('../../backend/screening');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { market = 'ALL', limit } = req.query;
    const limitNum = limit ? parseInt(limit) : undefined; // limit 없으면 전체 반환
    const result = await screener.screenAllStocks(market, limitNum);

    res.status(200).json({
      success: true,
      count: result.stocks.length,
      recommendations: result.stocks,
      metadata: result.metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Screening error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
