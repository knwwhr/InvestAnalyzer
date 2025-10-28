/**
 * A/B 테스트 API: 하이브리드 vs 기존 시스템
 * GET /api/comparison/ab-test?stockCode=005930&signalDate=20251020
 */

const backtestEngine = require('../../backend/backtestEngine');

module.exports = async (req, res) => {
  console.log('\n========================================');
  console.log('⚖️  A/B 테스트: 하이브리드 vs 기존');
  console.log('========================================\n');

  try {
    const { stockCode, signalDate, holdDays = 10 } = req.query;

    if (!stockCode || !signalDate) {
      return res.status(400).json({
        success: false,
        error: 'stockCode와 signalDate 파라미터 필요'
      });
    }

    const result = await backtestEngine.compareHybridVsLegacy(
      stockCode,
      signalDate,
      parseInt(holdDays)
    );

    if (result.error) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    // 승자 판정
    let verdict = '';
    if (result.hybrid.shouldBuy && !result.legacy.shouldBuy) {
      verdict = result.winner === 'HYBRID'
        ? '✅ 하이브리드 승리 (올바른 신호)'
        : '❌ 하이브리드 오판 (잘못된 신호)';
    } else if (!result.hybrid.shouldBuy && result.legacy.shouldBuy) {
      verdict = result.winner === 'HYBRID'
        ? '⚠️ 기존 시스템만 신호 (기회 손실)'
        : '✅ 하이브리드 정확 (기존 시스템 오판 회피)';
    } else if (result.hybrid.shouldBuy && result.legacy.shouldBuy) {
      verdict = '🤝 양측 동의 (신호 일치)';
    } else {
      verdict = '⚪ 양측 비신호 (거래 없음)';
    }

    res.status(200).json({
      success: true,
      comparison: {
        stockCode: result.stockCode,
        signalDate: result.signalDate,
        hybrid: {
          decision: result.hybrid.shouldBuy ? '매수' : '보류',
          score: result.hybrid.score,
          grade: result.hybrid.score >= 85 ? 'S' :
                 result.hybrid.score >= 70 ? 'A' :
                 result.hybrid.score >= 50 ? 'B' : 'C',
          result: result.hybrid.result
        },
        legacy: {
          decision: result.legacy.shouldBuy ? '매수' : '보류',
          score: result.legacy.score,
          grade: result.legacy.grade
        },
        verdict: verdict,
        agreement: result.agreement
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('A/B 테스트 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
