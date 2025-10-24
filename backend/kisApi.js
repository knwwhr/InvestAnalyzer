const axios = require('axios');
require('dotenv').config();

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
  }

  /**
   * Access Token 발급
   */
  async getAccessToken() {
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
      // 토큰 유효기간 (24시간 - 여유시간 1시간)
      this.tokenExpiry = Date.now() + (23 * 60 * 60 * 1000);

      console.log('✅ Access Token 발급 성공');
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

      if (response.data.rt_cd === '0') {
        const output = response.data.output;

        // 캐싱된 종목명 우선 사용, 없으면 API 응답, 그것도 없으면 Unknown
        const cachedName = this.getCachedStockName(stockCode);
        const stockName = cachedName || output.prdt_name || 'Unknown';

        return {
          stockCode: stockCode,
          stockName: stockName,
          currentPrice: parseInt(output.stck_prpr),           // 현재가
          changePrice: parseInt(output.prdy_vrss),            // 전일대비
          changeRate: parseFloat(output.prdy_ctrt),           // 등락률
          volume: parseInt(output.acml_vol),                  // 누적거래량
          volumeRate: parseFloat(output.vol_tnrt),            // 거래량회전율
          tradingValue: parseInt(output.acml_tr_pbmn),        // 누적거래대금
          marketCap: parseInt(output.hts_avls) * 100000000,   // 시가총액
          high: parseInt(output.stck_hgpr),                   // 고가
          low: parseInt(output.stck_lwpr),                    // 저가
          open: parseInt(output.stck_oprc),                   // 시가
          prevClose: parseInt(output.stck_sdpr),              // 전일종가
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }
    } catch (error) {
      console.error(`❌ 현재가 조회 실패 [${stockCode}]:`, error.message);
      throw error;
    }
  }

  /**
   * 일봉 데이터 조회 (거래량 분석용)
   * @param {string} stockCode - 종목코드
   * @param {number} days - 조회일수 (기본 30일)
   */
  async getDailyChart(stockCode, days = 30) {
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
        })).reverse(); // 오래된 날짜부터 정렬

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
   * 거래량 급증 순위 조회
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
          'tr_id': 'FHPST01730000'  // 거래량 급증 순위
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20173',
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
          volume: parseInt(item.acml_vol),
          volumeRate: parseFloat(item.prdy_vrss_vol_rate)  // 전일대비 거래량 증가율
        }));
      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }
    } catch (error) {
      console.error(`❌ 거래량 급증 순위 조회 실패 [${market}]:`, error.message);
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
          'tr_id': 'FHPST01720000'  // 거래대금 순위
        },
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20172',
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
          tradingValue: parseInt(item.acml_tr_pbmn)
        }));
      } else {
        throw new Error(`API 오류: ${response.data.msg1}`);
      }
    } catch (error) {
      console.error(`❌ 거래대금 순위 조회 실패 [${market}]:`, error.message);
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
      console.error(`❌ 거래량 순위 조회 실패 [${market}]:`, error.message);
      return [];
    }
  }

  /**
   * 전체 종목 리스트 조회 (동적 API 기반)
   * 거래량 급증 + 거래대금 + 거래량 순위를 조합하여 약 150개 종목 확보
   * @returns {Object} - { codes: string[], nameMap: Map<code, name> }
   */
  async getAllStockList(market = 'ALL') {
    console.log('📊 동적 종목 리스트 생성 시작...');

    const stockMap = new Map(); // code -> name 매핑 (중복 제거 + 이름 캐싱)
    const markets = market === 'ALL' ? ['KOSPI', 'KOSDAQ'] : [market];

    try {
      for (const mkt of markets) {
        console.log(`\n🔍 ${mkt} 시장 분석 중...`);

        // 1. 거래량 급증 순위 (30개)
        console.log(`  - 거래량 급증 순위 조회...`);
        const volSurge = await this.getVolumeSurgeRank(mkt, 30);
        volSurge.forEach(s => stockMap.set(s.code, s.name));
        await new Promise(r => setTimeout(r, 200)); // API 제한 대응

        // 2. 거래대금 순위 (30개)
        console.log(`  - 거래대금 순위 조회...`);
        const tradingValue = await this.getTradingValueRank(mkt, 30);
        tradingValue.forEach(s => stockMap.set(s.code, s.name));
        await new Promise(r => setTimeout(r, 200));

        // 3. 거래량 순위 (20개)
        console.log(`  - 거래량 순위 조회...`);
        const volume = await this.getVolumeRank(mkt, 20);
        volume.forEach(s => stockMap.set(s.code, s.name));
        await new Promise(r => setTimeout(r, 200));
      }

      const codes = Array.from(stockMap.keys());
      console.log(`\n✅ 총 ${codes.length}개 유니크 종목 확보 완료!`);

      // 종목명 캐싱
      this.stockNameCache = stockMap;

      return { codes, nameMap: stockMap };

    } catch (error) {
      console.error('❌ 동적 종목 리스트 생성 실패:', error.message);
      console.log('⚠️  하드코딩된 기본 리스트 사용');

      // 실패 시 기본 리스트 반환 (종목명은 API에서 조회)
      const kospiStocks = [
        '005930', '000660', '051910', '006400', '005380', '000270', '035720', '035420',
        '068270', '207940', '105560', '055550', '003670', '096770', '028260', '012330',
        '017670', '066570', '034730', '018260', '003550', '009150', '033780', '015760',
        '011200', '010950', '086790', '032830', '030200', '090430', '000100', '316140'
      ];

      const kosdaqStocks = [
        '247540', '086520', '263750', '091990', '403870', '357780', '196170', '112040',
        '293490', '095340', '365340', '058470', '214150', '137400', '067160', '348210'
      ];

      let codes;
      if (market === 'ALL') {
        codes = [...kospiStocks, ...kosdaqStocks];
      } else if (market === 'KOSPI') {
        codes = kospiStocks;
      } else if (market === 'KOSDAQ') {
        codes = kosdaqStocks;
      }

      // 빈 nameMap 반환 (이후 getCurrentPrice에서 조회)
      this.stockNameCache = new Map();
      return { codes, nameMap: new Map() };
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
}

module.exports = new KISApi();
