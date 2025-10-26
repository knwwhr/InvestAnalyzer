// Vercel Serverless Function
// POST /api/patterns/analyze
// 패턴 분석 실행 (관리자 전용)

const patternMiner = require('../../backend/patternMining');
const fs = require('fs');
const path = require('path');

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
    const { lookbackDays = 30, minReturn = 15 } = req.body || {};

    console.log(`🔍 패턴 분석 시작: ${lookbackDays}일, ${minReturn}% 이상 급등`);

    // 패턴 분석 실행
    const result = await patternMiner.analyzeSurgePatterns(lookbackDays, minReturn);

    if (!result) {
      return res.status(400).json({
        success: false,
        error: '충분한 데이터가 없어 패턴을 추출할 수 없습니다.'
      });
    }

    // data 폴더가 없으면 생성
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 결과 저장 (rawData 제외)
    const saveData = {
      generatedAt: result.generatedAt,
      parameters: result.parameters,
      patterns: result.patterns
    };

    const savePath = path.join(dataDir, 'patterns.json');
    fs.writeFileSync(savePath, JSON.stringify(saveData, null, 2));

    console.log(`✅ 패턴 분석 완료: ${result.patterns.length}개 패턴 발견`);

    res.status(200).json({
      success: true,
      message: '패턴 분석이 완료되었습니다.',
      generatedAt: result.generatedAt,
      parameters: result.parameters,
      patternsFound: result.patterns.length,
      patterns: result.patterns
    });

  } catch (error) {
    console.error('Pattern analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
