const axios = require('axios');
require('dotenv').config();

/**
 * Token Bucket Rate Limiter
 * KIS API 20 calls/sec 제한 준수 (안전 마진 10% → 18 calls/sec)
 */
class RateLimiter {
  constructor(maxPerSecond = 18) {
    this.maxPerSecond = maxPerSecond;
    this.tokens = maxPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;

    // Token 보충 (시간 경과에 비례)
    this.tokens = Math.min(
      this.maxPerSecond,
      this.tokens + elapsed * this.maxPerSecond
    );
    this.lastRefill = now;

    // Token 부족 시 대기
    if (this.tokens < 1) {
      const waitTime = ((1 - this.tokens) / this.maxPerSecond) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

/**
 * 한국투자증권 OpenAPI 클라이언트
 * 문서: https://apiportal.koreainvestment.com/
 */
class KISApi {
  constructor() {
    this.baseUrl = 'https://openapi.koreainvestment.com:9443';
    this.appKey = process.env.KIS_APP_KEY;
    this.appSecret = process.env.KIS_APP_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.cachedAppKey = null; // 토큰 발급 시 사용한 APP_KEY 저장
    this.rateLimiter = new RateLimiter(18); // 전역 Rate Limiter
  }

  /**
   * Access Token 발급
   */
  async getAccessToken() {
    // 환경변수가 변경되었으면 토큰 무효화 (Vercel 환경변수 업데이트 대응)
    if (this.cachedAppKey && this.cachedAppKey !== this.appKey) {
      console.log('⚠️  환경변수 변경 감지 - Access Token 무효화');
      this.accessToken = null;
      this.tokenExpiry = null;
      this.cachedAppKey = null;
    }

    // 토큰이 유효하면 재사용
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/oauth2/tokenP`, {
        grant_type: 'client_credentials',
        appkey: this.appKey,
        appsecret: this.appSecret
      });

      this.accessToken = response.data.access_token;
      // 토큰 유효기간 (1시간) - Vercel 환경에서 빠른 갱신을 위해 짧게 설정
      this.tokenExpiry = Date.now() + (60 * 60 * 1000);
      this.cachedAppKey = this.appKey; // 현재 APP_KEY 저장

      console.log('✅ Access Token 발급 성공 (App Key:', this.appKey.substring(0, 10) + '...)');
      return this.accessToken;
    } catch (error) {
      console.error('❌ Access Token 발급 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 현재가 시세 조회 (실시간)
   * @param {string} stockCode - 종목코드 (예: '005930' 삼성전자)
   */
  async getCurrentPrice(stockCode) {
    await this.rateLimiter.acquire(); // Rate limiting 적용

    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHKST01010100'
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',  // 시장구분 (J: 주식)
          FID_INPUT_ISCD: stockCode      // 종목코드
        }
      });

      // 응답 상태 코드 체크
      if (response.data.rt_cd !== '0') {
        console.warn(`⚠️ KIS API Error [${stockCode}]:`, {
          rt_cd: response.data.rt_cd,
          msg_cd: response.data.msg_cd,
          msg1: response.data.msg1
        });
        // 에러를 throw하지 않고 null 반환 (screening에서 스킵 가능)
        return null;
      }

      const output = response.data.output;

      // output 검증
      if (!output || !output.stck_prpr) {
        console.warn(`⚠️ Invalid output [${stockCode}]:`, {
          hasOutput: !!output,
          stck_prpr: output?.stck_prpr,
          outputKeys: output ? Object.keys(output).slice(0, 10) : []
        });
        // 에러를 throw하지 않고 null 반환
        return null;
      }

      // 캐싱된 종목명 우선 사용, 없으면 API 응답, 그것도 없으면 종목코드 표시
      const cachedName = this.getCachedStockName(stockCode);
      const stockName = cachedName || output.prdt_name || `[${stockCode}]`;

      const price = parseInt(output.stck_prpr);
      const change = parseFloat(output.prdy_ctrt);

      // 가격이 0이면 경고
      if (price === 0 || isNaN(price)) {
        console.warn(`⚠️ Price is 0 or NaN [${stockCode}]:`, {
          stck_prpr: output.stck_prpr,
          parsed: price
        });
      }

      return {
        stockCode: stockCode,
        stockName: stockName,
        currentPrice: price,                                 // 현재가
        price: price,                                        // 호환성을 위해 추가
        changePrice: parseInt(output.prdy_vrss || 0),       // 전일대비
        changeRate: change,                                  // 등락률
        priceChange: change,                                 // 호환성을 위해 추가
        volume: parseInt(output.acml_vol || 0),             // 누적거래량
        volumeRate: parseFloat(output.vol_tnrt || 0),       // 거래량회전율
        tradingValue: parseInt(output.acml_tr_pbmn || 0),   // 누적거래대금
        marketCap: parseInt(output.hts_avls || 0) * 100000000,  // 시가총액
        high: parseInt(output.stck_hgpr || 0),              // 고가
        low: parseInt(output.stck_lwpr || 0),               // 저가
        open: parseInt(output.stck_oprc || 0),              // 시가
        prevClose: parseInt(output.stck_sdpr || 0),         // 전일종가
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.warn(`⚠️ 현재가 조회 실패 [${stockCode}]:`, error.message);
      // 에러를 throw하지 않고 null 반환 (screening에서 해당 종목 스킵 가능)
      return null;
    }
  }

  /**
   * 일봉 데이터 조회 (거래량 분석용)
   * @param {string} stockCode - 종목코드
   * @param {number} days - 조회일수 (기본 30일)
   */
  async getDailyChart(stockCode, days = 30) {
    await this.rateLimiter.acquire(); // Rate limiting 적용

    try {
      const token = await this.getAccessToken();

      // 종료일자 (오늘)
      const endDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-price`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHKST01010400'
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: stockCode,
          FID_PERIOD_DIV_CODE: 'D',      // D: 일봉
          FID_ORG_ADJ_PRC: '0',          // 0: 수정주가 미반영
          FID_INPUT_DATE_1: endDate      // 조회 종료일
        }
      });

      if (response.data.rt_cd === '0') {
        const chartData = response.data.output.slice(0, days).map(item => ({
          date: item.stck_bsop_date,     // 날짜
          open: parseInt(item.stck_oprc),
          high: parseInt(item.stck_hgpr),
          low: parseInt(item.stck_lwpr),
          close: parseInt(item.stck_clpr),
          volume: parseInt(item.acml_vol),
          tradingValue: parseInt(item.acml_tr_pbmn)
        })); // 최신 날짜부터 정렬 (API 기본 순서)

        return chartData;
      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }
    } catch (error) {
      console.error(`❌ 일봉 데이터 조회 실패 [${stockCode}]:`, error.message);
      throw error;
    }
  }

  /**
   * 분봉 데이터 조회 (실시간 거래량 분석용)
   * @param {string} stockCode - 종목코드
   * @param {string} timeUnit - 시간단위 ('1', '3', '5', '10', '30', '60')
   */
  async getMinuteChart(stockCode, timeUnit = '1') {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHKST01010600'
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_INPUT_ISCD: stockCode,
          FID_INPUT_HOUR_1: '',          // 조회시작시각 (공백시 전체)
          FID_PW_DATA_INCU_YN: 'Y'       // Y: 과거데이터 포함
        }
      });

      if (response.data.rt_cd === '0') {
        const chartData = response.data.output2.map(item => ({
          time: item.stck_cntg_hour,     // 시각 (HHMMSS)
          price: parseInt(item.stck_prpr),
          volume: parseInt(item.cntg_vol),
          changeRate: parseFloat(item.prdy_ctrt)
        }));

        return chartData;
      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }
    } catch (error) {
      console.error(`❌ 분봉 데이터 조회 실패 [${stockCode}]:`, error.message);
      throw error;
    }
  }

  /**
   * 거래량 급증 순위 조회 (거래증가율 기준)
   * @param {string} market - 시장구분 ('KOSPI', 'KOSDAQ')
   * @param {number} limit - 조회 개수 (최대 30)
   */
  async getVolumeSurgeRank(market = 'KOSPI', limit = 30) {
    try {
      const token = await this.getAccessToken();
      const marketCode = market === 'KOSPI' ? '0' : '1';

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/volume-rank`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHPST01710000'  // 거래량 순위 (동일 TR_ID, 파라미터로 구분)
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20171',  // 거래량 순위 화면
          FID_INPUT_ISCD: '0000',
          FID_DIV_CLS_CODE: marketCode,
          FID_BLNG_CLS_CODE: '1',  // 1: 거래증가율 (거래량 등락률)
          FID_TRGT_CLS_CODE: '111111111',
          FID_TRGT_EXLS_CLS_CODE: '0000000000',  // 10자리
          FID_INPUT_PRICE_1: '',
          FID_INPUT_PRICE_2: '',
          FID_VOL_CNT: '',
          FID_INPUT_DATE_1: ''
        }
      });

      if (response.data.rt_cd === '0') {
        // ETF/ETN 제외 필터링 적용
        const filtered = response.data.output
          .filter(item => !this.isNonStockItem(item.hts_kor_isnm))
          .slice(0, limit)
          .map(item => ({
            code: item.mksc_shrn_iscd,
            name: item.hts_kor_isnm,
            currentPrice: parseInt(item.stck_prpr),
            volume: parseInt(item.acml_vol),
            volumeRate: parseFloat(item.prdy_vrss_vol_rate)  // 전일대비 거래량 증가율
          }));
        return filtered;
      } else {
        const errorDetail = {
          rt_cd: response.data.rt_cd,
          msg_cd: response.data.msg_cd,
          msg1: response.data.msg1,
          output_cnt: response.data.output?.length || 0
        };
        throw new Error(`API 오류: ${JSON.stringify(errorDetail)}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      console.error(`❌ 거래량 급증 순위 조회 실패 [${market}]:`, errorMsg);
      console.error(`Full error:`, JSON.stringify({
        status: error.response?.status,
        statusText: error.response?.statusText,
        headers: error.response?.headers,
        data: error.response?.data
      }));
      // 에러 정보를 저장하여 디버그에 활용
      if (!this._apiErrors) this._apiErrors = [];
      this._apiErrors.push({
        method: 'getVolumeSurgeRank',
        market,
        status: error.response?.status,
        statusText: error.response?.statusText,
        error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg
      });
      return [];
    }
  }

  /**
   * 거래대금 순위 조회
   * @param {string} market - 시장구분 ('KOSPI', 'KOSDAQ')
   * @param {number} limit - 조회 개수 (최대 30)
   */
  async getTradingValueRank(market = 'KOSPI', limit = 30) {
    try {
      const token = await this.getAccessToken();
      const marketCode = market === 'KOSPI' ? '0' : '1';

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/volume-rank`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHPST01710000'  // 거래량 순위 (동일 TR_ID)
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20171',  // 거래량 순위 화면
          FID_INPUT_ISCD: '0000',
          FID_DIV_CLS_CODE: marketCode,
          FID_BLNG_CLS_CODE: '3',  // 3: 거래금액순
          FID_TRGT_CLS_CODE: '111111111',
          FID_TRGT_EXLS_CLS_CODE: '0000000000',  // 10자리
          FID_INPUT_PRICE_1: '',
          FID_INPUT_PRICE_2: '',
          FID_VOL_CNT: '',
          FID_INPUT_DATE_1: ''
        }
      });

      if (response.data.rt_cd === '0') {
        return response.data.output.slice(0, limit).map(item => ({
          code: item.mksc_shrn_iscd,
          name: item.hts_kor_isnm,
          currentPrice: parseInt(item.stck_prpr),
          tradingValue: parseInt(item.acml_tr_pbmn)
        }));
      } else {
        const errorDetail = {
          rt_cd: response.data.rt_cd,
          msg_cd: response.data.msg_cd,
          msg1: response.data.msg1,
          output_cnt: response.data.output?.length || 0
        };
        throw new Error(`API 오류: ${JSON.stringify(errorDetail)}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      console.error(`❌ 거래대금 순위 조회 실패 [${market}]:`, errorMsg);
      console.error(`Full error:`, JSON.stringify({
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      }));
      // 에러 정보를 저장하여 디버그에 활용
      if (!this._apiErrors) this._apiErrors = [];
      this._apiErrors.push({
        method: 'getTradingValueRank',
        market,
        status: error.response?.status,
        statusText: error.response?.statusText,
        error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg
      });
      return [];
    }
  }

  /**
   * 등락률 상승 순위 조회 (가격 급등 = 거래량 급등 가능성)
   * @param {string} market - 시장구분 ('KOSPI', 'KOSDAQ')
   * @param {number} limit - 조회 개수 (최대 30)
   */
  async getPriceChangeRank(market = 'KOSPI', limit = 30) {
    try {
      const token = await this.getAccessToken();

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/ranking/fluctuation`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHPST01700000'  // 등락률 순위
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',  // J:KRX
          FID_COND_SCR_DIV_CODE: '20170',  // 등락률 화면
          FID_INPUT_ISCD: '0000',  // 전체 종목
          FID_RANK_SORT_CLS_CODE: '0',  // 0:상승률순
          FID_INPUT_CNT_1: String(limit),  // 조회 개수
          FID_PRC_CLS_CODE: '0',  // 전체 가격
          FID_INPUT_PRICE_1: '0',  // 최저가
          FID_INPUT_PRICE_2: '1000000',  // 최고가
          FID_VOL_CNT: '0',  // 최소거래량
          FID_TRGT_CLS_CODE: '0',  // 대상: 전체
          FID_TRGT_EXLS_CLS_CODE: '0000000000',  // 10자리: 제외 없음
          FID_DIV_CLS_CODE: '0',  // 시장: 전체
          FID_RSFL_RATE1: '0',  // 하락률 하한
          FID_RSFL_RATE2: '1000'  // 상승률 상한
        }
      });

      if (response.data.rt_cd === '0') {
        return response.data.output.slice(0, limit).map(item => ({
          code: item.mksc_shrn_iscd,
          name: item.hts_kor_isnm,
          currentPrice: parseInt(item.stck_prpr),
          changeRate: parseFloat(item.prdy_ctrt),  // 등락률
          volume: parseInt(item.acml_vol)
        }));
      } else {
        const errorDetail = {
          rt_cd: response.data.rt_cd,
          msg_cd: response.data.msg_cd,
          msg1: response.data.msg1,
          output_cnt: response.data.output?.length || 0
        };
        throw new Error(`API 오류: ${JSON.stringify(errorDetail)}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      console.error(`❌ 등락률 순위 조회 실패 [${market}]:`, errorMsg);
      if (!this._apiErrors) this._apiErrors = [];
      this._apiErrors.push({
        method: 'getPriceChangeRank',
        market,
        status: error.response?.status,
        statusText: error.response?.statusText,
        error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg
      });
      return [];
    }
  }

  /**
   * 거래량 순위 조회
   * @param {string} market - 시장구분 ('KOSPI', 'KOSDAQ')
   * @param {number} limit - 조회 개수 (최대 30)
   */
  async getVolumeRank(market = 'KOSPI', limit = 30) {
    try {
      const token = await this.getAccessToken();
      const marketCode = market === 'KOSPI' ? '0' : '1';

      const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/volume-rank`, {
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`,
          'appkey': this.appKey,
          'appsecret': this.appSecret,
          'tr_id': 'FHPST01710000'  // 거래량 순위
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20171',
          FID_INPUT_ISCD: '0000',
          FID_DIV_CLS_CODE: marketCode,
          FID_BLNG_CLS_CODE: '0',
          FID_TRGT_CLS_CODE: '111111111',
          FID_TRGT_EXLS_CLS_CODE: '000000',
          FID_INPUT_PRICE_1: '',
          FID_INPUT_PRICE_2: '',
          FID_VOL_CNT: '',
          FID_INPUT_DATE_1: ''
        }
      });

      if (response.data.rt_cd === '0') {
        return response.data.output.slice(0, limit).map(item => ({
          code: item.mksc_shrn_iscd,
          name: item.hts_kor_isnm,
          currentPrice: parseInt(item.stck_prpr),
          volume: parseInt(item.acml_vol)
        }));
      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      console.error(`❌ 거래량 순위 조회 실패 [${market}]:`, errorMsg);
      // 에러 정보를 저장하여 디버그에 활용
      if (!this._apiErrors) this._apiErrors = [];
      this._apiErrors.push({
        method: 'getVolumeRank',
        market,
        error: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg
      });
      return [];
    }
  }

  /**
   * ETF/ETN/리츠 등 제외 필터 (개별 종목만)
   * @param {string} name - 종목명
   * @returns {boolean} - true면 제외 대상
   */
  isNonStockItem(name) {
    if (!name) return true; // 종목명 없으면 제외

    const excludeKeywords = [
      // ETF 브랜드
      'ETF', 'ETN', 'KODEX', 'TIGER', 'KBSTAR', 'ARIRANG', 'KOSEF',
      'HANARO', 'TREX', 'KINDEX', 'TIMEFOLIO', 'SOL', 'ACE', 'KIWOOM',
      'SAMSUNG', 'MIRAE', 'KB', 'SHINHAN', 'NH', 'WOORI',
      // 특수 펀드/파생상품
      'plus', 'PLUS', 'Plus', 'unicorn', 'UNICORN', 'Unicorn',
      '국채', '선물', '통안증권', '미국채', '하이일드', '인컴',
      'POST', 'Post', 'IPO', 'Active', 'ACTIVE', '액티브',
      '밸류업', '고배당', '커버드콜', 'TR',
      // 리츠/스팩
      '리츠', 'REIT', '스팩', 'SPAC',
      '1호', '2호', '3호', '4호', '5호', '6호', '7호', '8호', '9호',
      // 레버리지/인버스
      '인버스', 'Inverse', '레버리지', 'Leverage',
      // 해외지수
      'WTI', 'S&P', 'MSCI', 'Russell', 'Nasdaq', 'NYSE', 'DOW',
      // 기타
      '합병', '전환사채', 'CB', 'BW'
    ];

    return excludeKeywords.some(keyword => name.includes(keyword));
  }

  /**
   * 전체 종목 리스트 조회 (동적 API 기반)
   * [KOSPI + KOSDAQ 각각]
   * 거래량 급증 30 + 거래량 순위 20 + 거래대금 10 = 60개 * 2시장 = 120개 (중복 제거 후 ~100개)
   * @returns {Object} - { codes: string[], nameMap: Map<code, name>, badgeMap: Map<code, badges> }
   */
  async getAllStockList(market = 'ALL') {
    console.log('📊 동적 종목 리스트 생성 시작 (100개 목표, ETF/ETN 제외)...');

    const stockMap = new Map(); // code -> name 매핑 (중복 제거 + 이름 캐싱)
    const badgeMap = new Map(); // code -> { volumeSurge, tradingValue, volume } 뱃지 정보
    const markets = market === 'ALL' ? ['KOSPI', 'KOSDAQ'] : [market];
    const apiCallResults = []; // 각 API 호출 결과 추적
    let filteredCount = 0; // ETF/ETN 필터링 카운트

    // 에러 수집을 위해 초기화
    this._apiErrors = [];

    try {
      // 전략: 4가지 순위 API 조합 (각 30개 제한)
      // KOSPI/KOSDAQ 각각:
      //   - 등락률 상승 30개
      //   - 거래량 증가율 30개 (거래량 등락률)
      //   - 거래량 순위 30개
      //   - 거래대금 순위 30개
      // = 120개/시장 * 2시장 = 240개 (중복 제거 후 ~100개 목표)
      for (const mkt of markets) {
        console.log(`\n📊 ${mkt} 시장 데이터 수집 중...`);

        // 1. 등락률 상승 순위 (30개) - 가격 급등
        const priceChange = await this.getPriceChangeRank(mkt, 30);
        const filteredPriceChange = priceChange.filter(item => {
          if (this.isNonStockItem(item.name)) {
            filteredCount++;
            return false;
          }
          return true;
        });
        apiCallResults.push({ market: mkt, api: 'priceChange', count: filteredPriceChange.length, target: 30, filtered: priceChange.length - filteredPriceChange.length });
        console.log(`  - 등락률 상승: ${filteredPriceChange.length}/30 (${priceChange.length - filteredPriceChange.length}개 필터링)`);

        filteredPriceChange.forEach(item => {
          if (!stockMap.has(item.code)) {
            stockMap.set(item.code, item.name);
            badgeMap.set(item.code, { priceChange: true, volumeSurge: false, volume: false, tradingValue: false });
          } else {
            badgeMap.get(item.code).priceChange = true;
          }
        });

        // 2. 거래량 증가율 순위 (30개) - 거래량 급증
        const volumeSurge = await this.getVolumeSurgeRank(mkt, 30);
        const filteredVolumeSurge = volumeSurge.filter(item => {
          if (this.isNonStockItem(item.name)) {
            filteredCount++;
            return false;
          }
          return true;
        });
        apiCallResults.push({ market: mkt, api: 'volumeSurge', count: filteredVolumeSurge.length, target: 30, filtered: volumeSurge.length - filteredVolumeSurge.length });
        console.log(`  - 거래량 증가율: ${filteredVolumeSurge.length}/30 (${volumeSurge.length - filteredVolumeSurge.length}개 필터링)`);

        filteredVolumeSurge.forEach(item => {
          if (!stockMap.has(item.code)) {
            stockMap.set(item.code, item.name);
            badgeMap.set(item.code, { priceChange: false, volumeSurge: true, volume: false, tradingValue: false });
          } else {
            badgeMap.get(item.code).volumeSurge = true;
          }
        });

        // 3. 거래량 순위 (30개) - 절대 거래량
        const volume = await this.getVolumeRank(mkt, 30);
        const filteredVolume = volume.filter(item => {
          if (this.isNonStockItem(item.name)) {
            filteredCount++;
            return false;
          }
          return true;
        });
        apiCallResults.push({ market: mkt, api: 'volume', count: filteredVolume.length, target: 30, filtered: volume.length - filteredVolume.length });
        console.log(`  - 거래량 순위: ${filteredVolume.length}/30 (${volume.length - filteredVolume.length}개 필터링)`);

        filteredVolume.forEach(item => {
          if (!stockMap.has(item.code)) {
            stockMap.set(item.code, item.name);
            badgeMap.set(item.code, { priceChange: false, volumeSurge: false, volume: true, tradingValue: false });
          } else {
            badgeMap.get(item.code).volume = true;
          }
        });

        // 4. 거래대금 순위 (30개) - 대형주 활동성
        const tradingValue = await this.getTradingValueRank(mkt, 30);
        const filteredTradingValue = tradingValue.filter(item => {
          if (this.isNonStockItem(item.name)) {
            filteredCount++;
            return false;
          }
          return true;
        });
        apiCallResults.push({ market: mkt, api: 'tradingValue', count: filteredTradingValue.length, target: 30, filtered: tradingValue.length - filteredTradingValue.length });
        console.log(`  - 거래대금 순위: ${filteredTradingValue.length}/30 (${tradingValue.length - filteredTradingValue.length}개 필터링)`);

        filteredTradingValue.forEach(item => {
          if (!stockMap.has(item.code)) {
            stockMap.set(item.code, item.name);
            badgeMap.set(item.code, { priceChange: false, volumeSurge: false, volume: false, tradingValue: true });
          } else {
            badgeMap.get(item.code).tradingValue = true;
          }
        });
      }

      const codes = Array.from(stockMap.keys());

      // API 호출은 성공했지만 결과가 없는 경우 fallback 사용
      if (codes.length === 0) {
        throw new Error('API 호출 성공했으나 종목 리스트가 비어있음 - fallback 사용');
      }

      console.log(`\n✅ 동적 API 종목 확보: ${codes.length}개`);
      console.log(`  - 시장: ${market}`);
      console.log(`  - 처리한 시장 수: ${markets.length}`);
      console.log(`  - ETF/ETN 제외: ${filteredCount}개`);
      console.log(`  - 종목 코드 샘플: ${codes.slice(0, 5).join(', ')}`);

      // 종목명 및 뱃지 캐싱
      this.stockNameCache = stockMap;
      this.rankBadgeCache = badgeMap;

      // 디버그 정보 저장 (API 응답에 포함하기 위해)
      this._lastPoolDebug = {
        totalCodes: codes.length,
        markets: markets,
        requestedMarket: market,
        sampleCodes: codes.slice(0, 10),
        apiCallResults: apiCallResults,
        apiErrors: this._apiErrors.length > 0 ? this._apiErrors : [],
        stockMapSize: stockMap.size,
        filteredOutCount: filteredCount // ETF/ETN 제외 개수
      };

      return { codes, nameMap: stockMap, badgeMap };

    } catch (error) {
      console.error('❌ 동적 종목 리스트 생성 실패:', error.message);
      console.log('⚠️  하드코딩된 기본 리스트 사용 (105개)');

      // 실패 시 기본 리스트 반환 (100개 목표)
      console.log('📋 Fallback 리스트 로드 중...');
      const kospiStocks = [
        // 대형주 (30개)
        '005930', '000660', '051910', '006400', '005380', '000270', '035720', '035420',
        '068270', '207940', '105560', '055550', '003670', '096770', '028260', '012330',
        '017670', '066570', '034730', '018260', '003550', '009150', '033780', '015760',
        '011200', '010950', '086790', '032830', '030200', '090430', '000100', '316140',
        // 중형주 (20개)
        '009540', '011170', '010130', '047050', '000720', '005490', '003490', '004020',
        '011780', '000810', '016360', '139480', '018880', '006800', '036570', '047810',
        '001450', '010140', '012450', '014680',
        // 소형주 거래량 상위 (10개)
        '042700', '009420', '001040', '004370', '005850', '006360', '071050', '011070',
        '000150', '002790'
      ];
      console.log(`  KOSPI: ${kospiStocks.length}개`);

      const kosdaqStocks = [
        // 대형주 (20개)
        '247540', '086520', '263750', '091990', '403870', '357780', '196170', '112040',
        '293490', '095340', '365340', '058470', '214150', '137400', '067160', '348210',
        '039030', '054620', '042670', '096530',
        // 중형주 (15개)
        '234080', '357780', '214150', '215000', '222800', '053800', '226400', '145020',
        '083930', '038540', '298690', '035600', '317830', '265520', '950140',
        // 소형주 거래량 상위 (10개)
        '298540', '900140', '237820', '066970', '041960', '060280', '036830', '053610',
        '048410', '220100'
      ];
      console.log(`  KOSDAQ: ${kosdaqStocks.length}개`);

      let codes;
      if (market === 'ALL') {
        codes = [...kospiStocks, ...kosdaqStocks];
      } else if (market === 'KOSPI') {
        codes = kospiStocks;
      } else if (market === 'KOSDAQ') {
        codes = kosdaqStocks;
      }

      console.log(`  최종 Fallback 리스트: ${codes.length}개 (시장: ${market})`);

      // 빈 nameMap 및 badgeMap 반환
      this.stockNameCache = new Map();
      this.rankBadgeCache = new Map();

      // 디버그 정보 저장
      this._lastPoolDebug = {
        totalCodes: codes.length,
        markets: markets,
        requestedMarket: market,
        sampleCodes: codes.slice(0, 10),
        apiCallResults: apiCallResults,
        apiErrors: this._apiErrors.concat([{ note: 'Fallback used due to API failure' }]),
        usingFallback: true
      };

      return { codes, nameMap: new Map(), badgeMap: new Map() };
    }
  }

  /**
   * 캐싱된 종목명 조회
   * @param {string} stockCode - 종목코드
   * @returns {string|null} - 종목명 또는 null
   */
  getCachedStockName(stockCode) {
    return this.stockNameCache ? this.stockNameCache.get(stockCode) : null;
  }

  /**
   * 캐싱된 랭킹 뱃지 조회
   * @param {string} stockCode - 종목코드
   * @returns {Object|null} - { volumeSurge, tradingValue, volume } 또는 null
   */
  getCachedRankBadges(stockCode) {
    return this.rankBadgeCache ? this.rankBadgeCache.get(stockCode) : null;
  }

  /**
   * 투자자별 매매 데이터 조회 (기관/외국인/개인)
   * @param {string} stockCode - 종목코드
   * @param {number} days - 조회일수 (기본 30일, 최대 30일)
   * @returns {Promise<Array>} 일자별 투자자 매매 데이터 배열
   *
   * ⚠️ 주의사항:
   * - 당일 데이터는 장 종료 후 제공됩니다
   * - 외국인 = 외국인투자등록 고유번호가 있는 경우 + 기타 외국인
   * - 응답은 Object Array 형태 (여러 날짜 데이터)
   */
  async getInvestorData(stockCode, days = 30) {
    await this.rateLimiter.acquire();

    try {
      const token = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-investor`,
        {
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${token}`,
            'appkey': this.appKey,
            'appsecret': this.appSecret,
            'tr_id': 'FHKST01010900'
          },
          params: {
            FID_COND_MRKT_DIV_CODE: 'J',  // J: KRX
            FID_INPUT_ISCD: stockCode      // 종목코드
          }
        }
      );

      if (response.data.rt_cd === '0') {
        const output = response.data.output;

        // 배열 응답 처리 (최신 데이터부터 days개 추출)
        const investorData = output.slice(0, days).map(item => ({
          date: item.stck_bsop_date,              // 영업일자
          closePrice: parseInt(item.stck_clpr),   // 종가
          priceChange: parseInt(item.prdy_vrss),  // 전일 대비

          // 개인 투자자
          individual: {
            netBuyQty: parseInt(item.prsn_ntby_qty || 0),        // 순매수 수량
            netBuyValue: parseInt(item.prsn_ntby_tr_pbmn || 0),  // 순매수 거래대금
            buyQty: parseInt(item.prsn_shnu_vol || 0),           // 매수 거래량
            buyValue: parseInt(item.prsn_shnu_tr_pbmn || 0),     // 매수 거래대금
            sellQty: parseInt(item.prsn_seln_vol || 0),          // 매도 거래량
            sellValue: parseInt(item.prsn_seln_tr_pbmn || 0)     // 매도 거래대금
          },

          // 외국인 투자자
          foreign: {
            netBuyQty: parseInt(item.frgn_ntby_qty || 0),
            netBuyValue: parseInt(item.frgn_ntby_tr_pbmn || 0),
            buyQty: parseInt(item.frgn_shnu_vol || 0),
            buyValue: parseInt(item.frgn_shnu_tr_pbmn || 0),
            sellQty: parseInt(item.frgn_seln_vol || 0),
            sellValue: parseInt(item.frgn_seln_tr_pbmn || 0)
          },

          // 기관 투자자
          institution: {
            netBuyQty: parseInt(item.orgn_ntby_qty || 0),
            netBuyValue: parseInt(item.orgn_ntby_tr_pbmn || 0),
            buyQty: parseInt(item.orgn_shnu_vol || 0),
            buyValue: parseInt(item.orgn_shnu_tr_pbmn || 0),
            sellQty: parseInt(item.orgn_seln_vol || 0),
            sellValue: parseInt(item.orgn_seln_tr_pbmn || 0)
          }
        })).reverse(); // 오래된 날짜부터 정렬

        return investorData;

      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }

    } catch (error) {
      console.error(`❌ 투자자 데이터 조회 실패 [${stockCode}]:`, error.message);
      throw error;
    }
  }
}

module.exports = new KISApi();
