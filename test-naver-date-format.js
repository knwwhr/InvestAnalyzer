/**
 * 네이버 API 날짜 형식 확인
 */

require('dotenv').config();

async function testNaverDateFormat() {
  console.log('\n🔍 네이버 API 날짜 형식 테스트\n');

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log('❌ 네이버 API 키 없음\n');
    return;
  }

  try {
    const query = encodeURIComponent('삼성전자');
    const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=3&sort=date`;

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    const data = await response.json();
    const items = data.items || [];

    console.log(`뉴스 ${items.length}개 수신\n`);

    items.forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.title.replace(/<[^>]*>/g, '').substring(0, 40)}...`);
      console.log(`   원본 날짜: ${item.pubDate}`);

      // 파싱
      const parsed = new Date(item.pubDate);
      console.log(`   파싱 결과: ${parsed.toString()}`);
      console.log(`   ISO 8601: ${parsed.toISOString()}`);
      console.log(`   UTC 시간: ${parsed.toUTCString()}`);

      // 현재 시간과 비교
      const now = new Date();
      const hoursAgo = Math.floor((now - parsed) / (1000 * 60 * 60));
      console.log(`   현재로부터: ${hoursAgo}시간 전`);
      console.log(`   24시간 이내?: ${hoursAgo < 24 ? '✅' : '❌'}\n`);
    });

    // 24시간 전 기준 시간
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`24시간 기준선: ${oneDayAgo.toISOString()}\n`);

    // 필터링 테스트
    const recent = items.filter(item => {
      const pubDate = new Date(item.pubDate);
      return pubDate >= oneDayAgo;
    });

    console.log(`24시간 내 뉴스 필터 결과: ${recent.length}/${items.length}개`);

  } catch (error) {
    console.error('❌ 에러:', error.message);
  }

  console.log('\n========================================\n');
}

testNaverDateFormat().catch(console.error);
