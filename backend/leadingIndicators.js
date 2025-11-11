/**
 * 선행 지표 통합 모듈 (Leading Indicators)
 *
 * 패턴 분석 + DNA 시스템 통합
 * - smartPatternMining: D-5 선행 패턴 (구체적 조건)
 * - volumeDnaExtractor: EMA + 시간 가중치 (정교한 분석)
 *
 * 통합으로 인한 시너지:
 * - 패턴의 구체성 + DNA의 정교함
 * - 단일 점수 체계로 간소화
 * - screening.js에서 직접 사용 가능
 */

const smartPatternMiner = require('./smartPatternMining');
const volumeDnaExtractor = require('./volumeDnaExtractor');

class LeadingIndicators {
  constructor() {
    // 저장된 패턴 캐시
    this.savedPatterns = null;
    this.dnaPatterns = null;
  }

  /**
   * 선행 지표 종합 분석
   * @param {Object} volumeAnalysis - 거래량 분석 결과
   * @param {Object} advancedAnalysis - 고급 지표 분석 결과
   * @param {Array} chartData - 차트 데이터
   * @param {Array} investorData - 투자자 데이터 (선택)
   * @returns {Object} 통합 선행 지표 점수
   */
  analyzeLeadingIndicators(volumeAnalysis, advancedAnalysis, chartData, investorData = null) {
    // 1. 패턴 매칭 점수 (smartPatternMining 기반)
    const patternScore = this.calculatePatternScore(volumeAnalysis, advancedAnalysis);

    // 2. DNA 매칭 점수 (volumeDnaExtractor 기반)
    const dnaScore = this.calculateDnaScore(chartData, investorData);

    // 3. 하이브리드 점수 (패턴 50% + DNA 50%)
    const combinedScore = {
      pattern: patternScore,
      dna: dnaScore,

      // 종합 점수 (0-100점)
      total: (patternScore.score * 0.5) + (dnaScore.score * 0.5),

      // 신뢰도 (패턴 신뢰도 + DNA 신뢰도)
      confidence: (patternScore.confidence + dnaScore.confidence) / 2,

      // 추천 강도
      strength: this.calculateStrength(patternScore, dnaScore)
    };

    return combinedScore;
  }

  /**
   * 패턴 기반 점수 계산 (smartPatternMining)
   * @param {Object} volumeAnalysis
   * @param {Object} advancedAnalysis
   * @returns {Object} 패턴 점수
   */
  calculatePatternScore(volumeAnalysis, advancedAnalysis) {
    // 패턴 목록이 없으면 0점
    if (!this.savedPatterns || this.savedPatterns.length === 0) {
      return {
        score: 0,
        confidence: 0,
        matched: false,
        patterns: []
      };
    }

    // 현재 종목 지표
    const stockIndicators = {
      whale: advancedAnalysis.indicators.whale.length,
      accumulation: advancedAnalysis.indicators.accumulation.detected,
      volumeRatio: volumeAnalysis.current.volumeMA20
        ? volumeAnalysis.current.volume / volumeAnalysis.current.volumeMA20
        : 1,
      mfi: volumeAnalysis.indicators.mfi,
      obvTrend: this.calculateObvTrendFromAnalysis(volumeAnalysis),
      priceVolatility: advancedAnalysis.indicators.accumulation?.priceVolatility || 100,
      volumeGrowth: advancedAnalysis.indicators.accumulation?.volumeGrowth || 0
    };

    // 패턴 매칭
    const matchResults = [];
    let totalScore = 0;
    let maxConfidence = 0;

    for (const pattern of this.savedPatterns) {
      const matchScore = smartPatternMiner.calculateMatchScore(
        { indicators: stockIndicators },
        pattern.key
      );

      // 60% 이상 매칭
      if (matchScore.score >= 0.6) {
        const confidence = parseFloat(pattern.confidence || 0);
        const winRate = parseFloat(pattern.winRate || 0);

        // 패턴 점수 = 매칭도 × 승률 × 신뢰도
        const patternPoints = matchScore.score * (winRate / 100) * (confidence / 100) * 100;

        matchResults.push({
          name: pattern.name,
          key: pattern.key,
          matchScore: matchScore.score,
          winRate: winRate,
          confidence: confidence,
          points: patternPoints
        });

        totalScore += patternPoints;
        maxConfidence = Math.max(maxConfidence, confidence);
      }
    }

    // 정규화 (최대 100점)
    const normalizedScore = Math.min(totalScore, 100);

    return {
      score: normalizedScore,
      confidence: maxConfidence,
      matched: matchResults.length > 0,
      patterns: matchResults.slice(0, 3), // 상위 3개
      totalMatched: matchResults.length
    };
  }

  /**
   * DNA 기반 점수 계산 (volumeDnaExtractor)
   * @param {Array} chartData
   * @param {Array} investorData
   * @returns {Object} DNA 점수
   */
  calculateDnaScore(chartData, investorData = null) {
    try {
      // DNA 패턴이 없으면 거래량 분석만 수행
      if (!this.dnaPatterns) {
        return this.calculateBasicVolumeScore(chartData);
      }

      // 현재 종목의 거래량 패턴 분석
      const volumePattern = volumeDnaExtractor.analyzeVolumePattern(chartData);

      if (volumePattern.error) {
        return {
          score: 0,
          confidence: 0,
          matched: false,
          details: null
        };
      }

      // 기관/외국인 데이터 분석 (선택)
      let institutionFlow = { institution: null, foreign: null };
      if (investorData && investorData.length > 0) {
        institutionFlow = volumeDnaExtractor.analyzeInstitutionFlow(investorData);
      }

      // 현재 패턴
      const currentPattern = {
        volumeRate: volumePattern,
        institutionFlow: institutionFlow.institution,
        foreignFlow: institutionFlow.foreign
      };

      // DNA 매칭 점수
      const matchResult = volumeDnaExtractor.calculateMatchScore(
        currentPattern,
        this.dnaPatterns
      );

      return {
        score: matchResult.totalScore,
        confidence: this.dnaPatterns.dnaStrength || 0,
        matched: matchResult.totalScore >= 70,
        details: matchResult.details,
        volumePattern: volumePattern
      };

    } catch (error) {
      console.error('DNA 점수 계산 실패:', error.message);
      return {
        score: 0,
        confidence: 0,
        matched: false,
        error: error.message
      };
    }
  }

  /**
   * 기본 거래량 점수 (DNA 패턴 없을 때)
   * @param {Array} chartData
   * @returns {Object}
   */
  calculateBasicVolumeScore(chartData) {
    try {
      const volumePattern = volumeDnaExtractor.analyzeVolumePattern(chartData);

      if (volumePattern.error) {
        return { score: 0, confidence: 0, matched: false };
      }

      // 거래량 증가율 기반 간단한 점수
      // EMA > 50% && recent5d > 30% = 높은 점수
      let score = 0;

      if (volumePattern.emaAvg > 50) score += 30;
      else if (volumePattern.emaAvg > 30) score += 20;
      else if (volumePattern.emaAvg > 10) score += 10;

      if (volumePattern.recent5d > 30) score += 25;
      else if (volumePattern.recent5d > 15) score += 15;
      else if (volumePattern.recent5d > 5) score += 5;

      // 트렌드 가속 보너스
      if (volumePattern.segmented.trend === 'accelerating') score += 20;
      else if (volumePattern.segmented.trend === 'mixed') score += 10;

      // 급등 임박성 보너스
      if (volumePattern.urgency === 'high') score += 25;

      return {
        score: Math.min(score, 100),
        confidence: 50, // 기본 신뢰도
        matched: score >= 50,
        volumePattern: volumePattern
      };

    } catch (error) {
      return { score: 0, confidence: 0, matched: false };
    }
  }

  /**
   * 추천 강도 계산
   * @param {Object} patternScore
   * @param {Object} dnaScore
   * @returns {string} 강도 (very_high/high/moderate/low)
   */
  calculateStrength(patternScore, dnaScore) {
    const combined = (patternScore.score + dnaScore.score) / 2;
    const confidence = (patternScore.confidence + dnaScore.confidence) / 2;

    // 양쪽 모두 매칭
    if (patternScore.matched && dnaScore.matched && combined >= 70) {
      return 'very_high';  // 매우 강력
    }

    // 한쪽 매칭 + 높은 점수
    if ((patternScore.matched || dnaScore.matched) && combined >= 60) {
      return 'high';  // 강력
    }

    // 중간 점수
    if (combined >= 40) {
      return 'moderate';  // 중간
    }

    return 'low';  // 낮음
  }

  /**
   * OBV 추세 계산 (volumeAnalysis에서)
   */
  calculateObvTrendFromAnalysis(volumeAnalysis) {
    if (!volumeAnalysis.signals || !volumeAnalysis.signals.obvTrend) {
      return 0;
    }

    const obvTrendText = volumeAnalysis.signals.obvTrend;

    if (obvTrendText.includes('강한 상승')) return 0.3;
    if (obvTrendText.includes('상승')) return 0.15;
    if (obvTrendText.includes('횡보')) return 0;
    if (obvTrendText.includes('하락')) return -0.15;

    return 0;
  }

  /**
   * 저장된 패턴 로드 (async)
   * screening.js 초기화 시 호출
   */
  async loadPatterns() {
    try {
      // 패턴 로드
      this.savedPatterns = await smartPatternMiner.loadSavedPatternsAsync();
      console.log(`✅ 선행 지표: 패턴 ${this.savedPatterns.length}개 로드`);

      // DNA 로드는 선택 (Supabase 또는 파일에서)
      // TODO: DNA 패턴 저장/로드 구현 필요
      this.dnaPatterns = null;

    } catch (error) {
      console.log('⚠️ 선행 지표 패턴 로드 실패:', error.message);
      this.savedPatterns = [];
      this.dnaPatterns = null;
    }
  }

  /**
   * DNA 패턴 설정 (외부에서 주입)
   * @param {Object} dnaPatterns - 추출된 DNA
   */
  setDnaPatterns(dnaPatterns) {
    this.dnaPatterns = dnaPatterns;
    console.log('✅ DNA 패턴 설정 완료');
  }

  /**
   * 패턴 통계 조회
   * @returns {Object} 통계 정보
   */
  getPatternStats() {
    return {
      patternCount: this.savedPatterns ? this.savedPatterns.length : 0,
      hasDna: this.dnaPatterns !== null,
      dnaStrength: this.dnaPatterns ? this.dnaPatterns.dnaStrength : 0
    };
  }

  /**
   * 선행 지표 점수를 스크리닝 점수로 변환 (0-80점)
   * @param {Object} leadingScore - analyzeLeadingIndicators 결과
   * @returns {number} 스크리닝 점수 (0-80점)
   */
  convertToScreeningScore(leadingScore) {
    // 종합 점수 (0-100) → 스크리닝 점수 (0-80)
    const baseScore = (leadingScore.total / 100) * 80;

    // 강도별 가산점
    const strengthBonus = {
      'very_high': 10,
      'high': 5,
      'moderate': 2,
      'low': 0
    };

    const bonus = strengthBonus[leadingScore.strength] || 0;

    // 신뢰도 페널티 (신뢰도 < 50%일 때)
    const confidencePenalty = leadingScore.confidence < 50
      ? (50 - leadingScore.confidence) * 0.2
      : 0;

    const finalScore = Math.max(0, baseScore + bonus - confidencePenalty);

    return Math.min(finalScore, 80);
  }

  /**
   * 선행 지표 요약 메시지 생성
   * @param {Object} leadingScore
   * @returns {string}
   */
  generateSummary(leadingScore) {
    const { pattern, dna, strength, total } = leadingScore;

    if (strength === 'very_high') {
      return `🔥 강력한 선행 신호 (패턴+DNA 매칭)`;
    }

    if (strength === 'high') {
      if (pattern.matched && dna.matched) {
        return `📈 선행 신호 강함 (패턴+DNA)`;
      } else if (pattern.matched) {
        return `📊 패턴 매칭 (${pattern.totalMatched}개)`;
      } else if (dna.matched) {
        return `🧬 DNA 매칭 (${dna.score.toFixed(1)}점)`;
      }
    }

    if (strength === 'moderate') {
      return `📉 선행 신호 약함`;
    }

    return `⚪ 선행 신호 없음`;
  }
}

module.exports = new LeadingIndicators();
