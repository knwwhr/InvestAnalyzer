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
// 통합 라우터로 변경하여 Vercel 12 function 제한 해결
const screeningRouter = require('./api/screening-router');
const patternsRouter = require('./api/patterns-router');

const apiRoutes = {
  '/api/health': require('./api/health'),

  // 통합 스크리닝 라우터 (7개 → 1개)
  '/api/screening-router': screeningRouter,

  // 통합 패턴 라우터 (3개 → 1개)
  '/api/patterns-router': patternsRouter,

  // 백테스트 & 추적 시스템
  '/api/backtest/hybrid': require('./api/backtest/hybrid'),
  '/api/tracking/today-signals': require('./api/tracking/today-signals'),
  '/api/comparison/ab-test': require('./api/comparison/ab-test'),

  // 레거시 호환성 (기존 URL 유지)
  '/api/screening/recommend': (req, res) => {
    req.query = { ...req.query, type: 'recommend' };
    return screeningRouter(req, res);
  },
  '/api/screening/whale': (req, res) => {
    req.query = { ...req.query, type: 'whale' };
    return screeningRouter(req, res);
  },
  '/api/screening/accumulation': (req, res) => {
    req.query = { ...req.query, type: 'accumulation' };
    return screeningRouter(req, res);
  },
  '/api/screening/escape': (req, res) => {
    req.query = { ...req.query, type: 'escape' };
    return screeningRouter(req, res);
  },
  '/api/screening/drain': (req, res) => {
    req.query = { ...req.query, type: 'drain' };
    return screeningRouter(req, res);
  },
  '/api/screening/volume-surge': (req, res) => {
    req.query = { ...req.query, type: 'volume-surge' };
    return screeningRouter(req, res);
  },
  '/api/screening/hybrid': (req, res) => {
    req.query = { ...req.query, type: 'hybrid' };
    return screeningRouter(req, res);
  },
  '/api/patterns/list': (req, res) => {
    req.query = { ...req.query, type: 'list' };
    return patternsRouter(req, res);
  },
  '/api/patterns/analyze': (req, res) => {
    req.query = { ...req.query, type: 'analyze' };
    return patternsRouter(req, res);
  },
  '/api/patterns/matched-stocks': (req, res) => {
    req.query = { ...req.query, type: 'matched-stocks' };
    return patternsRouter(req, res);
  }
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
