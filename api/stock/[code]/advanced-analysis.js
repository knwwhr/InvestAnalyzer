// Vercel Serverless Function
// GET /api/stock/[code]/advanced-analysis

const screener = require('../../../screening');

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
    const { code } = req.query;
    const analysis = await screener.analyzeStock(code);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: '종목 분석 실패'
      });
    }

    res.status(200).json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Stock analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
