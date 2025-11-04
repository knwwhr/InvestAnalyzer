/**
 * Google Trends 데이터 수집
 * 종목별 검색량 추이 및 급증 감지
 */

const googleTrends = require('google-trends-api');
const supabase = require('./supabaseClient');

class TrendCollector {
  constructor() {
    this.delayMs = 2000; // Google Trends Rate Limit 방지
  }

  /**
   * 단일 종목 검색 트렌드 수집
   * @param {string} stockCode - 종목 코드
   * @param {string} stockName - 종목명
   * @returns {Promise<Object>} 트렌드 데이터
   */
  async collectStockTrend(stockCode, stockName) {
    try {
      // 최근 7일 검색 트렌드 조회
      const results = await googleTrends.interestOverTime({
        keyword: stockName,
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(),
        geo: 'KR'
      });

      const data = JSON.parse(results);
      const timeline = data.default?.timelineData;

      if (!timeline || timeline.length === 0) {
        console.log(`⚠️  검색 데이터 없음 [${stockName}]`);
        return null;
      }

      // 통계 계산
      const values = timeline.map(d => d.value[0]);
      const recentValue = values[values.length - 1];
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
      const changeRate = ((recentValue - avgValue) / avgValue) * 100;

      // 급증 감지 (평균 대비 3배 이상 또는 300% 이상 증가)
      const isSurging = recentValue > avgValue * 3 || changeRate > 300;

      // 급증 점수 계산 (0-100)
      let surgeScore = 0;
      if (isSurging) {
        surgeScore = Math.min(changeRate / 5, 100); // 500% = 100점
      }

      const trendData = {
        stock_code: stockCode,
        stock_name: stockName,
        search_value: recentValue,
        avg_value: parseFloat(avgValue.toFixed(2)),
        change_rate: parseFloat(changeRate.toFixed(2)),
        surge_detected: isSurging,
        surge_score: Math.round(surgeScore)
      };

      // Supabase에 저장
      if (supabase) {
        await supabase
          .from('search_trends')
          .upsert(trendData, {
            onConflict: 'stock_code,DATE(collected_at)',
            ignoreDuplicates: false
          });
      }

      return trendData;

    } catch (error) {
      console.warn(`검색 트렌드 수집 실패 [${stockName}]:`, error.message);
      return null;
    }
  }

  /**
   * 여러 종목 배치 수집
   * @param {Array} stocks - [{stockCode, stockName}, ...]
   * @returns {Promise<Array>} 수집된 트렌드 데이터
   */
  async collectBatch(stocks) {
    console.log(`\n📊 Google Trends 수집 시작 (${stocks.length}개 종목)\n`);

    const results = [];
    let successCount = 0;
    let surgeCount = 0;

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];

      try {
        const trendData = await this.collectStockTrend(
          stock.stockCode,
          stock.stockName
        );

        if (trendData) {
          results.push(trendData);
          successCount++;

          if (trendData.surge_detected) {
            surgeCount++;
            console.log(`  🔥 [${stock.stockName}] 검색량 급증! ${trendData.change_rate.toFixed(0)}% ↑`);
          } else if (Math.abs(trendData.change_rate) > 50) {
            console.log(`  📈 [${stock.stockName}] ${trendData.change_rate >= 0 ? '+' : ''}${trendData.change_rate.toFixed(0)}%`);
          }
        }

        // Rate Limit 방지 (2초 대기)
        if (i < stocks.length - 1) {
          await this.delay(this.delayMs);
        }

      } catch (error) {
        console.error(`  ❌ [${stock.stockName}] 실패:`, error.message);
      }
    }

    console.log(`\n✅ Google Trends 수집 완료: ${successCount}/${stocks.length}개`);
    console.log(`   🔥 검색량 급증: ${surgeCount}개\n`);

    return results;
  }

  /**
   * 상위 종목 자동 수집 (KIS API 연동)
   * @param {number} limit - 수집할 종목 수 (기본 50개)
   * @returns {Promise<Array>} 트렌드 데이터
   */
  async collectTopStocks(limit = 50) {
    try {
      // KIS API에서 상위 종목 가져오기
      const kisApi = require('./kisApi');

      // 거래대금 상위 종목
      const kospiStocks = await kisApi.getTopStocksByTradeValue('KOSPI', Math.ceil(limit / 2));
      const kosdaqStocks = await kisApi.getTopStocksByTradeValue('KOSDAQ', Math.floor(limit / 2));

      const allStocks = [...kospiStocks, ...kosdaqStocks]
        .slice(0, limit)
        .map(stock => ({
          stockCode: stock.stck_shrn_iscd || stock.code,
          stockName: stock.hts_kor_isnm || stock.name
        }));

      console.log(`📋 수집 대상: ${allStocks.length}개 종목 (거래대금 상위)`);

      return await this.collectBatch(allStocks);

    } catch (error) {
      console.error('상위 종목 수집 실패:', error);
      return [];
    }
  }

  /**
   * 지연 함수
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 오늘 수집된 급등 종목 조회
   * @returns {Promise<Array>} 급증 종목 목록
   */
  async getTodaySurgeStocks() {
    if (!supabase) {
      console.warn('Supabase 미설정');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('search_surge_stocks')
        .select('*')
        .order('surge_score', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('급증 종목 조회 실패:', error);
      return [];
    }
  }

  /**
   * 특정 종목 최근 트렌드 조회
   * @param {string} stockCode - 종목 코드
   * @param {number} days - 조회 기간 (기본 7일)
   * @returns {Promise<Array>} 트렌드 히스토리
   */
  async getStockTrendHistory(stockCode, days = 7) {
    if (!supabase) return [];

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('search_trends')
        .select('*')
        .eq('stock_code', stockCode)
        .gte('collected_at', startDate.toISOString())
        .order('collected_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('트렌드 히스토리 조회 실패:', error);
      return [];
    }
  }
}

module.exports = new TrendCollector();
