// Vercel Serverless Function
// POST /api/patterns/volume-dna-extraction
// 거래량 DNA 추출: 과거 급등주 패턴 → 공통 DNA 추출 → 현재 시장 매칭

const volumeDnaExtractor = require('../../backend/volumeDnaExtractor');

module.exports = async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { stocks } = req.body;

    // 입력 검증
    if (!stocks || !Array.isArray(stocks) || stocks.length < 2) {
      return res.status(400).json({
        success: false,
        error: '최소 2개 종목의 정보가 필요합니다',
        usage: {
          example: {
            stocks: [
              { code: '005930', startDate: '20250101', endDate: '20250115' },
              { code: '000660', startDate: '20250210', endDate: '20250225' }
            ]
          }
        }
      });
    }

    console.log(`\n🧬 거래량 DNA 추출 시작: ${stocks.length}개 종목\n`);

    // 1. 각 종목별 패턴 추출
    const stockPatterns = [];
    for (const stock of stocks) {
      const pattern = await volumeDnaExtractor.extractStockPattern(
        stock.code,
        stock.startDate,
        stock.endDate
      );
      stockPatterns.push(pattern);
    }

    // 오류 확인
    const validPatterns = stockPatterns.filter(p => !p.error);
    const errors = stockPatterns.filter(p => p.error);

    if (validPatterns.length < 2) {
      return res.status(400).json({
        success: false,
        error: `최소 2개 종목의 유효한 패턴 필요 (현재 ${validPatterns.length}개)`,
        errors: errors,
        validPatterns: validPatterns.length
      });
    }

    console.log(`\n✓ 유효한 패턴: ${validPatterns.length}개`);
    if (errors.length > 0) {
      console.warn(`⚠️ 실패한 종목: ${errors.length}개`);
    }

    // 2. 공통 DNA 추출
    const dnaResult = volumeDnaExtractor.extractCommonDNA(stockPatterns);

    if (dnaResult.error) {
      return res.status(400).json({
        success: false,
        error: dnaResult.error
      });
    }

    console.log(`\n✅ 공통 DNA 추출 완료: 강도 ${dnaResult.dnaStrength}%\n`);

    // 3. 응답
    res.status(200).json({
      success: true,
      message: 'DNA 추출 완료',
      result: {
        commonDNA: dnaResult.commonDNA,
        dnaStrength: dnaResult.dnaStrength,
        basedOnStocks: dnaResult.basedOnStocks,
        extractedAt: dnaResult.extractedAt,
        stockPatterns: validPatterns,  // 개별 패턴도 반환
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('❌ DNA 추출 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
