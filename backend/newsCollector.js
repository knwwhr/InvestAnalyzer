/**
 * 네이버 뉴스 API 수집
 * 종목별 뉴스 언급 수집 및 저장
 */

const supabase = require('./supabaseClient');

class NewsCollector {
  constructor() {
    this.clientId = process.env.NAVER_CLIENT_ID;
    this.clientSecret = process.env.NAVER_CLIENT_SECRET;
    this.delayMs = 100; // API Rate Limit: 25,000/day = 초당 약 0.3회 (안전하게 100ms 간격)
  }

  /**
   * 단일 종목 뉴스 검색
   * @param {string} stockCode - 종목 코드
   * @param {string} stockName - 종목명
   * @param {number} display - 검색 결과 수 (기본 10개)
   * @returns {Promise<Array>} 뉴스 데이터
   */
  async searchStockNews(stockCode, stockName, display = 10) {
    if (!this.clientId || !this.clientSecret) {
      console.warn('⚠️  네이버 API 키가 설정되지 않았습니다. 뉴스 수집을 건너뜁니다.');
      return [];
    }

    try {
      const query = encodeURIComponent(stockName);
      const url = `https://openapi.naver.com/v1/search/news.json?query=${query}&display=${display}&sort=date`;

      const response = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': this.clientId,
          'X-Naver-Client-Secret': this.clientSecret
        }
      });

      if (!response.ok) {
        console.warn(`⚠️  네이버 뉴스 API 오류 [${stockName}]:`, response.status);
        return [];
      }

      const data = await response.json();
      const items = data.items || [];

      // HTML 태그 제거 및 데이터 정리
      const newsData = items.map(item => ({
        stock_code: stockCode,
        stock_name: stockName,
        news_title: this.stripHtml(item.title),
        news_url: item.link,
        news_source: '네이버',
        published_at: this.parseNaverDate(item.pubDate)
      }));

      // Supabase에 저장
      if (supabase && newsData.length > 0) {
        const { error } = await supabase
          .from('news_mentions')
          .upsert(newsData, {
            onConflict: 'news_url',
            ignoreDuplicates: true
          });

        if (error) {
          console.error(`❌ 뉴스 저장 실패 [${stockName}]:`, error.message);
        }
      }

      return newsData;

    } catch (error) {
      console.warn(`뉴스 검색 실패 [${stockName}]:`, error.message);
      return [];
    }
  }

  /**
   * 여러 종목 배치 수집
   * @param {Array} stocks - [{stockCode, stockName}, ...]
   * @param {number} display - 종목당 뉴스 수 (기본 10개)
   * @returns {Promise<Object>} 수집 결과
   */
  async collectBatch(stocks, display = 10) {
    console.log(`\n📰 네이버 뉴스 수집 시작 (${stocks.length}개 종목)\n`);

    const results = [];
    let successCount = 0;
    let totalNews = 0;

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];

      try {
        const newsData = await this.searchStockNews(
          stock.stockCode,
          stock.stockName,
          display
        );

        if (newsData.length > 0) {
          results.push({
            stockCode: stock.stockCode,
            stockName: stock.stockName,
            newsCount: newsData.length
          });

          successCount++;
          totalNews += newsData.length;

          if (newsData.length >= 5) {
            console.log(`  📰 [${stock.stockName}] ${newsData.length}개 뉴스 수집`);
          }
        }

        // Rate Limit 방지 (100ms 대기)
        if (i < stocks.length - 1) {
          await this.delay(this.delayMs);
        }

      } catch (error) {
        console.error(`  ❌ [${stock.stockName}] 실패:`, error.message);
      }
    }

    console.log(`\n✅ 네이버 뉴스 수집 완료: ${successCount}/${stocks.length}개`);
    console.log(`   📰 총 뉴스: ${totalNews}개\n`);

    return {
      successCount,
      totalNews,
      results
    };
  }

  /**
   * 최근 24시간 언급 횟수 조회
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<number>} 언급 횟수
   */
  async getMentionCount24h(stockCode) {
    if (!supabase) return 0;

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { count, error } = await supabase
        .from('news_mentions')
        .select('*', { count: 'exact', head: true })
        .eq('stock_code', stockCode)
        .gte('published_at', oneDayAgo.toISOString());

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('언급 횟수 조회 실패:', error);
      return 0;
    }
  }

  /**
   * 최근 7일 언급 횟수 조회
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<number>} 언급 횟수
   */
  async getMentionCount7d(stockCode) {
    if (!supabase) return 0;

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { count, error } = await supabase
        .from('news_mentions')
        .select('*', { count: 'exact', head: true })
        .eq('stock_code', stockCode)
        .gte('published_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('언급 횟수 조회 실패:', error);
      return 0;
    }
  }

  /**
   * HTML 태그 제거
   */
  stripHtml(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
  }

  /**
   * 네이버 날짜 형식 파싱
   * @param {string} naverDate - "Mon, 04 Nov 2025 12:34:56 +0900"
   * @returns {string} ISO 8601 형식
   */
  parseNaverDate(naverDate) {
    try {
      return new Date(naverDate).toISOString();
    } catch (error) {
      return new Date().toISOString();
    }
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new NewsCollector();
