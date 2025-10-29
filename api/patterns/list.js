// Vercel Serverless Function
// GET /api/patterns/list
// 저장된 패턴 목록 조회

const smartPatternMiner = require('../../backend/smartPatternMining');
const gistStorage = require('../../backend/gistStorage');

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
    // 1순위: GitHub Gist에서 로드 (영구 저장소)
    let fullData = null;
    if (gistStorage.isConfigured()) {
      console.log('📥 GitHub Gist에서 패턴 로드 시도...');
      fullData = await gistStorage.loadPatterns();
      if (fullData && fullData.patterns) {
        console.log(`✅ GitHub Gist에서 ${fullData.patterns.length}개 패턴 로드 완료`);
      }
    }

    // 2순위: 메모리 캐시에서 로드 (Gist 실패 시 fallback)
    if (!fullData) {
      console.log('ℹ️ GitHub Gist 로드 실패, 메모리 캐시 사용');
      const patternCache = require('../../backend/patternCache');
      fullData = patternCache.loadPatterns();
    }

    // 3순위: smartPatternMiner에서 로드 (최종 fallback)
    if (!fullData) {
      console.log('ℹ️ 메모리 캐시도 없음, 로컬 데이터 확인');
      const patterns = smartPatternMiner.loadSavedPatterns();
      if (patterns && patterns.length > 0) {
        fullData = { patterns };
      }
    }

    // 패턴이 없는 경우
    if (!fullData || !fullData.patterns || fullData.patterns.length === 0) {
      return res.status(200).json({
        success: true,
        message: '저장된 패턴이 없습니다. 먼저 패턴 분석을 실행해주세요.',
        patterns: [],
        source: 'none'
      });
    }

    // 패턴 캐시 정보
    const patternCache = require('../../backend/patternCache');
    const cacheInfo = patternCache.getCacheInfo();

    res.status(200).json({
      success: true,
      count: fullData.patterns.length,
      patterns: fullData.patterns,
      generatedAt: fullData.generatedAt || null,
      parameters: fullData.parameters || null,
      cacheInfo: cacheInfo,
      source: gistStorage.isConfigured() ? 'gist' : 'cache'
    });

  } catch (error) {
    console.error('Pattern list error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
