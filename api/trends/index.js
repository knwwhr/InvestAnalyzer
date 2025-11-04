/**
 * 통합 트렌드 API (Vercel Function 제한 대응)
 * GET /api/trends?action=hot-issues&limit=10
 * GET /api/trends?action=scores&stockCode=005930
 * POST /api/trends?action=collect-search
 * POST /api/trends?action=collect-news
 * POST /api/trends?action=analyze-sentiment
 */

const trendCollector = require('../../backend/trendCollector');
const newsCollector = require('../../backend/newsCollector');
const sentimentAnalyzer = require('../../backend/sentimentAnalyzer');
const trendScoring = require('../../backend/trendScoring');
const kisApi = require('../../backend/kisApi');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  if (!action) {
    return res.status(400).json({
      success: false,
      error: 'Missing action parameter',
      usage: {
        'hot-issues': 'GET /api/trends?action=hot-issues&limit=10',
        'scores': 'GET /api/trends?action=scores&stockCode=005930',
        'collect-search': 'POST /api/trends?action=collect-search',
        'collect-news': 'POST /api/trends?action=collect-news',
        'analyze-sentiment': 'POST /api/trends?action=analyze-sentiment'
      }
    });
  }

  try {
    // ========== HOT 이슈 조회 ==========
    if (action === 'hot-issues' && req.method === 'GET') {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const hotIssues = await trendScoring.getHotIssueStocks();
      const limited = hotIssues.slice(0, limit);

      const sGrade = limited.filter(s => s.total_trend_score >= 85);
      const aGrade = limited.filter(s => s.total_trend_score >= 70 && s.total_trend_score < 85);

      return res.status(200).json({
        success: true,
        count: limited.length,
        hotIssues: limited.map(stock => ({
          stockCode: stock.stock_code,
          stockName: stock.stock_name,
          trendScore: stock.total_trend_score,
          grade: stock.total_trend_score >= 85 ? 'S' : 'A',
          breakdown: {
            search: {
              score: stock.search_score,
              surge: stock.search_surge,
              currentValue: stock.current_search_value,
              changeRate: stock.search_change_rate
            },
            news: {
              score: stock.news_score,
              mentions24h: stock.mentions_24h,
              mentionChangeRate: stock.mention_change_rate
            },
            sentiment: {
              score: stock.sentiment_score
            }
          },
          updatedAt: stock.updated_at
        })),
        summary: {
          sGrade: sGrade.length,
          aGrade: aGrade.length,
          avgScore: limited.length > 0
            ? (limited.reduce((sum, s) => sum + s.total_trend_score, 0) / limited.length).toFixed(2)
            : 0
        },
        timestamp: new Date().toISOString()
      });
    }

    // ========== 트렌드 점수 조회 ==========
    if (action === 'scores' && req.method === 'GET') {
      const { stockCode, minScore } = req.query;

      if (stockCode) {
        const scoreData = await trendScoring.getStockTrendScore(stockCode);
        if (!scoreData) {
          return res.status(404).json({
            success: false,
            error: `종목 코드 ${stockCode}의 트렌드 데이터를 찾을 수 없습니다.`
          });
        }
        return res.status(200).json({
          success: true,
          stock: scoreData,
          timestamp: new Date().toISOString()
        });
      }

      const hotIssues = await trendScoring.getHotIssueStocks();
      const minScoreNum = minScore ? parseFloat(minScore) : 0;
      const filtered = hotIssues.filter(s => s.total_trend_score >= minScoreNum);

      return res.status(200).json({
        success: true,
        count: filtered.length,
        stocks: filtered,
        statistics: {
          avgScore: filtered.length > 0
            ? (filtered.reduce((sum, s) => sum + s.total_trend_score, 0) / filtered.length).toFixed(2)
            : 0,
          maxScore: filtered.length > 0
            ? Math.max(...filtered.map(s => s.total_trend_score))
            : 0
        },
        timestamp: new Date().toISOString()
      });
    }

    // ========== Google Trends 수집 (비활성화) ==========
    if (action === 'collect-search' && (req.method === 'POST' || req.method === 'GET')) {
      return res.status(503).json({
        success: false,
        error: 'Google Trends API가 현재 차단되어 사용할 수 없습니다.',
        message: '네이버 뉴스 + Gemini AI만 사용하는 방식으로 변경되었습니다.',
        alternatives: {
          'collect-news': 'POST /api/trends?action=collect-news',
          'analyze-sentiment': 'POST /api/trends?action=analyze-sentiment'
        }
      });
    }

    // ========== 네이버 뉴스 수집 ==========
    if (action === 'collect-news' && (req.method === 'POST' || req.method === 'GET')) {
      if (!process.env.NAVER_CLIENT_ID || !process.env.NAVER_CLIENT_SECRET) {
        return res.status(400).json({
          success: false,
          error: '네이버 API 키가 설정되지 않았습니다.'
        });
      }

      const startTime = Date.now();
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const newsPerStock = req.query.newsPerStock ? parseInt(req.query.newsPerStock) : 10;

      const kospiStocks = await kisApi.getTradingValueRank('KOSPI', Math.ceil(limit / 2));
      const kosdaqStocks = await kisApi.getTradingValueRank('KOSDAQ', Math.floor(limit / 2));

      const allStocks = [...kospiStocks, ...kosdaqStocks]
        .slice(0, limit)
        .map(stock => ({
          stockCode: stock.stck_shrn_iscd || stock.code,
          stockName: stock.hts_kor_isnm || stock.name
        }));

      const result = await newsCollector.collectBatch(allStocks, newsPerStock);

      return res.status(200).json({
        success: true,
        collected: {
          stocks: result.successCount,
          totalNews: result.totalNews
        },
        topMentioned: result.results
          .sort((a, b) => b.newsCount - a.newsCount)
          .slice(0, 10),
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString()
      });
    }

    // ========== Gemini AI 감성 분석 ==========
    if (action === 'analyze-sentiment' && (req.method === 'POST' || req.method === 'GET')) {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          success: false,
          error: 'Gemini API 키가 설정되지 않았습니다.'
        });
      }

      const startTime = Date.now();
      const limit = req.query.limit ? parseInt(req.query.limit) : 30;

      const kospiStocks = await kisApi.getTradingValueRank('KOSPI', Math.ceil(limit / 2));
      const kosdaqStocks = await kisApi.getTradingValueRank('KOSDAQ', Math.floor(limit / 2));

      const allStocks = [...kospiStocks, ...kosdaqStocks]
        .slice(0, limit)
        .map(stock => ({
          stockCode: stock.stck_shrn_iscd || stock.code,
          stockName: stock.hts_kor_isnm || stock.name
        }));

      const result = await sentimentAnalyzer.analyzeBatchStocks(allStocks);

      return res.status(200).json({
        success: true,
        analyzed: {
          stocks: result.totalStocks,
          newsItems: result.totalNewsAnalyzed
        },
        topResults: result.results
          .filter(r => r.analyzed > 0)
          .sort((a, b) => b.analyzed - a.analyzed)
          .slice(0, 10),
        executionTime: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString()
      });
    }

    // 지원하지 않는 action
    return res.status(400).json({
      success: false,
      error: `Unknown action: ${action}`,
      supportedActions: ['hot-issues', 'scores', 'collect-search', 'collect-news', 'analyze-sentiment']
    });

  } catch (error) {
    console.error(`❌ Trends API error [${action}]:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
