// Vercel Serverless Function
// GET /api/patterns/list
// 저장된 패턴 목록 조회

const patternMiner = require('../../backend/patternMining');

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
    const patterns = patternMiner.loadSavedPatterns();

    if (!patterns || patterns.length === 0) {
      return res.status(200).json({
        success: true,
        message: '저장된 패턴이 없습니다. 먼저 패턴 분석을 실행해주세요.',
        patterns: []
      });
    }

    res.status(200).json({
      success: true,
      count: patterns.length,
      patterns
    });

  } catch (error) {
    console.error('Pattern list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
