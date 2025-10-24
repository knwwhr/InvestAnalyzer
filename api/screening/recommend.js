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
    const { market = 'ALL', limit = '10' } = req.query;
    const recommendations = await screener.screenAllStocks(market, parseInt(limit));

    res.status(200).json({
      success: true,
      count: recommendations.length,
      recommendations,
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
