/**
 * 공매도 분석 API
 *
 * Phase 1: 차트 데이터 기반 추정 시스템 (즉시 사용 가능)
 * Phase 2: KRX 실제 API 연동 (인증키 발급 후 업그레이드)
 *
 * KRX API 정보:
 * - 공식 사이트: https://data.krx.co.kr
 * - 데이터 지연: T+2 (2영업일 지연)
 * - 제공 데이터: 공매도 거래량, 공매도 거래대금, 공매도 비중, 잔고 정보
 * - 인증 방식: API 키 발급 필요
 */

const kisApi = require('./kisApi');

class ShortSellingApi {
  constructor() {
    // TODO: KRX API 키 설정 (환경변수)
    this.krxApiKey = process.env.KRX_API_KEY || null;
    this.krxApiEnabled = false; // KRX API 활성화 여부
  }

  /**
   * 공매도 데이터 조회 (통합 메서드)
   * @param {string} stockCode - 종목 코드
   * @param {number} days - 분석 기간 (기본 20일)
   * @returns {Promise<Object>} 공매도 분석 결과
   */
  async getShortSellingData(stockCode, days = 20) {
    if (this.krxApiEnabled && this.krxApiKey) {
      // Phase 2: KRX 실제 데이터 (인증키 있을 때)
      return await this.getKrxShortSellingData(stockCode, days);
    } else {
      // Phase 1: 차트 기반 추정 (현재 사용)
      return await this.estimateShortSellingFromChart(stockCode, days);
    }
  }

  /**
   * Phase 1: 차트 데이터 기반 공매도 추정
   *
   * 추정 로직:
   * 1. 거래량 급증 + 하락 = 공매도 증가 추정
   * 2. 거래량 급증 + 상승 = 숏 커버링 추정
   * 3. 하락 추세 지속 = 공매도 비중 높음 추정
   *
   * @param {string} stockCode - 종목 코드
   * @param {number} days - 분석 기간
   * @returns {Promise<Object>} 추정 공매도 데이터
   */
  async estimateShortSellingFromChart(stockCode, days = 20) {
    try {
      const chartData = await kisApi.getDailyChart(stockCode, days);

      if (!chartData || chartData.length === 0) {
        return null;
      }

      // 최근 5일 데이터 (chartData는 내림차순, 0=최신)
      const recentData = chartData.slice(0, 5);
      const latestData = chartData[0]; // 최신 데이터

      // 평균 거래량 계산
      const avgVolume = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;

      // 평균 가격 변동률 계산
      const avgPriceChange = recentData.reduce((sum, d, i) => {
        if (i === 0) return sum;
        return sum + ((d.close - recentData[i - 1].close) / recentData[i - 1].close * 100);
      }, 0) / (recentData.length - 1);

      // 최근 하락 일수 계산
      let consecutiveDownDays = 0;
      for (let i = 0; i < Math.min(10, chartData.length - 1); i++) {
        if (chartData[i].close < chartData[i + 1].close) {
          consecutiveDownDays++;
        } else {
          break;
        }
      }

      // 최근 상승 일수 계산
      let consecutiveUpDays = 0;
      for (let i = 0; i < Math.min(10, chartData.length - 1); i++) {
        if (chartData[i].close > chartData[i + 1].close) {
          consecutiveUpDays++;
        } else {
          break;
        }
      }

      // 1. 공매도 비중 추정 (0-30% 범위)
      let estimatedShortRatio = 5; // 기본 5%

      // 하락장일수록 공매도 비중 높음
      if (avgPriceChange < -3) {
        estimatedShortRatio += Math.abs(avgPriceChange) * 0.8; // -5% 하락 = +4%
      } else if (avgPriceChange < -1) {
        estimatedShortRatio += Math.abs(avgPriceChange) * 0.5;
      }

      // 연속 하락일수로 추가
      estimatedShortRatio += consecutiveDownDays * 0.5;

      // 거래량 증가 + 하락 = 공매도 증가
      const volumeRatio = latestData.volume / avgVolume;
      if (volumeRatio > 1.5 && avgPriceChange < 0) {
        estimatedShortRatio += (volumeRatio - 1) * 2;
      }

      // 범위 제한 (0-30%)
      estimatedShortRatio = Math.min(Math.max(estimatedShortRatio, 0), 30);

      // 2. 공매도 잔고 변화 추정 (%)
      // 하락 중 = 잔고 증가, 상승 중 = 잔고 감소
      let shortVolumeChange = 0;
      if (avgPriceChange < -1) {
        shortVolumeChange = Math.abs(avgPriceChange) * 5; // 하락 시 잔고 증가
      } else if (avgPriceChange > 1) {
        shortVolumeChange = -avgPriceChange * 8; // 상승 시 잔고 감소 (커버링)
      }

      // 3. 숏 커버링 신호 판단
      // 조건: 공매도 비중 높음(10%+) + 가격 상승(1%+) + 거래량 급증(1.3배+)
      const isShortCovering =
        estimatedShortRatio >= 10 &&
        avgPriceChange > 1 &&
        volumeRatio > 1.3;

      // 4. 숏 커버링 강도 (weak/moderate/strong)
      let coveringStrength = 'none';
      if (isShortCovering) {
        if (volumeRatio > 2.0 && avgPriceChange > 3) {
          coveringStrength = 'strong'; // 강력한 숏 커버링
        } else if (volumeRatio > 1.5 && avgPriceChange > 2) {
          coveringStrength = 'moderate'; // 중간 숏 커버링
        } else {
          coveringStrength = 'weak'; // 약한 숏 커버링
        }
      }

      // 5. 추세 판단
      let shortTrend = 'stable';
      if (consecutiveDownDays >= 3) {
        shortTrend = 'increasing'; // 공매도 증가 추세
      } else if (consecutiveUpDays >= 3) {
        shortTrend = 'decreasing'; // 공매도 감소 추세 (커버링)
      }

      return {
        stockCode,
        estimatedDate: latestData.date,

        // 공매도 지표
        shortRatio: parseFloat(estimatedShortRatio.toFixed(2)), // 공매도 비중 (%)
        shortVolumeChange: parseFloat(shortVolumeChange.toFixed(2)), // 잔고 변화 (%)
        shortTrend, // 추세: increasing/decreasing/stable

        // 숏 커버링 신호
        isShortCovering, // 숏 커버링 발생 여부
        coveringStrength, // 커버링 강도: none/weak/moderate/strong

        // 기반 데이터
        volumeRatio: parseFloat(volumeRatio.toFixed(2)),
        avgPriceChange: parseFloat(avgPriceChange.toFixed(2)),
        consecutiveDownDays,
        consecutiveUpDays,

        // 메타 정보
        dataSource: 'estimated', // 추정치
        needsKrxApi: true, // KRX API 연동 권장
        confidence: this.calculateConfidence(volumeRatio, Math.abs(avgPriceChange), consecutiveDownDays + consecutiveUpDays)
      };

    } catch (error) {
      console.error(`공매도 데이터 조회 실패 [${stockCode}]:`, error.message);
      return null;
    }
  }

  /**
   * 추정치 신뢰도 계산 (0-100%)
   * - 거래량 급등 + 명확한 가격 추세 = 높은 신뢰도
   * - 거래량 평범 + 횡보 = 낮은 신뢰도
   */
  calculateConfidence(volumeRatio, priceChangeAbs, trendDays) {
    let confidence = 40; // 기본 40%

    // 거래량 비율이 클수록 신뢰도 상승
    if (volumeRatio > 2.0) confidence += 25;
    else if (volumeRatio > 1.5) confidence += 15;
    else if (volumeRatio > 1.2) confidence += 5;

    // 가격 변동이 클수록 신뢰도 상승
    if (priceChangeAbs > 5) confidence += 20;
    else if (priceChangeAbs > 3) confidence += 10;
    else if (priceChangeAbs > 1) confidence += 5;

    // 추세가 명확할수록 신뢰도 상승
    if (trendDays >= 5) confidence += 15;
    else if (trendDays >= 3) confidence += 10;
    else if (trendDays >= 2) confidence += 5;

    return Math.min(confidence, 100);
  }

  /**
   * Phase 2: KRX 실제 API 연동 (TODO)
   *
   * KRX API 엔드포인트 예시:
   * - URL: https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd
   * - Method: POST
   * - Body: {
   *     bld: "dbms/MDC/STAT/standard/MDCSTAT05301",
   *     strtDd: "20250101",
   *     endDd: "20250131",
   *     isuCd: "KR7005930003" // 종목 코드 (12자리)
   *   }
   *
   * 응답 데이터:
   * - 공매도 거래량 (shortSellQty)
   * - 공매도 거래대금 (shortSellAmt)
   * - 전체 거래량 대비 공매도 비중 (shortSellRatio)
   * - 공매도 잔고 (shortBalance)
   *
   * @param {string} stockCode - 종목 코드 (6자리)
   * @param {number} days - 조회 기간
   * @returns {Promise<Object>} KRX 공매도 데이터
   */
  async getKrxShortSellingData(stockCode, days = 20) {
    // TODO: KRX API 연동 구현
    // 1. 종목코드 6자리 → 12자리 표준코드 변환
    // 2. KRX API 호출 (인증키 필요)
    // 3. 응답 데이터 파싱 및 정규화
    // 4. 숏 커버링 신호 계산

    throw new Error('KRX API 연동이 아직 구현되지 않았습니다. 환경변수 KRX_API_KEY를 설정하고 구현을 완료하세요.');
  }

  /**
   * 숏 커버링 점수 계산 (스크리닝 점수에 반영)
   *
   * 점수 체계 (0-20점):
   * - 공매도 비중 10% 이상: +5점
   * - 공매도 비중 15% 이상: +10점 (누적)
   * - 공매도 비중 20% 이상: +15점 (누적)
   * - 숏 커버링 신호 발생: +5~15점 (강도에 따라)
   *
   * @param {Object} shortData - 공매도 데이터
   * @param {Array} chartData - 차트 데이터 (선택)
   * @returns {number} 숏 커버링 점수 (0-20점)
   */
  calculateCoveringScore(shortData, chartData = null) {
    if (!shortData) return 0;

    let score = 0;

    // 1. 공매도 비중 점수 (0-15점)
    const shortRatio = shortData.shortRatio || 0;

    if (shortRatio >= 20) {
      score += 15; // 매우 높은 공매도 비중
    } else if (shortRatio >= 15) {
      score += 10; // 높은 공매도 비중
    } else if (shortRatio >= 10) {
      score += 5; // 중간 공매도 비중
    }

    // 2. 숏 커버링 신호 점수 (0-15점)
    if (shortData.isShortCovering) {
      const strength = shortData.coveringStrength || 'none';

      if (strength === 'strong') {
        score += 15; // 강력한 커버링 = 급등 가능성 매우 높음
      } else if (strength === 'moderate') {
        score += 10; // 중간 커버링
      } else if (strength === 'weak') {
        score += 5; // 약한 커버링
      }
    }

    // 3. 추세 가산점 (0-5점)
    if (shortData.shortTrend === 'decreasing' && shortData.shortRatio >= 10) {
      score += 5; // 높은 공매도 비중에서 감소 추세 = 커버링 진행 중
    }

    // 최종 점수 (0-20점)
    return Math.min(Math.max(score, 0), 20);
  }

  /**
   * 공매도 분석 결과 요약 메시지 생성
   */
  generateSummaryMessage(shortData) {
    if (!shortData) return '공매도 데이터 없음';

    const ratio = shortData.shortRatio;
    const covering = shortData.isShortCovering;
    const strength = shortData.coveringStrength;

    if (covering) {
      if (strength === 'strong') {
        return `🚀 강력한 숏 커버링 진행 중 (공매도 ${ratio}%)`;
      } else if (strength === 'moderate') {
        return `📈 숏 커버링 신호 (공매도 ${ratio}%)`;
      } else {
        return `📊 약한 숏 커버링 (공매도 ${ratio}%)`;
      }
    } else if (ratio >= 20) {
      return `⚠️ 공매도 비중 매우 높음 (${ratio}%) - 반등 여력`;
    } else if (ratio >= 15) {
      return `⚠️ 공매도 비중 높음 (${ratio}%)`;
    } else if (ratio >= 10) {
      return `📊 공매도 비중 중간 (${ratio}%)`;
    } else {
      return `✅ 공매도 비중 낮음 (${ratio}%)`;
    }
  }
}

module.exports = new ShortSellingApi();
