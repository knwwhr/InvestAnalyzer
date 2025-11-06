// Vercel Serverless Function - Debug KIS API Response
// GET /api/debug-kis

const kisApi = require('../backend/kisApi');

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
    const stockCode = req.query.code || '005930'; // 기본값: 삼성전자

    console.log('🔍 KIS API 디버그 테스트 시작');
    console.log('환경변수 확인:');
    console.log('  KIS_APP_KEY:', process.env.KIS_APP_KEY?.substring(0, 10) + '...');
    console.log('  KIS_APP_SECRET:', process.env.KIS_APP_SECRET?.substring(0, 10) + '...');

    // Access Token 발급
    const token = await kisApi.getAccessToken();
    console.log('✅ Token 발급 성공:', token?.substring(0, 20) + '...');

    // 일봉 데이터 조회
    const chartData = await kisApi.getDailyChart(stockCode, 5);

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      debug: {
        stockCode: stockCode,
        envCheck: {
          hasKisAppKey: !!process.env.KIS_APP_KEY,
          appKeyPrefix: process.env.KIS_APP_KEY?.substring(0, 10) + '...',
          hasToken: !!token,
          tokenPrefix: token?.substring(0, 20) + '...'
        },
        chartData: chartData,
        latestDate: chartData[0]?.date,
        interpretation: chartData[0]?.date >= '20251101'
          ? '✅ 최신 데이터 (11월)'
          : chartData[0]?.date >= '20251001'
          ? '🟡 10월 데이터'
          : '❌ 오래된 데이터 (9월 이하)'
      }
    });
  } catch (error) {
    console.error('❌ 디버그 에러:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};
