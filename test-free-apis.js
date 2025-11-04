/**
 * 무료 API 테스트
 * Google Trends + RSS + Gemini AI
 */

require('dotenv').config();

// 1. Google Trends 테스트 (무료, API 키 불필요)
async function testGoogleTrends() {
  console.log('\n========================================');
  console.log('🔍 Google Trends API 테스트 (무료)');
  console.log('========================================\n');

  const googleTrends = require('google-trends-api');

  try {
    // 삼성전자 검색 트렌드 (최근 7일)
    const results = await googleTrends.interestOverTime({
      keyword: '삼성전자',
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      geo: 'KR'
    });

    const data = JSON.parse(results);
    const timeline = data.default.timelineData;

    console.log('📊 "삼성전자" 검색 트렌드 (최근 7일):\n');

    // 최근 3일만 표시
    timeline.slice(-3).forEach(point => {
      const date = new Date(point.time * 1000).toLocaleDateString('ko-KR');
      const value = point.value[0];
      const bar = '█'.repeat(Math.floor(value / 5));
      console.log(`  ${date}: ${value.toString().padStart(3)} ${bar}`);
    });

    // 평균 및 최근 값
    const avgValue = timeline.reduce((sum, d) => sum + d.value[0], 0) / timeline.length;
    const recentValue = timeline[timeline.length - 1].value[0];
    const changeRate = ((recentValue - avgValue) / avgValue * 100).toFixed(2);

    console.log(`\n  📈 평균: ${avgValue.toFixed(1)}`);
    console.log(`  📍 최근: ${recentValue}`);
    console.log(`  ${changeRate >= 0 ? '⬆️' : '⬇️'} 변화율: ${changeRate}%`);

    if (Math.abs(changeRate) > 100) {
      console.log(`  🔥 검색량 급증 감지! (평균 대비 ${changeRate}%)`);
    }

    console.log('\n✅ Google Trends API 정상 작동');
    return true;

  } catch (error) {
    console.error('❌ Google Trends 오류:', error.message);
    return false;
  }
}

// 2. RSS 뉴스 수집 테스트 (무료, API 키 불필요)
async function testRSSFeed() {
  console.log('\n========================================');
  console.log('📰 RSS 뉴스 수집 테스트 (무료)');
  console.log('========================================\n');

  const Parser = require('rss-parser');
  const parser = new Parser();

  try {
    // 서울경제 전체 뉴스 RSS
    const feed = await parser.parseURL('https://www.sedaily.com/RSS/RSS_S01.xml');

    console.log(`📡 RSS 피드: ${feed.title}`);
    console.log(`📅 업데이트: ${new Date(feed.lastBuildDate).toLocaleString('ko-KR')}\n`);

    // 최근 5개 뉴스만 표시
    console.log('최근 뉴스 (5개):');
    feed.items.slice(0, 5).forEach((item, idx) => {
      console.log(`\n  ${idx + 1}. ${item.title}`);
      console.log(`     🔗 ${item.link}`);
      console.log(`     📅 ${new Date(item.pubDate).toLocaleString('ko-KR')}`);

      // 종목명 추출 시도
      const stockMatches = item.title.match(/([가-힣]+(?:전자|화학|바이오|제약|건설|중공업|금융|카드|생명|자동차))/g);
      if (stockMatches) {
        console.log(`     🏢 언급 종목: ${stockMatches.join(', ')}`);
      }
    });

    console.log('\n✅ RSS 피드 수집 정상 작동');
    return true;

  } catch (error) {
    console.error('❌ RSS 수집 오류:', error.message);
    return false;
  }
}

// 3. Gemini AI 테스트 (무료, API 키 필요)
async function testGeminiAI() {
  console.log('\n========================================');
  console.log('🤖 Gemini AI 분석 테스트 (무료)');
  console.log('========================================\n');

  if (!process.env.GEMINI_API_KEY) {
    console.log('⚠️  GEMINI_API_KEY가 설정되지 않았습니다.\n');
    console.log('📝 API 키 발급 방법:');
    console.log('   1. https://makersuite.google.com/app/apikey 접속');
    console.log('   2. "Create API Key" 클릭');
    console.log('   3. .env 파일에 추가:');
    console.log('      GEMINI_API_KEY=your_key_here\n');
    console.log('💡 Gemini API는 완전 무료입니다!');
    console.log('   - 일일 1,500 requests 무료');
    console.log('   - 크레딧 카드 불필요');
    console.log('   - 한국어 지원 우수\n');
    return false;
  }

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 최신 모델

    // 테스트 뉴스
    const testNews = '삼성전자, HBM3 양산 본격화...SK하이닉스와 AI 반도체 경쟁 치열';

    console.log(`📰 분석할 뉴스: "${testNews}"\n`);
    console.log('🤖 AI 분석 중...\n');

    const prompt = `
다음 뉴스를 분석하여 JSON 형식으로 답변해주세요.

뉴스: ${testNews}

분석 항목:
1. 언급된 종목명들 (배열)
2. 감성 (positive/neutral/negative)
3. 핵심 키워드 (3개)
4. 주가에 미치는 영향 점수 (0-100)
5. 한 줄 요약

JSON 형식:
{
  "stocks": ["종목명1", "종목명2"],
  "sentiment": "positive",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "impact_score": 85,
  "summary": "한 줄 요약"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('📊 AI 분석 결과:\n');
    console.log(text);

    // JSON 파싱 시도
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      console.log('\n✅ 파싱된 데이터:');
      console.log(`   🏢 언급 종목: ${analysis.stocks.join(', ')}`);
      console.log(`   😊 감성: ${analysis.sentiment}`);
      console.log(`   🎯 영향도: ${analysis.impact_score}/100`);
      console.log(`   🔖 키워드: ${analysis.keywords.join(', ')}`);
      console.log(`   📝 요약: ${analysis.summary}`);
    }

    console.log('\n✅ Gemini AI 정상 작동');
    return true;

  } catch (error) {
    console.error('❌ Gemini AI 오류:', error.message);
    return false;
  }
}

// 통합 테스트 실행
async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════╗');
  console.log('║  🚀 무료 API 통합 테스트              ║');
  console.log('║                                        ║');
  console.log('║  ✅ Google Trends (검색량)            ║');
  console.log('║  ✅ RSS Feed (뉴스)                   ║');
  console.log('║  ✅ Gemini AI (분석)                  ║');
  console.log('╚════════════════════════════════════════╝');

  const results = {
    trends: await testGoogleTrends(),
    rss: await testRSSFeed(),
    gemini: await testGeminiAI()
  };

  console.log('\n========================================');
  console.log('📊 테스트 결과 요약');
  console.log('========================================\n');
  console.log(`  Google Trends: ${results.trends ? '✅ 성공' : '❌ 실패'}`);
  console.log(`  RSS 뉴스 수집: ${results.rss ? '✅ 성공' : '❌ 실패'}`);
  console.log(`  Gemini AI:     ${results.gemini ? '✅ 성공' : '⚠️  API 키 필요'}`);

  const successCount = Object.values(results).filter(r => r).length;
  console.log(`\n  성공: ${successCount}/3`);

  if (successCount === 3) {
    console.log('\n🎉 모든 무료 API가 정상 작동합니다!');
    console.log('💰 비용: $0/월');
    console.log('🚀 바로 실전 구현 가능!\n');
  } else if (!results.gemini && results.trends && results.rss) {
    console.log('\n📝 Gemini API 키만 추가하면 완성됩니다!');
    console.log('   → https://makersuite.google.com/app/apikey\n');
  }
}

// 실행
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testGoogleTrends, testRSSFeed, testGeminiAI };
