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
    this.minReturnThreshold = 5; // 최소 급등 기준: 5% (완화)
    this.pullbackThreshold = 15; // 되돌림 필터: 고가 대비 15% (완화)
    this.lookbackDays = 10; // 비교 기간: 10거래일
  }

  /**
   * Phase 1: 거래량 증가율 상위 50개 종목 선별 (ETF/ETN 제외)
   * KIS API의 거래량 증가율 순위 활용 (양쪽 시장 각 50개)
   */
  async getHighVolumeSurgeStocks() {
    console.log('\n🔍 Phase 1: 거래량 증가율 상위 종목 선별 (ETF/ETN 제외)...');
    console.log('  - KOSPI 상위 30개');
    console.log('  - KOSDAQ 상위 30개\n');

    const candidates = new Map(); // code -> name
    let filteredCount = 0;

    try {
      // KOSPI 상위 30개 (API 제한)
      const kospiSurge = await kisApi.getVolumeSurgeRank('KOSPI', 30);
      const kospiFiltered = kospiSurge.filter(item => {
        if (kisApi.isNonStockItem(item.name)) {
          filteredCount++;
          return false;
        }
        return true;
      });
      console.log(`  ✅ KOSPI 거래량 증가율: ${kospiFiltered.length}개 (${kospiSurge.length - kospiFiltered.length}개 ETF/ETN 제외)`);

      kospiFiltered.forEach(item => {
        candidates.set(item.code, item.name);
      });

      // KOSDAQ 상위 30개 (API 제한)
      const kosdaqSurge = await kisApi.getVolumeSurgeRank('KOSDAQ', 30);
      const kosdaqFiltered = kosdaqSurge.filter(item => {
        if (kisApi.isNonStockItem(item.name)) {
          filteredCount++;
          return false;
        }
        return true;
      });
      console.log(`  ✅ KOSDAQ 거래량 증가율: ${kosdaqFiltered.length}개 (${kosdaqSurge.length - kosdaqFiltered.length}개 ETF/ETN 제외)`);

      kosdaqFiltered.forEach(item => {
        candidates.set(item.code, item.name);
      });

      const codes = Array.from(candidates.keys());
      console.log(`\n✅ Phase 1 완료: ${codes.length}개 종목 선별 (총 ${filteredCount}개 ETF/ETN 제외)\n`);

      return { codes, nameMap: candidates };

    } catch (error) {
      console.error('❌ Phase 1 실패:', error.message);
      throw error;
    }
  }

  /**
   * Phase 2 + Phase 3: 10거래일 수익률 15% 이상 + D-5 선행 지표 분석
   * @param {Array} stockCodes - Phase 1에서 선별된 종목 코드
   * @param {Map} nameMap - 종목 코드 -> 종목명 매핑
   */
  async filterBySurgeAndPullback(stockCodes, nameMap) {
    console.log('🔍 Phase 2 + 3: 급등 종목 찾기 + D-5 선행 지표 분석...');
    console.log(`  - 대상: ${stockCodes.length}개 종목`);
    console.log(`  - 조건: 10거래일 대비 +15% 이상 상승`);
    console.log(`  - 분석: 급등 5거래일 전(D-5) 지표 추출\n`);

    const qualified = [];
    let analyzed = 0;
    let phase2Pass = 0;
    let phase3Filtered = 0;

    for (const stockCode of stockCodes) {
      try {
        analyzed++;

        // 충분한 기간 데이터 가져오기 (최소 20일)
        const chartData = await kisApi.getDailyChart(stockCode, 30);

        if (!chartData || chartData.length < 20) {
          continue; // 데이터 부족
        }

        // 최근 10일 내에서 급등일 찾기
        let surgeIndex = -1;
        let maxReturn = 0;

        for (let i = 10; i < chartData.length; i++) {
          const tenDaysAgo = chartData[i - 10];
          const today = chartData[i];

          if (!tenDaysAgo || !today || tenDaysAgo.close === 0) continue;

          const returnRate = ((today.close - tenDaysAgo.close) / tenDaysAgo.close) * 100;

          if (returnRate > maxReturn && returnRate >= this.minReturnThreshold) {
            maxReturn = returnRate;
            surgeIndex = i;
          }
        }

        if (surgeIndex === -1) {
          continue; // 급등 없음
        }

        phase2Pass++;

        // Phase 3: 되돌림 필터링 (고가 대비 급등일 가격)
        const surgeDay = chartData[surgeIndex];
        const recentHigh = Math.max(...chartData.slice(surgeIndex - 10, surgeIndex + 1).map(d => d.high));
        const pullbackRate = ((recentHigh - surgeDay.close) / recentHigh) * 100;

        if (pullbackRate >= this.pullbackThreshold) {
          phase3Filtered++;
          continue; // 15% 이상 되돌림 → 제외
        }

        // ⭐ 핵심: D-5 거래일 전 데이터 (급등 직전 5일)
        const preSurgeStart = surgeIndex - 5;
        if (preSurgeStart < 0) continue; // 데이터 부족

        const preSurgeData = chartData.slice(preSurgeStart, surgeIndex);

        if (preSurgeData.length < 5) continue;

        // D-5 ~ D-1 거래일 지표 분석
        const volumeAnalysis = volumeIndicators.analyzeVolume(preSurgeData);
        const advancedAnalysis = advancedIndicators.analyzeAdvanced(preSurgeData);

        // 5일 평균 거래량 비율
        const avgVolumeRatio = preSurgeData.reduce((sum, d, i) => {
          // 각 날의 MA20 대비 거래량 비율 (단순화: 마지막 MA20 사용)
          const ma20 = volumeAnalysis.current.volumeMA20 || 1;
          return sum + (d.volume / ma20);
        }, 0) / preSurgeData.length;

        // 5일간 거래량 증가율
        const volumeGrowth = preSurgeData.length >= 2
          ? ((preSurgeData[4].volume - preSurgeData[0].volume) / preSurgeData[0].volume) * 100
          : 0;

        // 5일간 OBV 추세
        const obvTrend = this.calculateOBVTrend(preSurgeData);

        // 5일간 가격 변동성
        const priceVolatility = this.calculatePriceVolatility(preSurgeData);

        // D-1 거래일 RSI
        const rsi = this.calculateRSI(preSurgeData.map(d => d.close));

        // D-5 ~ D-1 일별 가격 데이터
        const dailyPriceData = preSurgeData.map((d, i) => {
          const prevClose = i === 0 ? d.close : preSurgeData[i - 1].close;
          const dailyReturn = i === 0 ? 0 : ((d.close - prevClose) / prevClose * 100);
          return {
            date: d.date,
            close: d.close,
            dailyReturn: dailyReturn.toFixed(2),
            volume: d.volume
          };
        });

        qualified.push({
          stockCode,
          stockName: nameMap.get(stockCode) || stockCode,
          surgeDate: surgeDay.date,
          returnRate: maxReturn.toFixed(2),
          pullbackRate: pullbackRate.toFixed(2),
          recentHigh,
          surgeDayPrice: surgeDay.close,
          tradingDaysBeforeSurge: 5, // 거래일 명시
          // ⭐ D-5 ~ D-1 일별 가격 데이터
          dailyPriceData: dailyPriceData,
          // ⭐ D-5 ~ D-1 선행 지표
          preSurgeIndicators: {
            accumulation: advancedAnalysis.indicators.accumulation.detected,
            whale: advancedAnalysis.indicators.whale.length > 0,
            avgVolumeRatio: avgVolumeRatio.toFixed(2),
            volumeGrowth: volumeGrowth.toFixed(1),
            mfi: volumeAnalysis.indicators.mfi,
            obvTrend: obvTrend.toFixed(2),
            priceVolatility: priceVolatility.toFixed(2),
            rsi: rsi.toFixed(1),
            closingStrength: this.calculateClosingStrength(preSurgeData[preSurgeData.length - 1])
          }
        });

        console.log(`  ✅ [${qualified.length}] ${stockCode}: ${maxReturn.toFixed(1)}% (D-5 지표 추출)`);

        // API 호출 간격
        await new Promise(resolve => setTimeout(resolve, 200));

        // 진행률 로그
        if (analyzed % 10 === 0) {
          console.log(`  📊 진행: ${analyzed}/${stockCodes.length}, 발견: ${qualified.length}개`);
        }

      } catch (error) {
        console.error(`  ❌ 분석 실패 [${stockCode}]:`, error.message);
      }
    }

    console.log(`\n✅ Phase 2+3 완료!`);
    console.log(`  - 분석: ${analyzed}개`);
    console.log(`  - Phase 2 통과 (15% 이상 상승): ${phase2Pass}개`);
    console.log(`  - Phase 3 제외 (15% 되돌림): ${phase3Filtered}개`);
    console.log(`  - 최종 선별 (D-5 지표 추출): ${qualified.length}개\n`);

    return qualified;
  }

  /**
   * 5일간 OBV 추세 계산
   */
  calculateOBVTrend(chartData) {
    if (chartData.length < 2) return 0;

    let obv = 0;
    const obvValues = [];

    for (let i = 0; i < chartData.length; i++) {
      if (i === 0) {
        obv = chartData[i].volume;
      } else {
        const priceChange = chartData[i].close - chartData[i - 1].close;
        if (priceChange > 0) {
          obv += chartData[i].volume;
        } else if (priceChange < 0) {
          obv -= chartData[i].volume;
        }
      }
      obvValues.push(obv);
    }

    // 선형 추세: 첫날 대비 마지막날 증가율
    const firstOBV = obvValues[0];
    const lastOBV = obvValues[obvValues.length - 1];

    if (Math.abs(firstOBV) < 1) return 0; // OBV가 너무 작으면 0
    return (lastOBV - firstOBV) / Math.abs(firstOBV);
  }

  /**
   * 5일간 가격 변동성 계산 (표준편차 / 평균)
   */
  calculatePriceVolatility(chartData) {
    const closes = chartData.map(d => d.close);
    const mean = closes.reduce((a, b) => a + b) / closes.length;
    const variance = closes.reduce((sum, price) =>
      sum + Math.pow(price - mean, 2), 0
    ) / closes.length;
    const stdDev = Math.sqrt(variance);
    return (stdDev / mean) * 100; // %
  }

  /**
   * RSI 계산 (간단 버전)
   */
  calculateRSI(prices) {
    if (prices.length < 5) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / (prices.length - 1);
    const avgLoss = losses / (prices.length - 1);

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Step 2: 선행 패턴 추출 및 빈도 계산 (D-5 거래일 기준)
   */
  extractPatterns(qualifiedStocks) {
    console.log(`🔍 선행 패턴 추출 시작... (총 ${qualifiedStocks.length}개 급등 종목)\n`);
    console.log(`⭐ 분석 시점: 급등 5거래일 전 (D-5 ~ D-1)\n`);

    const patternFrequency = {};

    for (const stock of qualifiedStocks) {
      const ind = stock.preSurgeIndicators; // ⭐ D-5 선행 지표 사용

      // 선행 패턴 정의 (급등 5거래일 전 지표 기반)
      const patterns = [
        // 패턴 1: 5일 조용한 매집
        {
          name: '5일 조용한 매집 → 급등',
          match: ind.accumulation && parseFloat(ind.priceVolatility) < 3,
          key: 'pre_5d_accumulation'
        },
        // 패턴 2: 5일 매집 + 고래신호
        {
          name: '5일 매집 + 고래 → 급등',
          match: ind.accumulation && ind.whale,
          key: 'pre_5d_accumulation_whale'
        },
        // 패턴 3: 5일 OBV 상승 + 가격 횡보
        {
          name: '5일 OBV 상승 → 급등',
          match: parseFloat(ind.obvTrend) > 0.1 && parseFloat(ind.priceVolatility) < 4,
          key: 'pre_5d_obv_rising'
        },
        // 패턴 4: 5일 거래량 점진 증가
        {
          name: '5일 거래량 점진증가 → 급등',
          match: parseFloat(ind.volumeGrowth) >= 50 && parseFloat(ind.volumeGrowth) <= 120,
          key: 'pre_5d_volume_gradual'
        },
        // 패턴 5: D-1 MFI 저점 + 5일 매집
        {
          name: '5일 MFI 저점 + 매집 → 급등',
          match: parseFloat(ind.mfi) < 35 && ind.accumulation,
          key: 'pre_5d_mfi_accumulation'
        },
        // 패턴 6: D-1 RSI 중립 + 5일 거래량 증가
        {
          name: '5일 RSI 중립 + 거래량 → 급등',
          match: parseFloat(ind.rsi) >= 45 && parseFloat(ind.rsi) <= 65 && parseFloat(ind.avgVolumeRatio) >= 1.5,
          key: 'pre_5d_rsi_volume'
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
              stockNames: [],
              totalReturn: 0,
              wins: 0, // 승리 횟수
              losses: 0 // 실패 횟수
            };
          }
          patternFrequency[pattern.key].count++;
          patternFrequency[pattern.key].stocks.push(stock.stockCode);
          patternFrequency[pattern.key].stockNames.push(stock.stockName);
          patternFrequency[pattern.key].totalReturn += parseFloat(stock.returnRate);

          // 승패 카운트 (15% 이상 상승을 성공으로 간주)
          if (parseFloat(stock.returnRate) >= 15) {
            patternFrequency[pattern.key].wins++;
          } else {
            patternFrequency[pattern.key].losses++;
          }
        }
      }
    }

    // 빈도순 정렬 및 통계 계산
    const rankedPatterns = Object.entries(patternFrequency)
      .map(([key, data]) => {
        const frequency = (data.count / qualifiedStocks.length * 100);
        const avgReturn = (data.totalReturn / data.count);
        const winRate = (data.wins / data.count) * 100;

        // ⭐ 신뢰도 계산 (출현율 + 승률)
        const confidence = this.calculateConfidence(frequency, winRate);

        return {
          key,
          name: data.name,
          count: data.count,
          frequency: frequency.toFixed(1),
          avgReturn: avgReturn.toFixed(2),
          winRate: winRate.toFixed(1),
          wins: data.wins,
          losses: data.losses,
          confidence: confidence, // ⭐ 신뢰도
          leadTime: 5, // 거래일
          sampleStocks: data.stocks.slice(0, 5),
          sampleStockNames: data.stockNames.slice(0, 5)
        };
      })
      .sort((a, b) => parseFloat(b.confidence) - parseFloat(a.confidence)); // 신뢰도순 정렬

    console.log(`✅ 선행 패턴 추출 완료!\n`);
    console.log(`📊 발견된 선행 패턴 (신뢰도순):\n`);

    rankedPatterns.forEach((pattern, i) => {
      console.log(`${i + 1}. ${pattern.name}`);
      console.log(`   출현: ${pattern.count}회 (${pattern.frequency}%)`);
      console.log(`   승률: ${pattern.winRate}% (${pattern.wins}승 ${pattern.losses}패)`);
      console.log(`   신뢰도: ${pattern.confidence}% ${this.getConfidenceBadge(parseFloat(pattern.confidence))}`);
      console.log(`   평균 수익률: +${pattern.avgReturn}% (5거래일 후)`);
      console.log(`   샘플: ${pattern.sampleStockNames.join(', ')}\n`);
    });

    return rankedPatterns;
  }

  /**
   * 신뢰도 계산 (출현율 + 승률 기반)
   */
  calculateConfidence(frequency, winRate) {
    // 출현 점수 (0-50점)
    const frequencyScore = Math.min(frequency, 50);

    // 승률 점수 (0-50점)
    const winRateScore = (winRate / 100) * 50;

    // 종합 신뢰도 (0-100%)
    const confidence = frequencyScore + winRateScore;

    return confidence.toFixed(1);
  }

  /**
   * 신뢰도 등급 표시
   */
  getConfidenceBadge(confidence) {
    if (confidence >= 80) return '⭐⭐⭐⭐⭐';
    if (confidence >= 70) return '⭐⭐⭐⭐';
    if (confidence >= 60) return '⭐⭐⭐';
    if (confidence >= 50) return '⭐⭐';
    return '⭐';
  }

  /**
   * 선행 패턴 매칭 헬퍼 (D-5 지표 기반)
   */
  matchesLeadingPattern(stock, patternKey) {
    const ind = stock.preSurgeIndicators;

    const patternMatchers = {
      'pre_5d_accumulation': ind.accumulation && parseFloat(ind.priceVolatility) < 3,
      'pre_5d_accumulation_whale': ind.accumulation && ind.whale,
      'pre_5d_obv_rising': parseFloat(ind.obvTrend) > 0.1 && parseFloat(ind.priceVolatility) < 4,
      'pre_5d_volume_gradual': parseFloat(ind.volumeGrowth) >= 50 && parseFloat(ind.volumeGrowth) <= 120,
      'pre_5d_mfi_accumulation': parseFloat(ind.mfi) < 35 && ind.accumulation,
      'pre_5d_rsi_volume': parseFloat(ind.rsi) >= 45 && parseFloat(ind.rsi) <= 65 && parseFloat(ind.avgVolumeRatio) >= 1.5
    };

    return patternMatchers[patternKey] || false;
  }

  /**
   * 전체 급등 방정식 마이닝 파이프라인 실행 (D-5 선행 지표 기반)
   */
  async analyzeSmartPatterns() {
    try {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`🧠 급등 방정식 마이닝 시작 (D-5 선행 패턴 분석)`);
      console.log(`${'='.repeat(70)}`);
      console.log(`\n전략:`);
      console.log(`  Phase 1: 거래량 증가율 상위 60개 (KOSPI 30 + KOSDAQ 30)`);
      console.log(`  Phase 2: 10거래일 대비 +15% 이상 급등 종목 찾기`);
      console.log(`  Phase 3: 급등 5거래일 전 (D-5 ~ D-1) 선행 지표 추출`);
      console.log(`  Step 2: 선행 패턴 추출 및 신뢰도 계산`);
      console.log(`${'='.repeat(70)}\n`);

      // Phase 1: 거래량 증가율 상위 종목 선별
      const { codes: candidateCodes, nameMap } = await this.getHighVolumeSurgeStocks();

      if (candidateCodes.length === 0) {
        console.log('⚠️ Phase 1에서 종목을 찾지 못했습니다.');
        return null;
      }

      // Phase 2+3: 급등 종목 찾기 + D-5 선행 지표 분석
      const qualifiedStocks = await this.filterBySurgeAndPullback(candidateCodes, nameMap);

      if (qualifiedStocks.length === 0) {
        console.log(`⚠️ 필터링 후 급등 종목이 없습니다.`);
        return null;
      }

      // 🆕 개별 종목별 D-5 선행 지표 추출 (패턴 집계 건너뜀)
      const stocksWithPatterns = qualifiedStocks.map(stock => {
        const ind = stock.preSurgeIndicators;

        // 각 종목별로 매칭되는 패턴들 찾기 (완화된 조건)
        const matchedPatterns = [];
        const patterns = [
          // 패턴 1: 조용한 매집 (낮은 변동성)
          { name: '5일 조용한 매집', match: ind.accumulation && parseFloat(ind.priceVolatility) < 5, key: 'pre_5d_accumulation' },

          // 패턴 2: 매집 + 고래
          { name: '5일 매집+고래', match: ind.accumulation && ind.whale, key: 'pre_5d_accumulation_whale' },

          // 패턴 3: OBV 상승 (조건 완화: 0 초과면 상승)
          { name: '5일 OBV상승', match: parseFloat(ind.obvTrend) > 0 && parseFloat(ind.priceVolatility) < 6, key: 'pre_5d_obv_rising' },

          // 패턴 4: 거래량 점진 증가 (범위 확대)
          { name: '5일 거래량증가', match: parseFloat(ind.volumeGrowth) >= 30 && parseFloat(ind.volumeGrowth) <= 150, key: 'pre_5d_volume_gradual' },

          // 패턴 5: MFI 저점 + 매집 (MFI null 허용, 조건 완화)
          { name: '5일 MFI저점+매집', match: (ind.mfi === null || parseFloat(ind.mfi) < 40) && ind.accumulation, key: 'pre_5d_mfi_accumulation' },

          // 패턴 6: RSI 중립 + 거래량 (범위 확대)
          { name: '5일 RSI중립+거래량', match: parseFloat(ind.rsi) >= 40 && parseFloat(ind.rsi) <= 70 && parseFloat(ind.avgVolumeRatio) >= 1.2, key: 'pre_5d_rsi_volume' },

          // 🆕 패턴 7: 강한 거래량 증가 (단순 조건)
          { name: '5일 거래량폭발', match: parseFloat(ind.avgVolumeRatio) >= 2.0, key: 'pre_5d_volume_surge' },

          // 🆕 패턴 8: RSI 과열 회피 (30-80 범위)
          { name: '5일 안정RSI', match: parseFloat(ind.rsi) >= 30 && parseFloat(ind.rsi) <= 80, key: 'pre_5d_stable_rsi' }
        ];

        patterns.forEach(p => {
          if (p.match) matchedPatterns.push({ name: p.name, key: p.key });
        });

        return {
          stockCode: stock.stockCode,
          stockName: stock.stockName,
          surgeDate: stock.surgeDate,
          returnRate: stock.returnRate,
          pullbackRate: stock.pullbackRate,
          dailyPriceData: stock.dailyPriceData,  // ⭐ 일별 가격 데이터 포함
          matchedPatterns: matchedPatterns,
          preSurgeIndicators: stock.preSurgeIndicators
        };
      });

      // 수익률 순으로 정렬
      stocksWithPatterns.sort((a, b) => parseFloat(b.returnRate) - parseFloat(a.returnRate));

      console.log(`\n🏆 D-5 선행 지표 분석 완료! (총 ${stocksWithPatterns.length}개 종목)\n`);
      stocksWithPatterns.forEach((s, i) => {
        console.log(`${i + 1}. ${s.stockName} (${s.stockCode})`);
        console.log(`   급등률: +${s.returnRate}% (${s.surgeDate})`);
        console.log(`   매칭 패턴: ${s.matchedPatterns.map(p => p.name).join(', ') || '없음'}`);
        console.log(`   D-5 지표: MFI=${s.preSurgeIndicators.mfi}, RSI=${s.preSurgeIndicators.rsi}, 거래량=${s.preSurgeIndicators.avgVolumeRatio}x\n`);
      });

      return {
        generatedAt: new Date().toISOString(),
        parameters: {
          phase1Candidates: candidateCodes.length,
          phase2MinReturn: this.minReturnThreshold,
          phase3PullbackThreshold: this.pullbackThreshold,
          lookbackDays: this.lookbackDays,
          tradingDaysBeforeSurge: 5,
          totalQualified: qualifiedStocks.length
        },
        stocks: stocksWithPatterns,  // 🆕 개별 종목 데이터
        patterns: []  // 빈 배열 (하위 호환성)
      };

    } catch (error) {
      console.error('❌ 급등 방정식 마이닝 실패:', error);
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
   * 현재 종목이 저장된 패턴과 매칭되는지 확인 (부분 매칭 포함)
   * @param {Object} stock - 종목 분석 결과 (screening.js의 analyzeStock 반환값)
   * @param {Array} patterns - 저장된 패턴 목록
   * @returns {Object} 매칭 결과 및 보너스 점수
   */
  checkPatternMatch(stock, patterns) {
    if (!patterns || patterns.length === 0) {
      return { matched: false, patterns: [], bonusScore: 0, partialMatches: [] };
    }

    const matchedPatterns = [];
    const partialMatches = [];
    let bonusScore = 0;

    // 현재 종목의 지표를 패턴 형식으로 변환
    const stockIndicators = {
      // 기존 지표
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
        : 50,

      // D-5 패턴용 추가 지표 (advancedAnalysis에서 제공)
      priceVolatility: stock.advancedAnalysis.indicators.accumulation?.priceVolatility || 100,
      obvTrend: stock.volumeAnalysis.indicators.obvTrend || 0,
      volumeGrowth: stock.advancedAnalysis.indicators.accumulation?.volumeGrowth || 0,
      rsi: stock.volumeAnalysis.indicators.rsi || 50
    };

    // 각 패턴과 매칭 확인
    for (const pattern of patterns) {
      const mockStock = { indicators: stockIndicators };
      const matchScore = this.calculateMatchScore(mockStock, pattern.key);

      // 완전 매칭 (100%)
      if (matchScore.score === 1.0) {
        matchedPatterns.push({
          name: pattern.name,
          key: pattern.key,
          winRate: parseFloat(pattern.winRate || pattern.backtest?.winRate || 0),
          avgReturn: parseFloat(pattern.avgReturn || pattern.backtest?.avgReturn || 0),
          confidence: parseFloat(pattern.confidence || 0),
          frequency: pattern.frequency,
          matchScore: 1.0,
          matchLevel: '완전일치'
        });

        // 패턴 승률에 비례한 보너스 점수 (최대 15점)
        const winRate = parseFloat(pattern.winRate || pattern.backtest?.winRate || 0);
        const patternBonus = winRate / 100 * 15;
        bonusScore += patternBonus;
      }
      // 부분 매칭 (60% 이상)
      else if (matchScore.score >= 0.6) {
        const matchLevel = matchScore.score >= 0.8 ? '상' : matchScore.score >= 0.7 ? '중' : '하';
        partialMatches.push({
          name: pattern.name,
          key: pattern.key,
          winRate: parseFloat(pattern.winRate || pattern.backtest?.winRate || 0),
          avgReturn: parseFloat(pattern.avgReturn || pattern.backtest?.avgReturn || 0),
          confidence: parseFloat(pattern.confidence || 0),
          frequency: pattern.frequency,
          matchScore: matchScore.score,
          matchLevel: matchLevel,
          matchedConditions: matchScore.matched,
          totalConditions: matchScore.total,
          missingConditions: matchScore.missing
        });

        // 부분 매칭도 약간의 보너스 (최대 5점)
        const winRate = parseFloat(pattern.winRate || pattern.backtest?.winRate || 0);
        const partialBonus = winRate / 100 * 5 * matchScore.score;
        bonusScore += partialBonus;
      }
    }

    return {
      matched: matchedPatterns.length > 0,
      patterns: matchedPatterns,
      partialMatches: partialMatches,
      bonusScore: Math.min(bonusScore, 20) // 최대 20점
    };
  }

  /**
   * 패턴 매칭 점수 계산 (0.0 ~ 1.0)
   * @returns {Object} { score, matched, total, missing }
   */
  calculateMatchScore(stock, patternKey) {
    const ind = stock.indicators;

    // D-5 선행 패턴 + 이전 패턴 통합
    const conditions = {
      // ⭐ D-5 선행 패턴 (새로운 패턴)
      'pre_5d_accumulation': [
        { name: '조용한매집', met: ind.accumulation },
        { name: '낮은변동성<3%', met: parseFloat(ind.priceVolatility || 100) < 3 }
      ],
      'pre_5d_accumulation_whale': [
        { name: '조용한매집', met: ind.accumulation },
        { name: '고래감지', met: ind.whale > 0 }
      ],
      'pre_5d_obv_rising': [
        { name: 'OBV상승>0.1', met: parseFloat(ind.obvTrend || 0) > 0.1 },
        { name: '가격횡보<4%', met: parseFloat(ind.priceVolatility || 100) < 4 }
      ],
      'pre_5d_volume_gradual': [
        { name: '거래량증가50-120%', met: parseFloat(ind.volumeGrowth || 0) >= 50 && parseFloat(ind.volumeGrowth || 0) <= 120 }
      ],
      'pre_5d_mfi_accumulation': [
        { name: 'MFI저점<35', met: parseFloat(ind.mfi || 50) < 35 },
        { name: '조용한매집', met: ind.accumulation }
      ],
      'pre_5d_rsi_volume': [
        { name: 'RSI중립45-65', met: parseFloat(ind.rsi || 50) >= 45 && parseFloat(ind.rsi || 50) <= 65 },
        { name: '거래량증가1.5+', met: parseFloat(ind.volumeRatio || 1) >= 1.5 }
      ],

      // 이전 패턴 (하위 호환성)
      'whale_accumulation': [
        { name: '고래감지', met: ind.whale > 0 },
        { name: '조용한매집', met: ind.accumulation }
      ],
      'drain_escape': [
        { name: '유동성고갈', met: ind.drain },
        { name: '탈출속도', met: ind.escape }
      ],
      'whale_highvolume': [
        { name: '고래감지', met: ind.whale > 0 },
        { name: '고거래량', met: parseFloat(ind.volumeRatio) >= 2.5 }
      ],
      'asymmetric_accumulation': [
        { name: '비대칭비율1.5+', met: ind.asymmetric >= 1.5 },
        { name: '조용한매집', met: ind.accumulation }
      ],
      'escape_strongclose': [
        { name: '탈출속도', met: ind.escape },
        { name: '강한마감70+', met: ind.closingStrength >= 70 }
      ],
      'mfi_oversold_whale': [
        { name: 'MFI과매도30-', met: ind.mfi <= 30 },
        { name: '고래감지', met: ind.whale > 0 }
      ],
      'drain_asymmetric': [
        { name: '유동성고갈', met: ind.drain },
        { name: '비대칭비율1.5+', met: ind.asymmetric >= 1.5 }
      ],
      'accumulation_moderate': [
        { name: '조용한매집', met: ind.accumulation },
        { name: '적정거래량1.5-3x', met: parseFloat(ind.volumeRatio) >= 1.5 && parseFloat(ind.volumeRatio) < 3 }
      ]
    };

    const patternConditions = conditions[patternKey] || [];
    if (patternConditions.length === 0) {
      return { score: 0, matched: 0, total: 0, missing: [] };
    }

    const metConditions = patternConditions.filter(c => c.met);
    const missingConditions = patternConditions.filter(c => !c.met).map(c => c.name);

    return {
      score: metConditions.length / patternConditions.length,
      matched: metConditions.length,
      total: patternConditions.length,
      missing: missingConditions
    };
  }

  /**
   * 저장된 패턴 로드 (GitHub Gist → 메모리 캐시 → 로컬 파일)
   */
  loadSavedPatterns() {
    try {
      // ⚠️ 주의: async 함수가 아니므로 Gist 로드는 API 엔드포인트에서 처리
      // 여기서는 메모리 캐시만 사용
      const patternCache = require('./patternCache');
      const cached = patternCache.loadPatterns();

      if (cached && cached.patterns) {
        console.log(`✅ 캐시된 패턴 로드: ${cached.patterns.length}개`);
        return cached.patterns;
      }

      // 캐시가 없으면 로컬 파일에서 시도 (로컬 개발용)
      try {
        const fs = require('fs');
        const path = './data/patterns.json';

        if (fs.existsSync(path)) {
          const data = fs.readFileSync(path, 'utf8');
          const parsed = JSON.parse(data);
          console.log(`✅ 로컬 파일에서 패턴 로드: ${parsed.patterns?.length || 0}개`);
          return parsed.patterns || [];
        }
      } catch (fsError) {
        // 파일시스템 오류는 무시 (Vercel에서는 읽기 전용)
      }
    } catch (error) {
      console.log('⚠️ 저장된 패턴 로드 실패:', error.message);
    }
    return [];
  }

  /**
   * 저장된 패턴 로드 (async 버전, GitHub Gist 포함)
   * API 엔드포인트에서 사용
   */
  async loadSavedPatternsAsync() {
    try {
      // 1순위: GitHub Gist에서 로드
      const gistStorage = require('./gistStorage');
      if (gistStorage.isConfigured()) {
        const gistData = await gistStorage.loadPatterns();
        if (gistData && gistData.patterns) {
          console.log(`✅ GitHub Gist에서 패턴 로드: ${gistData.patterns.length}개`);
          // 메모리 캐시에도 저장
          const patternCache = require('./patternCache');
          patternCache.savePatterns(gistData);
          return gistData.patterns;
        }
      }

      // 2순위: 메모리 캐시
      const patternCache = require('./patternCache');
      const cached = patternCache.loadPatterns();

      if (cached && cached.patterns) {
        console.log(`✅ 캐시된 패턴 로드: ${cached.patterns.length}개`);
        return cached.patterns;
      }

      // 3순위: 로컬 파일 (로컬 개발용)
      try {
        const fs = require('fs');
        const path = './data/patterns.json';

        if (fs.existsSync(path)) {
          const data = fs.readFileSync(path, 'utf8');
          const parsed = JSON.parse(data);
          console.log(`✅ 로컬 파일에서 패턴 로드: ${parsed.patterns?.length || 0}개`);
          return parsed.patterns || [];
        }
      } catch (fsError) {
        // 파일시스템 오류는 무시
      }
    } catch (error) {
      console.log('⚠️ 저장된 패턴 로드 실패:', error.message);
    }
    return [];
  }
}

module.exports = new SmartPatternMiner();
