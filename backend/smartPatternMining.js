const kisApi = require('./kisApi');
const advancedIndicators = require('./advancedIndicators');
const volumeIndicators = require('./volumeIndicators');

/**
 * 스마트 패턴 마이닝 시스템
 * 3단계 필터링으로 효율적인 급등 패턴 학습
 *
 * Phase 1 필터: 거래량 증가율 상위 50개 (API 순위 활용)
 * Phase 2 필터: 10거래일 대비 종가 15% 이상 상승
 * Phase 3 필터: 고가 대비 10% 이상 되돌림 제외
 */
class SmartPatternMiner {
  constructor() {
    this.minReturnThreshold = 15; // 최소 급등 기준: 15%
    this.pullbackThreshold = 10; // 되돌림 필터: 고가 대비 10%
    this.lookbackDays = 10; // 비교 기간: 10거래일
  }

  /**
   * Phase 1: 거래량 증가율 상위 50개 종목 선별
   * KIS API의 거래량 증가율 순위 활용 (양쪽 시장 각 50개)
   */
  async getHighVolumeSurgeStocks() {
    console.log('\n🔍 Phase 1: 거래량 증가율 상위 종목 선별...');
    console.log('  - KOSPI 상위 50개');
    console.log('  - KOSDAQ 상위 50개\n');

    const candidates = new Map(); // code -> name

    try {
      // KOSPI 상위 50개 (API 제한 30개씩 × 2번 불가능 → 30개만)
      const kospiSurge = await kisApi.getVolumeSurgeRank('KOSPI', 30);
      console.log(`  ✅ KOSPI 거래량 증가율 상위: ${kospiSurge.length}개`);

      kospiSurge.forEach(item => {
        candidates.set(item.code, item.name);
      });

      // KOSDAQ 상위 50개 (API 제한 30개씩 × 2번 불가능 → 30개만)
      const kosdaqSurge = await kisApi.getVolumeSurgeRank('KOSDAQ', 30);
      console.log(`  ✅ KOSDAQ 거래량 증가율 상위: ${kosdaqSurge.length}개`);

      kosdaqSurge.forEach(item => {
        candidates.set(item.code, item.name);
      });

      const codes = Array.from(candidates.keys());
      console.log(`\n✅ Phase 1 완료: ${codes.length}개 종목 선별\n`);

      return { codes, nameMap: candidates };

    } catch (error) {
      console.error('❌ Phase 1 실패:', error.message);
      throw error;
    }
  }

  /**
   * Phase 2 + Phase 3: 10거래일 수익률 15% 이상 + 되돌림 필터링
   * @param {Array} stockCodes - Phase 1에서 선별된 종목 코드
   */
  async filterBySurgeAndPullback(stockCodes) {
    console.log('🔍 Phase 2 + 3: 급등 조건 + 되돌림 필터링...');
    console.log(`  - 대상: ${stockCodes.length}개 종목`);
    console.log(`  - 조건: 10거래일 대비 +15% 이상 상승`);
    console.log(`  - 필터: 고가 대비 -10% 이상 하락 제외\n`);

    const qualified = [];
    let analyzed = 0;
    let phase2Pass = 0;
    let phase3Filtered = 0;

    for (const stockCode of stockCodes) {
      try {
        analyzed++;

        // 충분한 기간 데이터 가져오기
        const chartData = await kisApi.getDailyChart(stockCode, this.lookbackDays + 5);

        if (!chartData || chartData.length < this.lookbackDays + 1) {
          continue; // 데이터 부족
        }

        // 가장 최근 데이터 (today)
        const today = chartData[chartData.length - 1];

        // 10거래일 전 데이터
        const tenDaysAgo = chartData[chartData.length - 1 - this.lookbackDays];

        if (!today || !tenDaysAgo || tenDaysAgo.close === 0) {
          continue;
        }

        // Phase 2: 10거래일 대비 수익률 계산
        const returnRate = ((today.close - tenDaysAgo.close) / tenDaysAgo.close) * 100;

        if (returnRate < this.minReturnThreshold) {
          continue; // 15% 미만 → 탈락
        }

        phase2Pass++;

        // Phase 3: 되돌림 필터링 (고가 대비 현재가 낙폭)
        const recentHigh = Math.max(...chartData.slice(-this.lookbackDays).map(d => d.high));
        const pullbackRate = ((recentHigh - today.close) / recentHigh) * 100;

        if (pullbackRate >= this.pullbackThreshold) {
          phase3Filtered++;
          continue; // 10% 이상 되돌림 → 제외
        }

        // 모든 필터 통과 → 지표 분석
        const volumeAnalysis = volumeIndicators.analyzeVolume(chartData);
        const advancedAnalysis = advancedIndicators.analyzeAdvanced(chartData);

        // 거래량 비율 계산
        const volumeRatio = volumeAnalysis.current.volumeMA20
          ? today.volume / volumeAnalysis.current.volumeMA20
          : 1;

        qualified.push({
          stockCode,
          stockName: today.stockName || stockCode,
          surgeDate: today.date,
          returnRate: returnRate.toFixed(2),
          pullbackRate: pullbackRate.toFixed(2),
          recentHigh,
          currentPrice: today.close,
          // D-0일 지표들 (현재)
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
            closingStrength: this.calculateClosingStrength(today)
          }
        });

        console.log(`  ✅ [${qualified.length}] ${stockCode}: ${returnRate.toFixed(1)}% (되돌림 ${pullbackRate.toFixed(1)}%)`);

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 10 === 0) {
          console.log(`  📊 진행: ${analyzed}/${stockCodes.length}, 통과: ${qualified.length}개`);
        }

      } catch (error) {
        console.error(`  ❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    console.log(`\n✅ Phase 2+3 완료!`);
    console.log(`  - 분석: ${analyzed}개`);
    console.log(`  - Phase 2 통과 (15% 이상 상승): ${phase2Pass}개`);
    console.log(`  - Phase 3 제외 (10% 되돌림): ${phase3Filtered}개`);
    console.log(`  - 최종 선별: ${qualified.length}개\n`);

    return qualified;
  }

  /**
   * Step 2: 패턴 추출 및 빈도 계산
   */
  extractPatterns(qualifiedStocks) {
    console.log(`🔍 패턴 추출 시작... (총 ${qualifiedStocks.length}개 급등 종목)\n`);

    const patternFrequency = {};

    for (const stock of qualifiedStocks) {
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
          patternFrequency[pattern.key].totalReturn += parseFloat(stock.returnRate);
        }
      }
    }

    // 빈도순 정렬 및 통계 계산
    const rankedPatterns = Object.entries(patternFrequency)
      .map(([key, data]) => ({
        key,
        name: data.name,
        count: data.count,
        frequency: (data.count / qualifiedStocks.length * 100).toFixed(1),
        avgReturn: (data.totalReturn / data.count).toFixed(2),
        sampleStocks: data.stocks.slice(0, 5) // 샘플 5개만
      }))
      .sort((a, b) => b.count - a.count);

    console.log(`✅ 패턴 추출 완료!\n`);
    console.log(`📊 발견된 패턴 (빈도순):\n`);

    rankedPatterns.forEach((pattern, i) => {
      console.log(`${i + 1}. ${pattern.name}`);
      console.log(`   출현: ${pattern.count}회 (${pattern.frequency}%)`);
      console.log(`   평균 10일 수익률: +${pattern.avgReturn}%`);
      console.log(`   샘플: ${pattern.sampleStocks.join(', ')}\n`);
    });

    return rankedPatterns;
  }

  /**
   * Step 3: 패턴 백테스팅
   * 각 패턴의 승률과 평균 수익률 계산
   */
  backtestPatterns(patterns, qualifiedStocks) {
    console.log(`\n📊 패턴 백테스팅 시작...\n`);

    const backtestResults = patterns.map(pattern => {
      const matchedStocks = qualifiedStocks.filter(stock => {
        return this.matchesPattern(stock, pattern.key);
      });

      const returns = matchedStocks.map(s => parseFloat(s.returnRate));
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
   * 전체 스마트 패턴 마이닝 파이프라인 실행
   */
  async analyzeSmartPatterns() {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧠 스마트 패턴 마이닝 시작`);
      console.log(`${'='.repeat(60)}`);
      console.log(`\n전략:`);
      console.log(`  Phase 1: 거래량 증가율 상위 60개 (KOSPI 30 + KOSDAQ 30)`);
      console.log(`  Phase 2: 10거래일 대비 +15% 이상 상승`);
      console.log(`  Phase 3: 고가 대비 -10% 이상 되돌림 제외`);
      console.log(`${'='.repeat(60)}\n`);

      // Phase 1: 거래량 증가율 상위 종목 선별
      const { codes: candidateCodes } = await this.getHighVolumeSurgeStocks();

      if (candidateCodes.length === 0) {
        console.log('⚠️ Phase 1에서 종목을 찾지 못했습니다.');
        return null;
      }

      // Phase 2+3: 급등 조건 + 되돌림 필터링
      const qualifiedStocks = await this.filterBySurgeAndPullback(candidateCodes);

      if (qualifiedStocks.length < 3) {
        console.log(`⚠️ 필터링 후 종목이 너무 적습니다 (${qualifiedStocks.length}개). 조건을 완화하세요.`);
        return null;
      }

      // Step 2: 패턴 추출
      const patterns = this.extractPatterns(qualifiedStocks);

      if (patterns.length === 0) {
        console.log('⚠️ 발견된 패턴이 없습니다.');
        return null;
      }

      // Step 3: 패턴 백테스팅
      const backtested = this.backtestPatterns(patterns, qualifiedStocks);

      // Step 4: 승률 기준으로 재정렬 및 상위 선정
      const topPatterns = backtested
        .filter(p => p.backtest.totalSamples >= 2) // 최소 2개 샘플 필요
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
          phase1Candidates: candidateCodes.length,
          phase2MinReturn: this.minReturnThreshold,
          phase3PullbackThreshold: this.pullbackThreshold,
          lookbackDays: this.lookbackDays,
          totalQualified: qualifiedStocks.length
        },
        patterns: topPatterns,
        rawData: qualifiedStocks // 백테스팅용
      };

    } catch (error) {
      console.error('❌ 스마트 패턴 분석 실패:', error);
      throw error;
    }
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

module.exports = new SmartPatternMiner();
