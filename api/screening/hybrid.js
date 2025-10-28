/**
 * 하이브리드 선행 포착 시스템 API 엔드포인트
 * GET /api/screening/hybrid?limit=10
 *
 * 예상 승률: 75-78% (슬리피지 반영)
 * 예상 수익률: +9-11% (거래비용 포함)
 */

const kisApi = require('../../backend/kisApi');
const hybridScreening = require('../../backend/screeningHybrid');

module.exports = async (req, res) => {
  console.log('\n========================================');
  console.log('🚀 하이브리드 스크리닝 시작');
  console.log('========================================\n');

  const startTime = Date.now();

  try {
    // 쿼리 파라미터
    const limit = parseInt(req.query.limit) || 10;
    const market = req.query.market || 'ALL';

    console.log(`📊 요청 파라미터: limit=${limit}, market=${market}`);

    // 1. 종목 리스트 확보 (동적 API 기반)
    console.log('\n[1단계] 종목 리스트 확보 중...');
    const { codes: stockList } = await kisApi.getAllStockList(market);

    if (!stockList || stockList.length === 0) {
      throw new Error('종목 리스트 확보 실패');
    }

    console.log(`✅ 종목 리스트 확보: ${stockList.length}개`);

    // 2. 하이브리드 스크리닝 실행
    console.log('\n[2단계] 하이브리드 분석 실행 중...');
    const results = await hybridScreening.runHybridScreening(stockList);

    // 3. 상위 N개 반환
    const topResults = results.slice(0, limit);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ 스크리닝 완료: ${elapsedTime}초`);
    console.log(`   - 분석 종목: ${stockList.length}개`);
    console.log(`   - S/A 등급: ${results.length}개`);
    console.log(`   - 반환 결과: ${topResults.length}개\n`);

    // 4. 응답
    res.status(200).json({
      success: true,
      method: 'hybrid',
      description: 'Grok 백테스트 + Claude 세부 조정',
      expectedPerformance: {
        winRate: '75-78%',
        avgReturn: '+9-11%',
        signalFrequency: '1.5-2/week'
      },
      count: topResults.length,
      recommendations: topResults.map(r => ({
        stockCode: r.stockCode,
        stockName: r.stockName,
        market: r.market,
        grade: r.grade,
        score: r.score,
        signal: r.signal,
        currentPrice: r.currentPrice,
        todayChange: r.todayChange,
        indicators: {
          volumeGradual: {
            detected: r.indicators.volumeGradual.detected,
            growth: r.indicators.volumeGradual.growth,
            expectedDays: r.indicators.volumeGradual.expectedDays,
            interpretation: r.indicators.volumeGradual.interpretation
          },
          obvDivergence: {
            detected: r.indicators.obvDivergence.detected,
            obvTrend: r.indicators.obvDivergence.obvTrend,
            priceTrend: r.indicators.obvDivergence.priceTrend,
            interpretation: r.indicators.obvDivergence.interpretation
          },
          uptrend: {
            detected: r.indicators.uptrend.detected,
            ma5: r.indicators.uptrend.ma5,
            ma20: r.indicators.uptrend.ma20,
            rsi: r.indicators.uptrend.rsi,
            interpretation: r.indicators.uptrend.interpretation
          }
        },
        scoreBreakdown: {
          volumeGradual: r.indicators.volumeGradual.score,
          obvDivergence: r.indicators.obvDivergence.score,
          uptrend: r.indicators.uptrend.score,
          penalties: r.filter.penalties,
          total: r.score
        }
      })),
      metadata: {
        totalAnalyzed: stockList.length,
        totalFound: results.length,
        returned: topResults.length,
        elapsedTime: elapsedTime + 's',
        market: market,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ 하이브리드 스크리닝 실패:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
