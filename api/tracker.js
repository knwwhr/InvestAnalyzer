// Vercel Serverless Function
// POST /api/tracker?action=save&category=top10
// GET /api/tracker?action=update
// GET /api/tracker?action=performance

const tracker = require('../backend/tracker');

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
    const { action, category } = req.query;

    console.log(`📡 Tracker API 호출: action=${action}, category=${category}`);

    switch (action) {
      case 'save':
        // 오늘의 추천 저장
        const saved = await tracker.saveRecommendations(category || 'top10');
        return res.status(200).json({
          success: true,
          message: `${saved.length}개 추천 저장 완료`,
          data: saved
        });

      case 'update':
        // 가격 업데이트
        const updated = await tracker.updateAllPrices();
        return res.status(200).json({
          success: true,
          message: `${updated.length}개 종목 가격 업데이트 완료`,
          data: updated
        });

      case 'performance':
        // 성과 조회
        const performance = await tracker.getAllData();
        return res.status(200).json({
          success: true,
          data: performance
        });

      case 'archive':
        // 오래된 추천 아카이빙
        await tracker.archiveOldRecommendations();
        return res.status(200).json({
          success: true,
          message: '아카이빙 완료'
        });

      default:
        return res.status(400).json({
          success: false,
          error: 'action 파라미터 필요 (save, update, performance, archive)'
        });
    }
  } catch (error) {
    console.error('❌ Tracker API 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
