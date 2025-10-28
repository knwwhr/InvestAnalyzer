/**
 * Investar 로컬 개발 서버
 * Vercel Serverless Functions를 로컬에서 테스트하기 위한 Express 서버
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());

// 정적 파일 제공
app.use(express.static('.'));

// API 라우트 매핑 (Vercel Serverless Functions → Express Routes)
const apiRoutes = {
  '/api/health': require('./api/health'),
  '/api/screening/recommend': require('./api/screening/recommend'),
  '/api/screening/whale': require('./api/screening/whale'),
  '/api/screening/accumulation': require('./api/screening/accumulation'),
  '/api/screening/escape': require('./api/screening/escape'),
  '/api/screening/drain': require('./api/screening/drain'),
  '/api/screening/volume-surge': require('./api/screening/volume-surge'),
  '/api/screening/hybrid': require('./api/screening/hybrid'),
  '/api/patterns/list': require('./api/patterns/list'),
  '/api/patterns/analyze': require('./api/patterns/analyze'),
  '/api/patterns/matched-stocks': require('./api/patterns/matched-stocks'),
  '/api/backtest/hybrid': require('./api/backtest/hybrid'),
  '/api/tracking/today-signals': require('./api/tracking/today-signals'),
  '/api/comparison/ab-test': require('./api/comparison/ab-test')
};

// 라우트 등록
Object.entries(apiRoutes).forEach(([route, handler]) => {
  app.get(route, handler);
  app.post(route, handler); // POST도 지원
});

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.path
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 Investar 로컬 서버 실행 중`);
  console.log(`========================================`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api/health`);
  console.log(`🔥 하이브리드: http://localhost:${PORT}/api/screening/hybrid?limit=3`);
  console.log(`========================================\n`);
});

module.exports = app;
