// Vercel Serverless Function
// GET /api/patterns/matched-stocks?pattern=whale_accumulation
// 특정 패턴과 매칭되는 종목 찾기

const screener = require('../../backend/screening');
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
    const { pattern, market = 'ALL', limit } = req.query;

    if (!pattern) {
      return res.status(400).json({
        success: false,
        error: 'pattern 파라미터가 필요합니다.'
      });
    }

    // 저장된 패턴 로드 (GitHub Gist에서)
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

    // 제한적 스크리닝 실행 (타임아웃 방지: 최대 20개만 분석)
    // 전체 스크리닝은 너무 느림 (60초 초과)
    const result = await screener.screenAllStocks(market, 20, true);

    // 완전 매칭 종목 필터링
    const matchedStocks = result.stocks.filter(stock => {
      const patternMatch = stock.patternMatch;
      if (!patternMatch || !patternMatch.matched) return false;

      // patterns 배열에서 해당 패턴 키를 찾되, name으로도 비교
      return patternMatch.patterns.some(p => {
        // key가 있으면 key로, 없으면 name으로 비교
        if (p.key) return p.key === pattern;
        // name으로 targetPattern 찾기
        return p.name === targetPattern.name;
      });
    });

    // 부분 매칭 종목 필터링 (완전 매칭 제외)
    const partialMatchedStocks = result.stocks.filter(stock => {
      const patternMatch = stock.patternMatch;

      // 이미 완전 매칭된 종목은 제외
      if (patternMatch?.matched && patternMatch.patterns?.some(p =>
        (p.key && p.key === pattern) || p.name === targetPattern.name
      )) {
        return false;
      }

      // partialMatches 배열에서 해당 패턴 찾기
      if (!patternMatch?.partialMatches) return false;

      return patternMatch.partialMatches.some(p => {
        if (p.key) return p.key === pattern;
        return p.name === targetPattern.name;
      });
    });

    // 부분 매칭 종목을 매칭도 순으로 정렬 (상 > 중 > 하)
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

    // 전체 종목 수 (완전 + 부분)
    const totalMatches = matchedStocks.length + partialMatchedStocks.length;

    // limit 적용 (완전 매칭 우선, 부족하면 부분 매칭 추가)
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
        // 하위 호환성: backtest 객체도 제공
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

  } catch (error) {
    console.error('Pattern matched stocks error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
