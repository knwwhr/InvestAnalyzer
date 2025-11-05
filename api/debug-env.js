// Vercel Serverless Function - Debug Environment Variables
// GET /api/debug-env

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

  res.status(200).json({
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
  });
};
