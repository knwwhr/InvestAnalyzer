/**
 * Gemini AI 기반 뉴스 감성 분석
 * 뉴스 제목으로 감성(positive/neutral/negative) 및 영향도 판단
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const supabase = require('./supabaseClient');

class SentimentAnalyzer {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.genAI = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    // gemini-flash-latest: 가장 안정적인 최신 모델
    this.model = this.genAI ? this.genAI.getGenerativeModel({ model: "gemini-flash-latest" }) : null;
    this.delayMs = 1000; // API Rate Limit: 1,500/day ≈ 1초당 1회
  }

  /**
   * 단일 뉴스 감성 분석
   * @param {string} newsTitle - 뉴스 제목
   * @param {string} stockName - 종목명
   * @returns {Promise<Object>} 감성 분석 결과
   */
  async analyzeSentiment(newsTitle, stockName) {
    if (!this.model) {
      console.warn('⚠️  Gemini API 키가 설정되지 않았습니다. 감성 분석을 건너뜁니다.');
      return null;
    }

    try {
      const prompt = `
다음 뉴스 제목이 "${stockName}" 주식에 미치는 영향을 분석하세요.

뉴스 제목: "${newsTitle}"

다음 형식으로 JSON만 답변해주세요:
{
  "sentiment": "positive" 또는 "neutral" 또는 "negative",
  "impact_score": 0-100 사이 정수,
  "keywords": ["키워드1", "키워드2", "키워드3"]
}

판단 기준:
- positive: 주가 상승 요인 (실적 개선, 신제품, 투자 유치 등)
- neutral: 중립적 뉴스 (단순 언급, 업계 동향 등)
- negative: 주가 하락 요인 (실적 악화, 소송, 사고 등)
- impact_score: 해당 뉴스가 주가에 미칠 영향도 (0=무관, 100=최대영향)
- keywords: 핵심 키워드 3개 추출

JSON만 답변하고 다른 설명은 하지 마세요.
`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSON 파싱
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('⚠️  Gemini AI 응답 파싱 실패:', text);
        return null;
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // 유효성 검증
      const validSentiments = ['positive', 'neutral', 'negative'];
      if (!validSentiments.includes(analysis.sentiment)) {
        analysis.sentiment = 'neutral';
      }

      if (typeof analysis.impact_score !== 'number' || analysis.impact_score < 0 || analysis.impact_score > 100) {
        analysis.impact_score = 50;
      }

      if (!Array.isArray(analysis.keywords)) {
        analysis.keywords = [];
      }

      return {
        sentiment: analysis.sentiment,
        impact_score: Math.round(analysis.impact_score),
        keywords: analysis.keywords
      };

    } catch (error) {
      console.error('❌ Gemini AI 감성 분석 실패:', error.message);
      return null;
    }
  }

  /**
   * 배치 감성 분석 (Supabase 뉴스에 대해)
   * @param {string} stockCode - 종목 코드
   * @param {string} stockName - 종목명
   * @returns {Promise<Object>} 분석 결과 통계
   */
  async analyzeBatchForStock(stockCode, stockName) {
    if (!supabase) {
      console.warn('⚠️  Supabase 미설정');
      return null;
    }

    try {
      // 최근 24시간 내 감성 분석되지 않은 뉴스 조회
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const { data: newsItems, error } = await supabase
        .from('news_mentions')
        .select('id, news_title')
        .eq('stock_code', stockCode)
        .gte('published_at', oneDayAgo.toISOString())
        .is('sentiment', null)
        .limit(10); // 최대 10개만 분석 (API 한도 고려)

      if (error || !newsItems || newsItems.length === 0) {
        return {
          stockCode,
          stockName,
          analyzed: 0,
          skipped: 'No news or already analyzed'
        };
      }

      console.log(`🤖 [${stockName}] ${newsItems.length}개 뉴스 감성 분석 시작...`);

      let analyzed = 0;
      const results = {
        positive: 0,
        neutral: 0,
        negative: 0,
        totalImpact: 0
      };

      for (const news of newsItems) {
        try {
          const sentiment = await this.analyzeSentiment(news.news_title, stockName);

          if (sentiment) {
            // Supabase 업데이트
            await supabase
              .from('news_mentions')
              .update({
                sentiment: sentiment.sentiment,
                impact_score: sentiment.impact_score,
                keywords: sentiment.keywords
              })
              .eq('id', news.id);

            analyzed++;
            results[sentiment.sentiment]++;
            results.totalImpact += sentiment.impact_score;

            console.log(`  ✅ [${analyzed}/${newsItems.length}] ${sentiment.sentiment} (영향도: ${sentiment.impact_score})`);
          }

          // Rate Limit 방지 (1초 대기)
          if (analyzed < newsItems.length) {
            await this.delay(this.delayMs);
          }

        } catch (error) {
          console.error(`  ❌ 분석 실패:`, error.message);
        }
      }

      console.log(`✅ [${stockName}] 감성 분석 완료: ${analyzed}개`);

      return {
        stockCode,
        stockName,
        analyzed,
        results: {
          ...results,
          avgImpact: analyzed > 0 ? (results.totalImpact / analyzed).toFixed(1) : 0
        }
      };

    } catch (error) {
      console.error('❌ 배치 감성 분석 실패:', error);
      return null;
    }
  }

  /**
   * 여러 종목 배치 감성 분석
   * @param {Array} stocks - [{stockCode, stockName}, ...]
   * @returns {Promise<Array>} 분석 결과
   */
  async analyzeBatchStocks(stocks) {
    console.log(`\n🤖 Gemini AI 감성 분석 시작 (${stocks.length}개 종목)\n`);

    const results = [];
    let totalAnalyzed = 0;

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];

      try {
        const result = await this.analyzeBatchForStock(stock.stockCode, stock.stockName);

        if (result) {
          results.push(result);
          totalAnalyzed += result.analyzed || 0;
        }

        // 종목 간 간격 (API 한도 고려)
        if (i < stocks.length - 1) {
          await this.delay(this.delayMs);
        }

      } catch (error) {
        console.error(`❌ [${stock.stockName}] 실패:`, error.message);
      }
    }

    console.log(`\n✅ Gemini AI 감성 분석 완료: ${totalAnalyzed}개 뉴스\n`);

    return {
      totalStocks: stocks.length,
      totalNewsAnalyzed: totalAnalyzed,
      results
    };
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new SentimentAnalyzer();
