// Vercel Serverless Function with Dynamic Route
// GET /api/screening/[category]

const screener = require('../../backend/screening');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { category } = req.query;
    const market = req.query.market || 'ALL';
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;

    const result = await screener.screenByCategory(category, market, limit);

    res.status(200).json({
      success: true,
      category,
      count: result.stocks.length,
      recommendations: result.stocks,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Category screening error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
