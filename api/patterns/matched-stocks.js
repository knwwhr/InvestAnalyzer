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

    // 저장된 패턴 로드
    const savedPatterns = smartPatternMiner.loadSavedPatterns();
    const targetPattern = savedPatterns.find(p => p.key === pattern);

    if (!targetPattern) {
      return res.status(404).json({
        success: false,
        error: `패턴 '${pattern}'을 찾을 수 없습니다.`
      });
    }

    console.log(`🔍 패턴 매칭 종목 검색: ${pattern} (${targetPattern.name})`);

    // 전체 스크리닝 실행
    const result = await screener.screenAllStocks(market);

    // 패턴 매칭된 종목만 필터링
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

    // limit 적용
    const finalStocks = limit ? matchedStocks.slice(0, parseInt(limit)) : matchedStocks;

    console.log(`✅ ${pattern} 패턴 매칭: ${matchedStocks.length}개 종목 발견`);

    res.status(200).json({
      success: true,
      pattern: {
        key: targetPattern.key,
        name: targetPattern.name,
        frequency: targetPattern.frequency,
        avgReturn: targetPattern.avgReturn,
        backtest: targetPattern.backtest
      },
      count: finalStocks.length,
      stocks: finalStocks,
      metadata: {
        totalAnalyzed: result.metadata.totalAnalyzed,
        totalMatched: matchedStocks.length,
        returned: finalStocks.length
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
