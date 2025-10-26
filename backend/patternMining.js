const kisApi = require('./kisApi');
const advancedIndicators = require('./advancedIndicators');
const volumeIndicators = require('./volumeIndicators');

/**
 * 급등 종목 패턴 마이닝 시스템
 * 최근 N일간 급등한 종목들의 공통 패턴을 찾아냅니다
 */
class PatternMiner {
  constructor() {
    this.minReturnThreshold = 15; // 최소 급등 기준: 15%
    this.lookbackDays = 30; // 분석 기간: 30일
  }

  /**
   * Step 1: 급등 종목 수집
   * 최근 N일간 1일 수익률 15% 이상인 종목의 급등 전날(D-1) 데이터 수집
   */
  async collectSurgeStocks(lookbackDays = this.lookbackDays, minReturn = this.minReturnThreshold) {
    console.log(`\n🔍 급등 종목 패턴 마이닝 시작...`);
    console.log(`  - 분석 기간: 최근 ${lookbackDays}일`);
    console.log(`  - 급등 기준: 1일 수익률 ${minReturn}% 이상\n`);

    const surgeStocks = [];
    const { codes: allStocks } = await kisApi.getAllStockList('ALL');

    // 샘플링: 전체의 20% 랜덤 샘플 (성능 최적화)
    const sampleSize = Math.min(200, Math.floor(allStocks.length * 0.2));
    const sampledStocks = this.shuffleArray([...allStocks]).slice(0, sampleSize);

    console.log(`📊 샘플링: ${sampledStocks.length}개 종목 분석 (전체 ${allStocks.length}개 중)\n`);

    let analyzed = 0;
    let surgeFound = 0;

    for (const stockCode of sampledStocks) {
      try {
        analyzed++;

        // 충분한 기간 데이터 가져오기 (급등일 + 지표 계산용)
        const chartData = await kisApi.getDailyChart(stockCode, lookbackDays + 30);

        if (!chartData || chartData.length < lookbackDays + 10) {
          continue; // 데이터 부족
        }

        // 최근 N일 내 급등일 찾기
        for (let i = 10; i < lookbackDays; i++) {
          const today = chartData[i];
          const yesterday = chartData[i + 1];

          if (!today || !yesterday || yesterday.close === 0) continue;

          // 1일 수익률 계산
          const dailyReturn = ((today.close - yesterday.close) / yesterday.close) * 100;

          if (dailyReturn >= minReturn) {
            // 급등 발견! D-1일 데이터로 지표 분석
            const dayBeforeData = chartData.slice(i + 1, i + 31); // D-1일 기준 30일 데이터

            if (dayBeforeData.length < 30) continue;

            // 지표 분석
            const volumeAnalysis = volumeIndicators.analyzeVolume(dayBeforeData);
            const advancedAnalysis = advancedIndicators.analyzeAdvanced(dayBeforeData);

            // 거래량 비율 계산
            const volumeRatio = volumeAnalysis.current.volumeMA20
              ? yesterday.volume / volumeAnalysis.current.volumeMA20
              : 1;

            surgeStocks.push({
              stockCode,
              stockName: today.stockName || stockCode,
              surgeDate: today.date,
              dailyReturn: dailyReturn.toFixed(2),
              // D-1일 지표들
              indicators: {
                whale: advancedAnalysis.indicators.whale.length,
                whaleIntensity: advancedAnalysis.indicators.whale.length > 0
                  ? advancedAnalysis.indicators.whale[advancedAnalysis.indicators.whale.length - 1].intensity
                  : 0,
                accumulation: advancedAnalysis.indicators.accumulation.detected,
                escape: advancedAnalysis.indicators.escape.detected,
                drain: advancedAnalysis.indicators.drain.detected,
                asymmetric: advancedAnalysis.indicators.asymmetric.ratio,
                volumeRatio: volumeRatio.toFixed(2),
                mfi: volumeAnalysis.indicators.mfi,
                closingStrength: this.calculateClosingStrength(yesterday)
              }
            });

            surgeFound++;
            console.log(`  ✅ [${surgeFound}] ${stockCode}: ${today.date} 급등 ${dailyReturn.toFixed(1)}%`);

            break; // 종목당 1개 급등일만 수집
          }
        }

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 20 === 0) {
          console.log(`  📊 진행: ${analyzed}/${sampledStocks.length}, 급등 발견: ${surgeFound}개`);
        }

      } catch (error) {
        console.error(`  ❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    console.log(`\n✅ 급등 종목 수집 완료!`);
    console.log(`  - 분석: ${analyzed}개`);
    console.log(`  - 급등 발견: ${surgeFound}개\n`);

    return surgeStocks;
  }

  /**
   * Step 2: 패턴 추출 및 빈도 계산
   */
  extractPatterns(surgeStocks) {
    console.log(`🔍 패턴 추출 시작... (총 ${surgeStocks.length}개 급등 종목)\n`);

    const patternFrequency = {};

    for (const stock of surgeStocks) {
      const ind = stock.indicators;

      // 패턴 정의 (여러 조합)
      const patterns = [
        // 패턴 1: 고래 + 조용한 매집
        {
          name: '고래 + 조용한 매집',
          match: ind.whale > 0 && ind.accumulation,
          key: 'whale_accumulation'
        },
        // 패턴 2: 유동성 고갈 + 탈출 속도
        {
          name: '유동성 고갈 + 탈출 속도',
          match: ind.drain && ind.escape,
          key: 'drain_escape'
        },
        // 패턴 3: 고래 + 고거래량
        {
          name: '고래 + 대량 거래',
          match: ind.whale > 0 && parseFloat(ind.volumeRatio) >= 2.5,
          key: 'whale_highvolume'
        },
        // 패턴 4: 비대칭 매집 + 조용한 매집
        {
          name: '비대칭 매집 + 조용한 매집',
          match: ind.asymmetric >= 1.5 && ind.accumulation,
          key: 'asymmetric_accumulation'
        },
        // 패턴 5: 탈출 속도 + 강한 마감
        {
          name: '탈출 속도 + 강한 마감',
          match: ind.escape && ind.closingStrength >= 70,
          key: 'escape_strongclose'
        },
        // 패턴 6: MFI 과매도 + 고래
        {
          name: 'MFI 과매도 + 고래',
          match: ind.mfi <= 30 && ind.whale > 0,
          key: 'mfi_oversold_whale'
        },
        // 패턴 7: 유동성 고갈 + 비대칭 매집
        {
          name: '유동성 고갈 + 비대칭 매집',
          match: ind.drain && ind.asymmetric >= 1.5,
          key: 'drain_asymmetric'
        },
        // 패턴 8: 조용한 매집 + 중간 거래량
        {
          name: '조용한 매집 + 적정 거래량',
          match: ind.accumulation && parseFloat(ind.volumeRatio) >= 1.5 && parseFloat(ind.volumeRatio) < 3,
          key: 'accumulation_moderate'
        }
      ];

      // 각 패턴 매칭 및 카운트
      for (const pattern of patterns) {
        if (pattern.match) {
          if (!patternFrequency[pattern.key]) {
            patternFrequency[pattern.key] = {
              name: pattern.name,
              count: 0,
              stocks: [],
              totalReturn: 0
            };
          }
          patternFrequency[pattern.key].count++;
          patternFrequency[pattern.key].stocks.push(stock.stockCode);
          patternFrequency[pattern.key].totalReturn += parseFloat(stock.dailyReturn);
        }
      }
    }

    // 빈도순 정렬 및 통계 계산
    const rankedPatterns = Object.entries(patternFrequency)
      .map(([key, data]) => ({
        key,
        name: data.name,
        count: data.count,
        frequency: (data.count / surgeStocks.length * 100).toFixed(1),
        avgReturn: (data.totalReturn / data.count).toFixed(2),
        sampleStocks: data.stocks.slice(0, 5) // 샘플 5개만
      }))
      .sort((a, b) => b.count - a.count);

    console.log(`✅ 패턴 추출 완료!\n`);
    console.log(`📊 발견된 패턴 (빈도순):\n`);

    rankedPatterns.forEach((pattern, i) => {
      console.log(`${i + 1}. ${pattern.name}`);
      console.log(`   출현: ${pattern.count}회 (${pattern.frequency}%)`);
      console.log(`   평균 익일 수익률: +${pattern.avgReturn}%`);
      console.log(`   샘플: ${pattern.sampleStocks.join(', ')}\n`);
    });

    return rankedPatterns;
  }

  /**
   * Step 3: 상위 패턴 선정
   */
  rankPatterns(patterns, topN = 5) {
    const topPatterns = patterns.slice(0, topN);

    console.log(`\n🏆 상위 ${topN}개 패턴 선정 완료:\n`);
    topPatterns.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name} (출현율 ${p.frequency}%, 평균 수익률 +${p.avgReturn}%)`);
    });

    return topPatterns;
  }

  /**
   * 유틸리티: 종가 강도 계산
   */
  calculateClosingStrength(candle) {
    const range = candle.high - candle.low;
    if (range === 0) return 50;
    return ((candle.close - candle.low) / range) * 100;
  }

  /**
   * 유틸리티: 배열 셔플
   */
  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Step 4: 패턴 백테스팅
   * 각 패턴의 승률과 평균 수익률 계산
   */
  backtestPatterns(patterns, surgeStocks) {
    console.log(`\n📊 패턴 백테스팅 시작...\n`);

    const backtestResults = patterns.map(pattern => {
      const matchedStocks = surgeStocks.filter(stock => {
        return this.matchesPattern(stock, pattern.key);
      });

      const returns = matchedStocks.map(s => parseFloat(s.dailyReturn));
      const wins = returns.filter(r => r > 0).length;
      const winRate = matchedStocks.length > 0 ? (wins / matchedStocks.length * 100).toFixed(1) : 0;
      const avgReturn = matchedStocks.length > 0
        ? (returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2)
        : 0;
      const maxReturn = matchedStocks.length > 0 ? Math.max(...returns).toFixed(2) : 0;
      const minReturn = matchedStocks.length > 0 ? Math.min(...returns).toFixed(2) : 0;

      console.log(`✅ ${pattern.name}`);
      console.log(`   승률: ${winRate}% (${wins}/${matchedStocks.length})`);
      console.log(`   평균: +${avgReturn}%, 최고: +${maxReturn}%, 최저: ${minReturn}%\n`);

      return {
        ...pattern,
        backtest: {
          winRate: parseFloat(winRate),
          avgReturn: parseFloat(avgReturn),
          maxReturn: parseFloat(maxReturn),
          minReturn: parseFloat(minReturn),
          totalSamples: matchedStocks.length,
          wins
        }
      };
    });

    console.log(`✅ 백테스팅 완료!\n`);
    return backtestResults;
  }

  /**
   * 패턴 매칭 헬퍼
   */
  matchesPattern(stock, patternKey) {
    const ind = stock.indicators;

    const patternMatchers = {
      'whale_accumulation': ind.whale > 0 && ind.accumulation,
      'drain_escape': ind.drain && ind.escape,
      'whale_highvolume': ind.whale > 0 && parseFloat(ind.volumeRatio) >= 2.5,
      'asymmetric_accumulation': ind.asymmetric >= 1.5 && ind.accumulation,
      'escape_strongclose': ind.escape && ind.closingStrength >= 70,
      'mfi_oversold_whale': ind.mfi <= 30 && ind.whale > 0,
      'drain_asymmetric': ind.drain && ind.asymmetric >= 1.5,
      'accumulation_moderate': ind.accumulation && parseFloat(ind.volumeRatio) >= 1.5 && parseFloat(ind.volumeRatio) < 3
    };

    return patternMatchers[patternKey] || false;
  }

  /**
   * 전체 분석 파이프라인 실행
   */
  async analyzeSurgePatterns(lookbackDays = 30, minReturn = 15) {
    try {
      // Step 1: 급등 종목 수집
      const surgeStocks = await this.collectSurgeStocks(lookbackDays, minReturn);

      if (surgeStocks.length < 5) {
        console.log(`⚠️ 급등 종목이 너무 적습니다 (${surgeStocks.length}개). 기준을 낮추거나 기간을 늘려보세요.`);
        return null;
      }

      // Step 2: 패턴 추출
      const patterns = this.extractPatterns(surgeStocks);

      // Step 3: 패턴 백테스팅
      const backtested = this.backtestPatterns(patterns, surgeStocks);

      // Step 4: 승률 기준으로 재정렬 및 상위 선정
      const topPatterns = backtested
        .filter(p => p.backtest.totalSamples >= 3) // 최소 3개 샘플 필요
        .sort((a, b) => b.backtest.winRate - a.backtest.winRate) // 승률 순
        .slice(0, 5);

      console.log(`\n🏆 최종 상위 5개 패턴 (승률 기준):\n`);
      topPatterns.forEach((p, i) => {
        console.log(`${i + 1}. ${p.name}`);
        console.log(`   승률: ${p.backtest.winRate}%, 평균 수익률: +${p.backtest.avgReturn}%`);
        console.log(`   샘플: ${p.backtest.totalSamples}개, 출현율: ${p.frequency}%\n`);
      });

      return {
        generatedAt: new Date().toISOString(),
        parameters: {
          lookbackDays,
          minReturn,
          totalSurgeStocks: surgeStocks.length
        },
        patterns: topPatterns,
        rawData: surgeStocks // 백테스팅용
      };

    } catch (error) {
      console.error('❌ 패턴 분석 실패:', error);
      throw error;
    }
  }

  /**
   * 현재 종목이 저장된 패턴과 매칭되는지 확인
   * @param {Object} stock - 종목 분석 결과 (screening.js의 analyzeStock 반환값)
   * @param {Array} patterns - 저장된 패턴 목록
   * @returns {Object} 매칭 결과 및 보너스 점수
   */
  checkPatternMatch(stock, patterns) {
    if (!patterns || patterns.length === 0) {
      return { matched: false, patterns: [], bonusScore: 0 };
    }

    const matchedPatterns = [];
    let bonusScore = 0;

    // 현재 종목의 지표를 패턴 형식으로 변환
    const stockIndicators = {
      whale: stock.advancedAnalysis.indicators.whale.length,
      accumulation: stock.advancedAnalysis.indicators.accumulation.detected,
      escape: stock.advancedAnalysis.indicators.escape.detected,
      drain: stock.advancedAnalysis.indicators.drain.detected,
      asymmetric: stock.advancedAnalysis.indicators.asymmetric.ratio,
      volumeRatio: stock.volumeAnalysis.current.volumeMA20
        ? stock.volume / stock.volumeAnalysis.current.volumeMA20
        : 1,
      mfi: stock.volumeAnalysis.indicators.mfi,
      closingStrength: stock.advancedAnalysis.indicators.escape.closingStrength
        ? parseFloat(stock.advancedAnalysis.indicators.escape.closingStrength)
        : 50
    };

    // 각 패턴과 매칭 확인
    for (const pattern of patterns) {
      const mockStock = { indicators: stockIndicators };
      if (this.matchesPattern(mockStock, pattern.key)) {
        matchedPatterns.push({
          name: pattern.name,
          winRate: pattern.backtest?.winRate || 0,
          avgReturn: pattern.backtest?.avgReturn || 0,
          frequency: pattern.frequency
        });

        // 패턴 승률에 비례한 보너스 점수 (최대 15점)
        const patternBonus = (pattern.backtest?.winRate || 0) / 100 * 15;
        bonusScore += patternBonus;
      }
    }

    return {
      matched: matchedPatterns.length > 0,
      patterns: matchedPatterns,
      bonusScore: Math.min(bonusScore, 20) // 최대 20점
    };
  }

  /**
   * 저장된 패턴 로드
   */
  loadSavedPatterns() {
    try {
      const fs = require('fs');
      const path = './data/patterns.json';

      if (fs.existsSync(path)) {
        const data = fs.readFileSync(path, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.patterns || [];
      }
    } catch (error) {
      console.log('⚠️ 저장된 패턴 로드 실패:', error.message);
    }
    return [];
  }
}

module.exports = new PatternMiner();
