/**
 * 트렌드 점수 계산
 * 검색량 + 뉴스 언급 + AI 감성 = 종합 트렌드 점수
 */

const supabase = require('./supabaseClient');

class TrendScoring {
  /**
   * 검색 트렌드 점수 계산 (비활성화 - Google Trends 사용 안 함)
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<Object>} 검색 점수 정보
   */
  async calculateSearchScore(stockCode) {
    // Google Trends API 차단으로 인해 비활성화
    // 네이버 뉴스 + Gemini AI만 사용 (60점 만점)
    return {
      score: 0,
      surge: false,
      changeRate: 0,
      searchValue: 0,
      disabled: true
    };
  }

  /**
   * 뉴스 언급 점수 계산 (0-40점)
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<Object>} 뉴스 점수 정보
   */
  async calculateNewsScore(stockCode) {
    if (!supabase) return { score: 0, mentions: 0 };

    try {
      const now = new Date();
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

      // 24시간 언급 횟수
      const { data: mentions24h, error: e1 } = await supabase
        .from('news_mentions')
        .select('id', { count: 'exact', head: true })
        .eq('stock_code', stockCode)
        .gte('published_at', oneDayAgo.toISOString());

      // 7일 언급 횟수
      const { data: mentions7d, error: e2 } = await supabase
        .from('news_mentions')
        .select('id', { count: 'exact', head: true })
        .eq('stock_code', stockCode)
        .gte('published_at', sevenDaysAgo.toISOString());

      if (e1 || e2) {
        return { score: 0, mentions: 0 };
      }

      const count24h = mentions24h?.length || 0;
      const count7d = mentions7d?.length || 0;

      let score = 0;

      // 1. 절대 언급량 (0-20점)
      // 24시간 10회 이상 = 20점
      score += Math.min((count24h / 10) * 20, 20);

      // 2. 증가율 (0-20점)
      // 24시간 언급이 7일 평균의 3배 이상 = 20점
      const avg7d = count7d / 7;
      if (avg7d > 0 && count24h > avg7d * 3) {
        score += 20;
      } else if (avg7d > 0) {
        score += Math.min((count24h / avg7d / 3) * 20, 20);
      }

      return {
        score: Math.min(parseFloat(score.toFixed(2)), 40),
        mentions24h: count24h,
        mentions7d: count7d,
        changeRate: avg7d > 0 ? ((count24h - avg7d) / avg7d * 100).toFixed(2) : 0
      };

    } catch (error) {
      console.error('뉴스 점수 계산 실패:', error);
      return { score: 0, mentions: 0 };
    }
  }

  /**
   * AI 감성 점수 계산 (0-20점)
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<Object>} 감성 점수 정보
   */
  async calculateSentimentScore(stockCode) {
    if (!supabase) return { score: 0, positiveRatio: 0 };

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // 최근 24시간 뉴스의 감성 분석 결과
      const { data, error } = await supabase
        .from('news_mentions')
        .select('sentiment')
        .eq('stock_code', stockCode)
        .gte('published_at', oneDayAgo.toISOString())
        .not('sentiment', 'is', null);

      if (error || !data || data.length === 0) {
        return { score: 0, positiveRatio: 0 };
      }

      // 긍정/중립/부정 카운트
      const sentiments = data.map(d => d.sentiment);
      const positiveCount = sentiments.filter(s => s === 'positive').length;
      const neutralCount = sentiments.filter(s => s === 'neutral').length;
      const negativeCount = sentiments.filter(s => s === 'negative').length;
      const total = sentiments.length;

      // 긍정 비율
      const positiveRatio = (positiveCount / total) * 100;

      // 점수 계산
      // 긍정 70% 이상 = 20점
      // 중립 포함 긍정 80% 이상 = 15점
      let score = 0;
      if (positiveRatio >= 70) {
        score = 20;
      } else if ((positiveCount + neutralCount) / total >= 0.8) {
        score = 15;
      } else {
        score = (positiveRatio / 70) * 20;
      }

      return {
        score: Math.min(parseFloat(score.toFixed(2)), 20),
        positiveRatio: parseFloat(positiveRatio.toFixed(2)),
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount
      };

    } catch (error) {
      console.error('감성 점수 계산 실패:', error);
      return { score: 0, positiveRatio: 0 };
    }
  }

  /**
   * 종합 트렌드 점수 계산 및 저장
   * @param {string} stockCode - 종목 코드
   * @param {string} stockName - 종목명
   * @returns {Promise<Object>} 종합 점수
   */
  async calculateTotalScore(stockCode, stockName) {
    try {
      // 각 점수 계산
      const searchResult = await this.calculateSearchScore(stockCode);
      const newsResult = await this.calculateNewsScore(stockCode);
      const sentimentResult = await this.calculateSentimentScore(stockCode);

      // 종합 점수 (최대 60점 - 뉴스 40점 + 감성 20점)
      // 검색 트렌드는 Google Trends 차단으로 비활성화
      const totalScore = newsResult.score + sentimentResult.score;
      const isHotIssue = totalScore >= 42; // 60점의 70%

      const scoreData = {
        stock_code: stockCode,
        stock_name: stockName,
        search_score: searchResult.score,
        search_surge: searchResult.surge,
        news_score: newsResult.score,
        mentions_24h: newsResult.mentions24h,
        mentions_7d: newsResult.mentions7d,
        mention_change_rate: newsResult.changeRate,
        sentiment_score: sentimentResult.score,
        positive_ratio: sentimentResult.positiveRatio,
        total_trend_score: parseFloat(totalScore.toFixed(2)),
        is_hot_issue: isHotIssue
      };

      // Supabase에 저장
      if (supabase) {
        await supabase
          .from('stock_trend_scores')
          .upsert(scoreData, {
            onConflict: 'stock_code,DATE(updated_at)',
            ignoreDuplicates: false
          });
      }

      return {
        ...scoreData,
        breakdown: {
          search: searchResult,
          news: newsResult,
          sentiment: sentimentResult
        }
      };

    } catch (error) {
      console.error('종합 점수 계산 실패:', error);
      return null;
    }
  }

  /**
   * 여러 종목 배치 점수 계산
   * @param {Array} stocks - [{stockCode, stockName}, ...]
   * @returns {Promise<Array>} 점수 목록
   */
  async calculateBatchScores(stocks) {
    console.log(`\n📊 트렌드 점수 계산 시작 (${stocks.length}개 종목)\n`);

    const results = [];
    let hotCount = 0;

    for (const stock of stocks) {
      try {
        const scoreData = await this.calculateTotalScore(
          stock.stockCode,
          stock.stockName
        );

        if (scoreData) {
          results.push(scoreData);

          if (scoreData.is_hot_issue) {
            hotCount++;
            console.log(`  🔥 [${stock.stockName}] HOT 이슈! 점수: ${scoreData.total_trend_score}점`);
          }
        }
      } catch (error) {
        console.error(`  ❌ [${stock.stockName}] 실패:`, error.message);
      }
    }

    console.log(`\n✅ 트렌드 점수 계산 완료: ${results.length}/${stocks.length}개`);
    console.log(`   🔥 HOT 이슈: ${hotCount}개\n`);

    return results;
  }

  /**
   * HOT 이슈 종목 조회
   * @returns {Promise<Array>} HOT 이슈 종목 목록
   */
  async getHotIssueStocks() {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('hot_issue_stocks')
        .select('*')
        .order('total_trend_score', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('HOT 이슈 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 종목의 트렌드 점수 조회
   * @param {string} stockCode - 종목 코드
   * @returns {Promise<Object>} 트렌드 점수
   */
  async getStockTrendScore(stockCode) {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('stock_trend_scores')
        .select('*')
        .eq('stock_code', stockCode)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      return data[0];
    } catch (error) {
      console.error('트렌드 점수 조회 실패:', error);
      return null;
    }
  }
}

module.exports = new TrendScoring();
