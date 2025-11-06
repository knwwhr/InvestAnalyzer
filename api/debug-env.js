// Vercel Serverless Function - Debug Environment Variables & KIS API
// GET /api/debug-env
// GET /api/debug-env?test=kis - Test KIS API data freshness

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

  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  const response = {
    success: true,
    timestamp: new Date().toISOString(),
    envCheck: {
      hasKisAppKey: !!appKey,
      hasKisAppSecret: !!appSecret,
      appKeyPrefix: appKey ? appKey.substring(0, 10) + '...' : 'NOT SET',
      appSecretPrefix: appSecret ? appSecret.substring(0, 10) + '...' : 'NOT SET',
      appKeyLength: appKey ? appKey.length : 0,
      appSecretLength: appSecret ? appSecret.length : 0,
    },
    note: 'Check if the prefix matches your expected values'
  };

  // KIS API 테스트 (test=kis 쿼리 파라미터)
  if (req.query.test === 'kis') {
    try {
      const stockCode = req.query.code || '005930'; // 기본값: 삼성전자

      console.log('🔍 KIS API 테스트 시작:', stockCode);

      // Access Token 발급
      const token = await kisApi.getAccessToken();

      // 일봉 데이터 조회
      const chartData = await kisApi.getDailyChart(stockCode, 5);

      response.kisTest = {
        stockCode: stockCode,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : null,
        chartData: chartData,
        latestDate: chartData[0]?.date,
        interpretation: chartData[0]?.date >= '20251101'
          ? '✅ 최신 데이터 (11월)'
          : chartData[0]?.date >= '20251001'
          ? '🟡 10월 데이터'
          : '❌ 오래된 데이터 (9월 이하)'
      };

      console.log('✅ KIS API 테스트 성공:', chartData[0]?.date);
    } catch (error) {
      console.error('❌ KIS API 테스트 실패:', error.message);
      response.kisTest = {
        error: error.message,
        stack: error.stack
      };
    }
  }

  res.status(200).json(response);
};
