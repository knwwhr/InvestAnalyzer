// Vercel Serverless Function
// GET /api/patterns/list
// 저장된 패턴 목록 조회

const smartPatternMiner = require('../../backend/smartPatternMining');

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
    // 패턴 캐시 정보 가져오기
    const patternCache = require('../../backend/patternCache');
    const cacheInfo = patternCache.getCacheInfo();

    const patterns = smartPatternMiner.loadSavedPatterns();

    if (!patterns || patterns.length === 0) {
      return res.status(200).json({
        success: true,
        message: '저장된 패턴이 없습니다. 먼저 패턴 분석을 실행해주세요.',
        patterns: []
      });
    }

    // 전체 캐시 데이터에서 메타데이터 가져오기
    const fullCache = patternCache.loadPatterns();

    res.status(200).json({
      success: true,
      count: patterns.length,
      patterns,
      generatedAt: fullCache?.generatedAt || null,
      parameters: fullCache?.parameters || null,
      cacheInfo: cacheInfo
    });

  } catch (error) {
    console.error('Pattern list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
