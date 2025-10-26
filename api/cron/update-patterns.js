// Vercel Cron Job
// 매일 장 마감 후 패턴 분석 자동 업데이트
// Schedule: 매일 오후 6시 (한국 시간 기준)

const patternMiner = require('../../backend/patternMining');
const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  // Vercel Cron Secret 검증
  const authHeader = req.headers.authorization;

  if (process.env.CRON_SECRET) {
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  }

  console.log('🕐 [CRON] 패턴 분석 자동 업데이트 시작:', new Date().toISOString());

  try {
    // 패턴 분석 실행 (최근 30일, 15% 이상 급등)
    const result = await patternMiner.analyzeSurgePatterns(30, 15);

    if (!result) {
      console.log('⚠️ [CRON] 충분한 데이터가 없어 패턴을 추출하지 못했습니다.');
      return res.status(200).json({
        success: true,
        message: '패턴 분석 실행됨 (데이터 부족)',
        patternsFound: 0
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

    console.log(`✅ [CRON] 패턴 분석 완료: ${result.patterns.length}개 패턴 발견`);
    console.log(`💾 [CRON] 결과 저장: ${savePath}`);

    // 상위 3개 패턴 로그
    result.patterns.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} - 출현율 ${p.frequency}%, 평균 익일 수익률 +${p.avgReturn}%, 승률 ${p.backtest?.winRate}%`);
    });

    res.status(200).json({
      success: true,
      message: '패턴 분석이 성공적으로 완료되었습니다.',
      generatedAt: result.generatedAt,
      parameters: result.parameters,
      patternsFound: result.patterns.length,
      topPatterns: result.patterns.slice(0, 5).map(p => ({
        name: p.name,
        frequency: p.frequency,
        avgReturn: p.avgReturn,
        winRate: p.backtest?.winRate
      }))
    });

  } catch (error) {
    console.error('❌ [CRON] 패턴 분석 실패:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
