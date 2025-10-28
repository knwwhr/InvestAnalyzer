/**
 * 통합 스크리닝 라우터
 * 7개의 /api/screening/* 엔드포인트를 하나로 통합
 *
 * 사용법:
 *   GET /api/screening-router?type=recommend&limit=10
 *   GET /api/screening-router?type=whale&market=KOSPI
 *   GET /api/screening-router?type=hybrid&limit=5
 */

const recommendHandler = require('./screening/recommend');
const categoryHandler = require('./screening/[category]');
const hybridHandler = require('./screening/hybrid');

module.exports = async (req, res) => {
  const { type } = req.query;

  // 카테고리 맵핑 (category handler가 처리하는 것들)
  const categories = ['whale', 'accumulation', 'escape', 'drain', 'volume-surge'];

  try {
    if (type === 'recommend') {
      await recommendHandler(req, res);
    } else if (type === 'hybrid') {
      await hybridHandler(req, res);
    } else if (categories.includes(type)) {
      // [category].js로 위임 (카테고리를 URL 파라미터처럼 전달)
      req.params = { category: type };
      await categoryHandler(req, res);
    } else {
      return res.status(400).json({
        success: false,
        error: `Invalid type: ${type}. Valid types: recommend, hybrid, ${categories.join(', ')}`
      });
    }
  } catch (error) {
    console.error(`[screening-router] Error in ${type}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
