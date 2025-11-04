/**
 * Gemini AI 감성 분석 테스트
 */

require('dotenv').config();

async function testGemini() {
  console.log('\n========================================');
  console.log('🤖 Gemini AI 감성 분석 테스트');
  console.log('========================================\n');

  const apiKey = process.env.GEMINI_API_KEY;

  console.log('환경변수 확인:');
  console.log(`  GEMINI_API_KEY: ${apiKey ? '✅ 설정됨 (' + apiKey.substring(0, 20) + '...)' : '❌ 없음'}\n`);

  if (!apiKey) {
    console.log('❌ Gemini API 키가 설정되지 않았습니다.\n');
    return false;
  }

  try {
    const sentimentAnalyzer = require('./backend/sentimentAnalyzer');

    // 테스트 뉴스 제목들
    const testNews = [
      {
        title: '삼성전자, 3분기 영업이익 10조 돌파…반도체 회복세',
        expected: 'positive'
      },
      {
        title: '삼성전자 주가 오늘 1% 상승 마감',
        expected: 'neutral'
      },
      {
        title: '삼성전자 실적 악화 우려…애널리스트 목표가 하향',
        expected: 'negative'
      }
    ];

    console.log('📊 테스트 뉴스 3개 분석 중...\n');

    for (let i = 0; i < testNews.length; i++) {
      const news = testNews[i];

      console.log(`${i + 1}. "${news.title}"`);
      console.log(`   예상 감성: ${news.expected}`);

      const result = await sentimentAnalyzer.analyzeSentiment(news.title, '삼성전자');

      if (result) {
        console.log(`   ✅ 결과: ${result.sentiment} (임팩트: ${result.impact_score}점)`);
        console.log(`   📌 키워드: ${result.keywords.join(', ')}`);

        if (result.sentiment === news.expected) {
          console.log(`   ✅ 예상과 일치!\n`);
        } else {
          console.log(`   ⚠️  예상과 다름 (${news.expected} vs ${result.sentiment})\n`);
        }
      } else {
        console.log(`   ❌ 분석 실패\n`);
      }

      // Rate Limit 방지 (1초 대기)
      if (i < testNews.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('========================================');
    console.log('✅ Gemini AI 감성 분석 테스트 완료!');
    console.log('========================================\n');

    return true;

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error('상세:', error);
    return false;
  }
}

// 실행
testGemini().catch(console.error);
