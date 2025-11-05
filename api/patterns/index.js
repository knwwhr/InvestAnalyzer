// Vercel Serverless Function
// /api/patterns - 통합 패턴 API
// POST: 패턴 분석 실행
// GET (no query): 패턴 목록 조회
// GET?pattern=xxx: 특정 패턴 매칭 종목

const smartPatternMiner = require('../../backend/smartPatternMining');
const patternCache = require('../../backend/patternCache');
const gistStorage = require('../../backend/gistStorage');
const screener = require('../../backend/screening');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // POST: 패턴 분석 실행
    if (req.method === 'POST') {
      return await handleAnalyze(req, res);
    }

    // GET: 패턴 목록 또는 매칭 종목
    if (req.method === 'GET') {
      const { pattern } = req.query;

      if (pattern) {
        // 매칭 종목 조회
        return await handleMatchedStocks(req, res);
      } else {
        // 패턴 목록 조회
        return await handleList(req, res);
      }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });

  } catch (error) {
    console.error('Patterns API error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// POST: 패턴 분석 실행
async function handleAnalyze(req, res) {
  console.log(`🔍 스마트 패턴 분석 시작 (3단계 필터링)`);

  const result = await smartPatternMiner.analyzeSmartPatterns();

  if (!result) {
    return res.status(400).json({
      success: false,
      error: '충분한 데이터가 없어 패턴을 추출할 수 없습니다.'
    });
  }

  // 결과를 메모리 캐시에 저장
  const saveData = {
    generatedAt: result.generatedAt,
    parameters: result.parameters,
    stocks: result.stocks,
    patterns: result.patterns  // 빈 배열 (하위 호환성)
  };

  patternCache.savePatterns(saveData);

  // GitHub Gist에 영구 저장
  if (gistStorage.isConfigured()) {
    console.log('💾 GitHub Gist에 패턴 저장 시도...');
    const gistSaved = await gistStorage.savePatterns(saveData);
    if (gistSaved) {
      console.log('✅ GitHub Gist 저장 성공');
    } else {
      console.log('⚠️ GitHub Gist 저장 실패 (메모리 캐시 사용)');
    }
  } else {
    console.log('⚠️ GitHub Gist 미설정 (GITHUB_GIST_ID 환경변수 필요)');
  }

  // 로컬 파일 저장 시도
  try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(process.cwd(), 'data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const savePath = path.join(dataDir, 'patterns.json');
    fs.writeFileSync(savePath, JSON.stringify(saveData, null, 2));
    console.log(`✅ 로컬 파일 저장 성공: ${savePath}`);
  } catch (fsError) {
    console.log('ℹ️ 로컬 파일 저장 생략 (Serverless 환경)');
  }

  console.log(`✅ D-5 선행 지표 분석 완료: ${result.stocks.length}개 급등 종목 발견`);

  res.status(200).json({
    success: true,
    message: 'D-5 선행 지표 분석이 완료되었습니다.',
    generatedAt: result.generatedAt,
    parameters: result.parameters,
    stocksFound: result.stocks.length,
    stocks: result.stocks,
    patterns: result.patterns
  });
}

// GET: 패턴 목록 조회
async function handleList(req, res) {
  // 1순위: GitHub Gist
  let fullData = null;
  if (gistStorage.isConfigured()) {
    console.log('📥 GitHub Gist에서 패턴 로드 시도...');
    fullData = await gistStorage.loadPatterns();
    if (fullData && fullData.patterns) {
      console.log(`✅ GitHub Gist에서 ${fullData.patterns.length}개 패턴 로드 완료`);
    }
  }

  // 2순위: 메모리 캐시
  if (!fullData) {
    console.log('ℹ️ GitHub Gist 로드 실패, 메모리 캐시 사용');
    fullData = patternCache.loadPatterns();
  }

  // 3순위: smartPatternMiner
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
}

// GET?pattern=xxx: 매칭 종목 조회
async function handleMatchedStocks(req, res) {
  const { pattern, market = 'ALL', limit } = req.query;

  if (!pattern) {
    return res.status(400).json({
      success: false,
      error: 'pattern 파라미터가 필요합니다.'
    });
  }

  // 저장된 패턴 로드
  const savedPatterns = await smartPatternMiner.loadSavedPatternsAsync();
  const targetPattern = savedPatterns.find(p => p.key === pattern);

  if (!targetPattern) {
    return res.status(404).json({
      success: false,
      error: `패턴 '${pattern}'을 찾을 수 없습니다.`,
      availablePatterns: savedPatterns.map(p => p.key)
    });
  }

  console.log(`🔍 패턴 매칭 종목 검색: ${pattern} (${targetPattern.name})`);

  // 제한적 스크리닝 (타임아웃 방지: 최대 20개)
  const result = await screener.screenAllStocks(market, 20, true);

  // 완전 매칭 종목
  const matchedStocks = result.stocks.filter(stock => {
    const patternMatch = stock.patternMatch;
    if (!patternMatch || !patternMatch.matched) return false;

    return patternMatch.patterns.some(p => {
      if (p.key) return p.key === pattern;
      return p.name === targetPattern.name;
    });
  });

  // 부분 매칭 종목
  const partialMatchedStocks = result.stocks.filter(stock => {
    const patternMatch = stock.patternMatch;

    // 완전 매칭 제외
    if (patternMatch?.matched && patternMatch.patterns?.some(p =>
      (p.key && p.key === pattern) || p.name === targetPattern.name
    )) {
      return false;
    }

    if (!patternMatch?.partialMatches) return false;

    return patternMatch.partialMatches.some(p => {
      if (p.key) return p.key === pattern;
      return p.name === targetPattern.name;
    });
  });

  // 매칭도 순 정렬
  partialMatchedStocks.sort((a, b) => {
    const getMatchLevel = (stock) => {
      const pm = stock.patternMatch.partialMatches.find(p =>
        (p.key && p.key === pattern) || p.name === targetPattern.name
      );
      if (pm.matchLevel === '상') return 3;
      if (pm.matchLevel === '중') return 2;
      if (pm.matchLevel === '하') return 1;
      return 0;
    };
    return getMatchLevel(b) - getMatchLevel(a);
  });

  const totalMatches = matchedStocks.length + partialMatchedStocks.length;

  // limit 적용
  let finalStocks = [];
  let finalPartialStocks = [];

  if (limit) {
    const limitNum = parseInt(limit);
    finalStocks = matchedStocks.slice(0, limitNum);
    const remaining = limitNum - finalStocks.length;
    if (remaining > 0) {
      finalPartialStocks = partialMatchedStocks.slice(0, remaining);
    }
  } else {
    finalStocks = matchedStocks;
    finalPartialStocks = partialMatchedStocks;
  }

  console.log(`✅ ${pattern} 패턴 매칭: 완전일치 ${matchedStocks.length}개 + 부분일치 ${partialMatchedStocks.length}개`);

  res.status(200).json({
    success: true,
    pattern: {
      key: targetPattern.key,
      name: targetPattern.name,
      frequency: targetPattern.frequency,
      avgReturn: targetPattern.avgReturn,
      winRate: targetPattern.winRate,
      confidence: targetPattern.confidence,
      leadTime: targetPattern.leadTime || 5,
      backtest: targetPattern.backtest || {
        winRate: parseFloat(targetPattern.winRate || 0),
        avgReturn: parseFloat(targetPattern.avgReturn || 0),
        totalSamples: targetPattern.count || 0
      }
    },
    count: finalStocks.length + finalPartialStocks.length,
    completeMatches: finalStocks.length,
    partialMatches: finalPartialStocks.length,
    stocks: finalStocks,
    partialStocks: finalPartialStocks,
    metadata: {
      totalAnalyzed: result.metadata.totalAnalyzed,
      totalCompleteMatches: matchedStocks.length,
      totalPartialMatches: partialMatchedStocks.length,
      totalMatches: totalMatches,
      returned: finalStocks.length + finalPartialStocks.length
    }
  });
}
