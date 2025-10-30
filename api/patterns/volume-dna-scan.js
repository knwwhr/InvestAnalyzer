// Vercel Serverless Function
// POST /api/patterns/volume-dna-scan
// 현재 시장 스캔: 추출된 DNA와 매칭되는 종목 찾기

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
    const { commonDNA, stockPool, options } = req.body;

    // 입력 검증
    if (!commonDNA) {
      return res.status(400).json({
        success: false,
        error: 'commonDNA가 필요합니다',
        usage: {
          description: '먼저 /api/patterns/volume-dna-extraction을 호출하여 DNA를 추출하세요',
          example: {
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
      stockPool,  // null이면 자동으로 53개 종목 풀 로드
      scanOptions
    );

    console.log(`\n✅ 스캔 완료: ${matchedStocks.length}개 종목 매칭\n`);

    // 응답
    res.status(200).json({
      success: true,
      message: `${matchedStocks.length}개 종목이 DNA와 매칭되었습니다`,
      result: {
        matchedStocks,
        scanOptions,
        scannedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ DNA 스캔 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
