const express = require('express');
const cors = require('cors');
require('dotenv').config();

const kisApi = require('./kisApi');
const volumeIndicators = require('./volumeIndicators');
const advancedIndicators = require('./advancedIndicators');
const screener = require('./screening');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

/**
 * 현재가 조회
 * GET /api/stock/:code/current
 */
app.get('/api/stock/:code/current', async (req, res) => {
  try {
    const { code } = req.params;
    const data = await kisApi.getCurrentPrice(code);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 일봉 데이터 조회
 * GET /api/stock/:code/daily?days=30
 */
app.get('/api/stock/:code/daily', async (req, res) => {
  try {
    const { code } = req.params;
    const days = parseInt(req.query.days) || 30;
    const data = await kisApi.getDailyChart(code, days);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 분봉 데이터 조회
 * GET /api/stock/:code/minute?unit=1
 */
app.get('/api/stock/:code/minute', async (req, res) => {
  try {
    const { code } = req.params;
    const unit = req.query.unit || '1';
    const data = await kisApi.getMinuteChart(code, unit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 거래량 분석 (종합)
 * GET /api/stock/:code/volume-analysis?days=30
 */
app.get('/api/stock/:code/volume-analysis', async (req, res) => {
  try {
    const { code } = req.params;
    const days = parseInt(req.query.days) || 30;

    // 일봉 데이터 가져오기
    const chartData = await kisApi.getDailyChart(code, days);

    // 거래량 분석
    const analysis = volumeIndicators.analyzeVolume(chartData);

    res.json({
      success: true,
      stockCode: code,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 여러 종목 현재가 일괄 조회
 * POST /api/stocks/current
 * Body: { codes: ['005930', '000660', ...] }
 */
app.post('/api/stocks/current', async (req, res) => {
  try {
    const { codes } = req.body;

    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({
        success: false,
        error: '종목코드 배열이 필요합니다'
      });
    }

    const results = [];
    for (const code of codes) {
      try {
        const data = await kisApi.getCurrentPrice(code);
        results.push({ code, success: true, data });
      } catch (error) {
        results.push({ code, success: false, error: error.message });
      }

      // API 호출 제한 대응 (초당 5건)
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 거래량 급증 종목 탐지
 * GET /api/stock/:code/volume-surge
 */
app.get('/api/stock/:code/volume-surge', async (req, res) => {
  try {
    const { code } = req.params;
    const threshold = parseFloat(req.query.threshold) || 2.0;
    const days = parseInt(req.query.days) || 30;

    const chartData = await kisApi.getDailyChart(code, days);
    const surgeSignals = volumeIndicators.detectVolumeSurge(chartData, threshold);

    res.json({
      success: true,
      stockCode: code,
      threshold,
      signals: surgeSignals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 인기 종목 코드 목록 (하드코딩)
 * 나중에 DB나 외부 API로 대체 가능
 */
app.get('/api/stocks/popular', (req, res) => {
  const popularStocks = [
    { code: '005930', name: '삼성전자' },
    { code: '000660', name: 'SK하이닉스' },
    { code: '035720', name: '카카오' },
    { code: '035420', name: 'NAVER' },
    { code: '051910', name: 'LG화학' },
    { code: '006400', name: '삼성SDI' },
    { code: '005380', name: '현대차' },
    { code: '000270', name: '기아' },
    { code: '068270', name: '셀트리온' },
    { code: '207940', name: '삼성바이오로직스' },
    { code: '105560', name: 'KB금융' },
    { code: '055550', name: '신한지주' },
    { code: '003670', name: '포스코퓨처엠' },
    { code: '096770', name: 'SK이노베이션' },
    { code: '028260', name: '삼성물산' }
  ];

  res.json({ success: true, stocks: popularStocks });
});

/**
 * 🔥 전체 종목 스크리닝 - TOP 10 추천
 * GET /api/screening/recommend?market=ALL&limit=10
 */
app.get('/api/screening/recommend', async (req, res) => {
  try {
    const market = req.query.market || 'ALL';
    const limit = parseInt(req.query.limit) || 10;

    const recommendations = await screener.screenAllStocks(market, limit);

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 카테고리별 추천
 * GET /api/screening/category/:category
 * category: whale, accumulation, escape, drain, volume-surge
 */
app.get('/api/screening/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const market = req.query.market || 'ALL';

    const recommendations = await screener.screenByCategory(category, market);

    res.json({
      success: true,
      category,
      count: recommendations.length,
      recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 단일 종목 상세 분석 (창의적 지표 포함)
 * GET /api/stock/:code/advanced-analysis
 */
app.get('/api/stock/:code/advanced-analysis', async (req, res) => {
  try {
    const { code } = req.params;
    const analysis = await screener.analyzeStock(code);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: '종목 분석 실패'
      });
    }

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 스크리닝 캐시 초기화
 * POST /api/screening/clear-cache
 */
app.post('/api/screening/clear-cache', (req, res) => {
  screener.clearCache();
  res.json({ success: true, message: '캐시가 초기화되었습니다' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 Stock Volume Analyzer 백엔드 서버 시작`);
  console.log(`📡 포트: ${PORT}`);
  console.log(`🌐 API 엔드포인트: http://localhost:${PORT}/api`);
  console.log(`\n✅ 사용 가능한 API:`);
  console.log(`   GET  /api/health - 서버 상태 확인`);
  console.log(`   GET  /api/stock/:code/current - 현재가 조회`);
  console.log(`   GET  /api/stock/:code/daily - 일봉 데이터`);
  console.log(`   GET  /api/stock/:code/volume-analysis - 거래량 분석`);
  console.log(`   GET  /api/stock/:code/advanced-analysis - 창의적 지표 분석`);
  console.log(`   POST /api/stocks/current - 여러 종목 조회`);
  console.log(`   GET  /api/stocks/popular - 인기 종목 목록`);
  console.log(`\n🔥 스크리닝 API:`);
  console.log(`   GET  /api/screening/recommend - TOP 10 추천 종목`);
  console.log(`   GET  /api/screening/category/:category - 카테고리별 추천`);
  console.log(`   POST /api/screening/clear-cache - 캐시 초기화\n`);
});

module.exports = app;
