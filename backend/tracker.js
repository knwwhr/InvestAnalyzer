const fs = require('fs').promises;
const path = require('path');
const kisApi = require('./kisApi');
const screener = require('./screening');

/**
 * Phase 2: 실시간 추적 시스템
 * 매일 추천 종목을 저장하고 수익률을 자동 업데이트
 */
class RecommendationTracker {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.recommendationsFile = path.join(this.dataDir, 'recommendations.json');
    this.dailyPricesFile = path.join(this.dataDir, 'daily_prices.json');
  }

  /**
   * 데이터 디렉토리 초기화
   */
  async ensureDataDir() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      // 디렉토리 이미 존재
    }
  }

  /**
   * 오늘의 추천 종목 저장
   */
  async saveRecommendations(category = 'top10') {
    await this.ensureDataDir();

    console.log(`💾 ${category} 추천 종목 저장 중...`);

    const today = new Date().toISOString().split('T')[0];

    // 스크리닝 실행
    let recommendations;
    if (category === 'top10') {
      recommendations = await screener.screenAllStocks('ALL', 10);
    } else {
      recommendations = await screener.screenByCategory(category, 'ALL', 10);
    }

    // 기존 데이터 로드
    let allRecommendations = [];
    try {
      const data = await fs.readFile(this.recommendationsFile, 'utf8');
      allRecommendations = JSON.parse(data);
    } catch (error) {
      // 파일 없음 - 새로 시작
    }

    // 오늘 추천 추가
    const newRecords = recommendations.map(stock => ({
      id: `${today}_${category}_${stock.stockCode}`,
      date: today,
      category,
      stockCode: stock.stockCode,
      stockName: stock.stockName,
      buyPrice: stock.currentPrice,
      score: stock.totalScore,
      grade: stock.recommendation.grade,
      volumeAnalysis: stock.volumeAnalysis,
      advancedAnalysis: stock.advancedAnalysis,
      status: 'active', // active, closed
      createdAt: new Date().toISOString()
    }));

    allRecommendations.push(...newRecords);

    // 저장
    await fs.writeFile(
      this.recommendationsFile,
      JSON.stringify(allRecommendations, null, 2),
      'utf8'
    );

    console.log(`✅ ${newRecords.length}개 추천 저장 완료`);

    return newRecords;
  }

  /**
   * 모든 활성 추천의 현재가 업데이트
   */
  async updateAllPrices() {
    await this.ensureDataDir();

    console.log('🔄 가격 업데이트 중...');

    // 추천 목록 로드
    let recommendations = [];
    try {
      const data = await fs.readFile(this.recommendationsFile, 'utf8');
      recommendations = JSON.parse(data);
    } catch (error) {
      console.log('⚠️ 추천 데이터 없음');
      return [];
    }

    // 활성 추천만 필터링 (7일 이내)
    const today = new Date();
    const activeRecommendations = recommendations.filter(rec => {
      const recDate = new Date(rec.date);
      const daysDiff = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));
      return rec.status === 'active' && daysDiff <= 7;
    });

    console.log(`📊 활성 추천 ${activeRecommendations.length}개 가격 업데이트 중...`);

    // 일일 가격 데이터 로드
    let dailyPrices = [];
    try {
      const data = await fs.readFile(this.dailyPricesFile, 'utf8');
      dailyPrices = JSON.parse(data);
    } catch (error) {
      // 파일 없음 - 새로 시작
    }

    const todayStr = today.toISOString().split('T')[0];
    const updates = [];

    // 각 종목의 현재가 가져오기
    for (const rec of activeRecommendations) {
      try {
        const currentData = await kisApi.getCurrentPrice(rec.stockCode);

        const priceRecord = {
          id: `${todayStr}_${rec.stockCode}`,
          date: todayStr,
          stockCode: rec.stockCode,
          stockName: rec.stockName,
          price: currentData.currentPrice,
          volume: currentData.volume,
          changeRate: currentData.changeRate,
          createdAt: new Date().toISOString()
        };

        dailyPrices.push(priceRecord);
        updates.push(priceRecord);

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ 가격 업데이트 실패 [${rec.stockCode}]:`, error.message);
      }
    }

    // 저장
    await fs.writeFile(
      this.dailyPricesFile,
      JSON.stringify(dailyPrices, null, 2),
      'utf8'
    );

    console.log(`✅ ${updates.length}개 종목 가격 업데이트 완료`);

    return updates;
  }

  /**
   * 추천 성과 계산
   */
  async calculatePerformance() {
    await this.ensureDataDir();

    console.log('📈 성과 계산 중...');

    // 데이터 로드
    let recommendations = [];
    let dailyPrices = [];

    try {
      const recData = await fs.readFile(this.recommendationsFile, 'utf8');
      recommendations = JSON.parse(recData);

      const priceData = await fs.readFile(this.dailyPricesFile, 'utf8');
      dailyPrices = JSON.parse(priceData);
    } catch (error) {
      console.log('⚠️ 데이터 없음');
      return null;
    }

    // 각 추천의 현재 수익률 계산
    const results = [];

    for (const rec of recommendations) {
      // 해당 종목의 최신 가격 찾기
      const latestPrice = dailyPrices
        .filter(p => p.stockCode === rec.stockCode)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      if (!latestPrice) continue;

      const returnRate = ((latestPrice.price - rec.buyPrice) / rec.buyPrice) * 100;
      const daysHeld = Math.floor(
        (new Date(latestPrice.date) - new Date(rec.date)) / (1000 * 60 * 60 * 24)
      );

      results.push({
        ...rec,
        currentPrice: latestPrice.price,
        returnRate: parseFloat(returnRate.toFixed(2)),
        daysHeld,
        isWin: returnRate > 0,
        lastUpdated: latestPrice.date
      });
    }

    // 통계 계산
    const statistics = this.calculateStatistics(results);

    return {
      results,
      statistics,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 통계 계산 (백테스팅과 동일)
   */
  calculateStatistics(results) {
    if (results.length === 0) return null;

    const totalCount = results.length;
    const winCount = results.filter(r => r.isWin).length;
    const winRate = (winCount / totalCount) * 100;
    const avgReturn = results.reduce((sum, r) => sum + r.returnRate, 0) / totalCount;
    const maxReturn = Math.max(...results.map(r => r.returnRate));
    const minReturn = Math.min(...results.map(r => r.returnRate));

    // 카테고리별
    const byCategory = this.groupBy(results, 'category');
    const categoryStats = {};

    for (const [category, items] of Object.entries(byCategory)) {
      categoryStats[category] = this.calculateGroupStats(items);
    }

    // 등급별
    const byGrade = this.groupBy(results, 'grade');
    const gradeStats = {};

    for (const [grade, items] of Object.entries(byGrade)) {
      gradeStats[grade] = this.calculateGroupStats(items);
    }

    return {
      overall: {
        totalCount,
        winCount,
        lossCount: totalCount - winCount,
        winRate: parseFloat(winRate.toFixed(2)),
        avgReturn: parseFloat(avgReturn.toFixed(2)),
        maxReturn: parseFloat(maxReturn.toFixed(2)),
        minReturn: parseFloat(minReturn.toFixed(2))
      },
      byCategory: categoryStats,
      byGrade: gradeStats
    };
  }

  calculateGroupStats(items) {
    const count = items.length;
    const winCount = items.filter(r => r.isWin).length;
    const winRate = (winCount / count) * 100;
    const avgReturn = items.reduce((sum, r) => sum + r.returnRate, 0) / count;
    const maxReturn = Math.max(...items.map(r => r.returnRate));

    return {
      count,
      winCount,
      winRate: parseFloat(winRate.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2)),
      maxReturn: parseFloat(maxReturn.toFixed(2))
    };
  }

  groupBy(array, key) {
    return array.reduce((result, item) => {
      const groupKey = item[key];
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {});
  }

  /**
   * 오래된 추천 종목 아카이빙 (30일 이상 된 것)
   */
  async archiveOldRecommendations() {
    await this.ensureDataDir();

    console.log('🗄️ 오래된 추천 아카이빙 중...');

    let recommendations = [];
    try {
      const data = await fs.readFile(this.recommendationsFile, 'utf8');
      recommendations = JSON.parse(data);
    } catch (error) {
      return;
    }

    const today = new Date();
    const activeRecommendations = [];
    const archivedRecommendations = [];

    recommendations.forEach(rec => {
      const recDate = new Date(rec.date);
      const daysDiff = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));

      if (daysDiff > 30) {
        archivedRecommendations.push({ ...rec, status: 'archived' });
      } else {
        activeRecommendations.push(rec);
      }
    });

    // 활성 추천만 저장
    await fs.writeFile(
      this.recommendationsFile,
      JSON.stringify(activeRecommendations, null, 2),
      'utf8'
    );

    // 아카이브 저장
    if (archivedRecommendations.length > 0) {
      const archiveFile = path.join(this.dataDir, 'archived_recommendations.json');
      let existingArchive = [];

      try {
        const data = await fs.readFile(archiveFile, 'utf8');
        existingArchive = JSON.parse(data);
      } catch (error) {
        // 파일 없음
      }

      existingArchive.push(...archivedRecommendations);

      await fs.writeFile(
        archiveFile,
        JSON.stringify(existingArchive, null, 2),
        'utf8'
      );

      console.log(`✅ ${archivedRecommendations.length}개 추천 아카이빙 완료`);
    }
  }

  /**
   * 전체 데이터 조회 (API용)
   */
  async getAllData() {
    const performance = await this.calculatePerformance();
    return performance;
  }
}

module.exports = new RecommendationTracker();
