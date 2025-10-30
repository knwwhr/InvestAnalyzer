// Vercel Serverless Function
// POST /api/patterns/volume-dna
// 통합 DNA 시스템: 추출 + 스캔을 하나의 엔드포인트로

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
    const { mode, stocks, commonDNA, stockPool, options } = req.body;

    // ============================================
    // Mode 1: DNA 추출 (extract)
    // ============================================
    if (mode === 'extract' || stocks) {
      if (!stocks || !Array.isArray(stocks) || stocks.length < 2) {
        return res.status(400).json({
          success: false,
          error: '최소 2개 종목의 정보가 필요합니다',
          usage: {
            mode: 'extract',
            example: {
              mode: 'extract',
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
      return res.status(200).json({
        success: true,
        mode: 'extract',
        message: 'DNA 추출 완료',
        result: {
          commonDNA: dnaResult.commonDNA,
          dnaStrength: dnaResult.dnaStrength,
          basedOnStocks: dnaResult.basedOnStocks,
          extractedAt: dnaResult.extractedAt,
          stockPatterns: validPatterns,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    }

    // ============================================
    // Mode 2: DNA 스캔 (scan)
    // ============================================
    else if (mode === 'scan' || commonDNA) {
      if (!commonDNA) {
        return res.status(400).json({
          success: false,
          error: 'commonDNA가 필요합니다',
          usage: {
            mode: 'scan',
            description: '먼저 mode=extract로 DNA를 추출하세요',
            example: {
              mode: 'scan',
              commonDNA: {
                volumeRate: {
                  avgEMA: 2.23,
                  avgRecent5d: -0.31,
                  threshold: { emaMin: 1.134, recent5dMin: -0.756 }
                }
              },
              options: {
                matchThreshold: 70,
                limit: 10,
                days: 25
              }
            }
          }
        });
      }

      console.log('\n🔍 DNA 기반 시장 스캔 시작...\n');

      // 옵션 기본값
      const scanOptions = {
        matchThreshold: options?.matchThreshold || 70,
        limit: options?.limit || 10,
        days: options?.days || 25
      };

      console.log(`  - 매칭 임계값: ${scanOptions.matchThreshold}점`);
      console.log(`  - 최대 반환: ${scanOptions.limit}개`);
      console.log(`  - 분석 기간: 최근 ${scanOptions.days}일\n`);

      // DNA 스캔 실행
      const matchedStocks = await volumeDnaExtractor.scanMarketForDNA(
        commonDNA,
        stockPool,
        scanOptions
      );

      console.log(`\n✅ 스캔 완료: ${matchedStocks.length}개 종목 매칭\n`);

      // 응답
      return res.status(200).json({
        success: true,
        mode: 'scan',
        message: `${matchedStocks.length}개 종목이 DNA와 매칭되었습니다`,
        result: {
          matchedStocks,
          scanOptions,
          scannedAt: new Date().toISOString()
        }
      });
    }

    // ============================================
    // 잘못된 요청
    // ============================================
    else {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 요청입니다',
        usage: {
          modes: [
            {
              mode: 'extract',
              description: '과거 급등주 패턴에서 공통 DNA 추출',
              required: ['stocks: [{ code, startDate, endDate }]']
            },
            {
              mode: 'scan',
              description: '추출된 DNA로 현재 시장 스캔',
              required: ['commonDNA: { volumeRate, ... }']
            }
          ]
        }
      });
    }

  } catch (error) {
    console.error('❌ DNA 처리 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
