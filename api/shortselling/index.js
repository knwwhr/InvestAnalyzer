// Vercel Serverless Function
// GET /api/shortselling?stockCode=005930
// 공매도 데이터 조회 (KRX 데이터 기반)

const kisApi = require('../../backend/kisApi');

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
    const { stockCode } = req.query;

    if (!stockCode) {
      return res.status(400).json({
        success: false,
        error: 'stockCode 파라미터가 필요합니다.'
      });
    }

    console.log(`📊 공매도 데이터 조회: ${stockCode}`);

    // TODO: 실제 KRX 공매도 데이터 API 연동
    // 현재는 차트 데이터 기반 추정치 제공
    const chartData = await kisApi.getDailyChart(stockCode, 20);

    if (!chartData || chartData.length === 0) {
      return res.status(404).json({
        success: false,
        error: '종목 데이터를 찾을 수 없습니다.'
      });
    }

    // 공매도 데이터 추정 (실제 API 연동 전까지 임시)
    // 거래량 대비 하락 압력으로 공매도 비중 추정
    const recentData = chartData.slice(0, 5);
    const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
    const avgPriceChange = recentData.reduce((sum, d, i) => {
      if (i === 0) return sum;
      return sum + ((d.close - recentData[i - 1].close) / recentData[i - 1].close * 100);
    }, 0) / (recentData.length - 1);

    // 공매도 비중 추정 (0-20% 범위)
    // 하락장 + 거래량 많음 = 공매도 비중 높을 가능성
    let estimatedShortRatio = 5; // 기본 5%

    if (avgPriceChange < -2) {
      estimatedShortRatio += Math.abs(avgPriceChange) * 0.5;
    }

    if (recentData[0].volume > avgVolume * 1.5) {
      estimatedShortRatio += 2;
    }

    estimatedShortRatio = Math.min(Math.max(estimatedShortRatio, 0), 20);

    // 공매도 잔고 변화 추정 (임시)
    const shortVolumeChange = avgPriceChange < 0 ? Math.abs(avgPriceChange) * 10 : -avgPriceChange * 5;

    // 숏 커버링 신호 판단
    const isShortCovering = avgPriceChange > 1 && recentData[0].volume > avgVolume * 1.3;
    const shortCoveringScore = isShortCovering ? 15 : 0;

    console.log(`✅ 공매도 비중 추정: ${estimatedShortRatio.toFixed(2)}%`);

    res.status(200).json({
      success: true,
      stockCode: stockCode,
      data: {
        shortRatio: parseFloat(estimatedShortRatio.toFixed(2)), // 공매도 비중 (%)
        shortVolumeChange: parseFloat(shortVolumeChange.toFixed(2)), // 공매도 잔고 변화 (%)
        isShortCovering: isShortCovering, // 숏 커버링 신호
        shortCoveringScore: shortCoveringScore, // 점수 보너스
        estimatedDate: chartData[0].date,
        isEstimated: true, // 추정치 플래그
        notice: 'KRX 실제 데이터 연동 전까지 차트 기반 추정치입니다.'
      },
      metadata: {
        avgPriceChange: parseFloat(avgPriceChange.toFixed(2)),
        avgVolume: Math.floor(avgVolume),
        currentVolume: recentData[0].volume,
        dataSource: 'estimated_from_chart'
      }
    });

  } catch (error) {
    console.error('Short selling data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
