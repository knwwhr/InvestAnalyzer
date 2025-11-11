// Vercel Serverless Function
// GET /api/shortselling?stockCode=005930
// 공매도 데이터 조회 (KRX 데이터 기반)

const shortSellingApi = require('../../backend/shortSellingApi');

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
    const { stockCode, days } = req.query;

    if (!stockCode) {
      return res.status(400).json({
        success: false,
        error: 'stockCode 파라미터가 필요합니다.'
      });
    }

    console.log(`📊 공매도 데이터 조회: ${stockCode}`);

    // 공매도 데이터 조회 (추정 또는 KRX API)
    const shortData = await shortSellingApi.getShortSellingData(
      stockCode,
      days ? parseInt(days) : 20
    );

    if (!shortData) {
      return res.status(404).json({
        success: false,
        error: '공매도 데이터를 조회할 수 없습니다.'
      });
    }

    // 점수 계산
    const score = shortSellingApi.calculateCoveringScore(shortData);

    // 요약 메시지 생성
    const summary = shortSellingApi.generateSummaryMessage(shortData);

    console.log(`✅ 공매도 비중: ${shortData.shortRatio}% | 점수: ${score}점`);

    res.status(200).json({
      success: true,
      stockCode: stockCode,
      data: {
        // 공매도 지표
        shortRatio: shortData.shortRatio,
        shortVolumeChange: shortData.shortVolumeChange,
        shortTrend: shortData.shortTrend,

        // 숏 커버링 신호
        isShortCovering: shortData.isShortCovering,
        coveringStrength: shortData.coveringStrength,

        // 점수 및 요약
        score: score,
        summary: summary,

        // 기반 데이터
        volumeRatio: shortData.volumeRatio,
        avgPriceChange: shortData.avgPriceChange,
        consecutiveDownDays: shortData.consecutiveDownDays,
        consecutiveUpDays: shortData.consecutiveUpDays,

        // 메타 정보
        estimatedDate: shortData.estimatedDate,
        dataSource: shortData.dataSource,
        confidence: shortData.confidence,
        needsKrxApi: shortData.needsKrxApi
      }
    });

  } catch (error) {
    console.error('공매도 데이터 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
