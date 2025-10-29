// Vercel Serverless Function
// POST /api/patterns/analyze
// 스마트 패턴 분석 실행 (3단계 필터링)

const smartPatternMiner = require('../../backend/smartPatternMining');
const patternCache = require('../../backend/patternCache');
const gistStorage = require('../../backend/gistStorage');

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
    console.log(`🔍 스마트 패턴 분석 시작 (3단계 필터링)`);

    // 스마트 패턴 분석 실행
    const result = await smartPatternMiner.analyzeSmartPatterns();

    if (!result) {
      return res.status(400).json({
        success: false,
        error: '충분한 데이터가 없어 패턴을 추출할 수 없습니다.'
      });
    }

    // 결과를 메모리 캐시에 저장
    const saveData = {
      generatedAt: result.generatedAt,
      parameters: result.parameters,
      stocks: result.stocks,
      patterns: result.patterns  // 빈 배열 (하위 호환성)
    };

    patternCache.savePatterns(saveData);

    // GitHub Gist에 영구 저장 (Vercel stateless 문제 해결)
    if (gistStorage.isConfigured()) {
      console.log('💾 GitHub Gist에 패턴 저장 시도...');
      const gistSaved = await gistStorage.savePatterns(saveData);
      if (gistSaved) {
        console.log('✅ GitHub Gist 저장 성공');
      } else {
        console.log('⚠️ GitHub Gist 저장 실패 (메모리 캐시 사용)');
      }
    } else {
      console.log('⚠️ GitHub Gist 미설정 (GITHUB_GIST_ID 환경변수 필요)');
    }

    // 로컬 개발 환경에서는 파일로도 저장 시도
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(process.cwd(), 'data');

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const savePath = path.join(dataDir, 'patterns.json');
      fs.writeFileSync(savePath, JSON.stringify(saveData, null, 2));
      console.log(`✅ 로컬 파일 저장 성공: ${savePath}`);
    } catch (fsError) {
      // Vercel에서는 파일 저장 실패해도 무시 (캐시만 사용)
      console.log('ℹ️ 로컬 파일 저장 생략 (Serverless 환경)');
    }

    console.log(`✅ D-5 선행 지표 분석 완료: ${result.stocks.length}개 급등 종목 발견`);

    res.status(200).json({
      success: true,
      message: 'D-5 선행 지표 분석이 완료되었습니다.',
      generatedAt: result.generatedAt,
      parameters: result.parameters,
      stocksFound: result.stocks.length,
      stocks: result.stocks,
      patterns: result.patterns  // 빈 배열 (하위 호환성)
    });

  } catch (error) {
    console.error('Pattern analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
