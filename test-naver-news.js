/**
 * 네이버 뉴스 API 단독 테스트
 */

require('dotenv').config();

async function testNaverNews() {
  console.log('\n========================================');
  console.log('📰 네이버 뉴스 API 테스트');
  console.log('========================================\n');

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  console.log('환경변수 확인:');
  console.log(`  NAVER_CLIENT_ID: ${clientId ? '✅ 설정됨' : '❌ 없음'}`);
  console.log(`  NAVER_CLIENT_SECRET: ${clientSecret ? '✅ 설정됨' : '❌ 없음'}\n`);

  if (!clientId || !clientSecret) {
    console.log('❌ 네이버 API 키가 설정되지 않았습니다.\n');
    return false;
  }

  try {
    const query = encodeURIComponent('삼성전자');
    const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=5&sort=date`;

    console.log(`🔍 검색어: "삼성전자"`);
    console.log(`📡 요청 URL: ${url}\n`);

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    console.log(`📊 응답 상태: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ API 오류:');
      console.log(errorText);
      return false;
    }

    const data = await response.json();

    console.log('✅ API 호출 성공!\n');
    console.log(`📰 검색 결과: ${data.total}개 발견, ${data.items.length}개 반환\n`);

    if (data.items && data.items.length > 0) {
      console.log('최근 뉴스 5개:\n');
      data.items.forEach((item, idx) => {
        // HTML 태그 제거
        const title = item.title
          .replace(/<[^>]*>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'");

        console.log(`  ${idx + 1}. ${title}`);
        console.log(`     🔗 ${item.link}`);
        console.log(`     📅 ${new Date(item.pubDate).toLocaleString('ko-KR')}\n`);
      });
    }

    console.log('========================================');
    console.log('✅ 네이버 뉴스 API 정상 작동!');
    console.log('========================================\n');

    return true;

  } catch (error) {
    console.error('❌ 네이버 뉴스 API 오류:', error.message);
    return false;
  }
}

// 실행
if (require.main === module) {
  testNaverNews().catch(console.error);
}

module.exports = { testNaverNews };
