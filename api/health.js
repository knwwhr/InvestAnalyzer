// Vercel Serverless Function
// GET /api/health

module.exports = function handler(req, res) {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
}
