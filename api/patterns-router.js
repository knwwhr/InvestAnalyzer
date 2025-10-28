/**
 * 통합 패턴 라우터
 * 3개의 /api/patterns/* 엔드포인트를 하나로 통합
 *
 * 사용법:
 *   GET /api/patterns-router?type=list
 *   POST /api/patterns-router?type=analyze
 *   GET /api/patterns-router?type=matched-stocks&pattern=whale_accumulation
 */

const listHandler = require('./patterns/list');
const analyzeHandler = require('./patterns/analyze');
const matchedStocksHandler = require('./patterns/matched-stocks');

module.exports = async (req, res) => {
  const { type } = req.query;

  // 라우팅 맵핑
  const handlers = {
    'list': listHandler,
    'analyze': analyzeHandler,
    'matched-stocks': matchedStocksHandler
  };

  const handler = handlers[type];

  if (!handler) {
    return res.status(400).json({
      success: false,
      error: `Invalid type: ${type}. Valid types: ${Object.keys(handlers).join(', ')}`
    });
  }

  // 해당 핸들러로 위임
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`[patterns-router] Error in ${type}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
