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
        return {
          stockCode: stockCode,
          stockName: output.prdt_name || 'Unknown',
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
   * 전체 종목 리스트 조회
   * @param {string} market - 시장구분 ('ALL', 'KOSPI', 'KOSDAQ')
   */
  async getAllStockList(market = 'ALL') {
    // 한국투자증권 API에는 전체 종목 리스트 API가 없어서
    // 주요 종목 리스트를 하드코딩합니다
    // 실제 운영시에는 KRX 파일이나 별도 DB 사용 권장

    const kospiStocks = [
      '005930', '000660', '051910', '006400', '005380', '000270', '035720', '035420',
      '068270', '207940', '105560', '055550', '003670', '096770', '028260', '012330',
      '017670', '066570', '034730', '018260', '003550', '009150', '033780', '015760',
      '011200', '010950', '086790', '032830', '030200', '090430', '000100', '316140',
      '010130', '003490', '009540', '086280', '011070', '047050', '001450', '034220',
      '051900', '259960', '000720', '018880', '138040', '004020', '024110', '042700',
      '011170', '009830', '036570', '009970', '010140', '021240', '005830', '006800',
      '032640', '047810', '097950', '003230', '005490', '161390', '000810', '010120',
      '011780', '078930', '002380', '006360', '329180', '267250', '004170', '071050',
      '000880', '028050', '034020', '001040', '004990', '024110', '006280', '011790',
      '023530', '014680', '029780', '012750', '004370', '002790', '008770', '001740',
      '047040', '000150', '161890', '042660', '003230', '051915', '009420', '010620'
    ];

    const kosdaqStocks = [
      '247540', '086520', '263750', '091990', '403870', '357780', '196170', '112040',
      '293490', '095340', '365340', '058470', '214150', '137400', '067160', '348210',
      '039030', '145020', '277810', '141080', '253450', '352820', '328130', '436440',
      '036830', '120110', '121600', '041510', '053800', '131970', '095610', '214450',
      '005290', '122870', '064760', '068760', '215600', '048410', '143160', '035760',
      '357250', '194480', '225190', '357550', '298540', '290510', '196700', '237690',
      '256840', '298690', '089970', '290650', '306200', '263860', '298380', '445680'
    ];

    let stocks = [];
    if (market === 'ALL') {
      stocks = [...kospiStocks, ...kosdaqStocks];
    } else if (market === 'KOSPI') {
      stocks = kospiStocks;
    } else if (market === 'KOSDAQ') {
      stocks = kosdaqStocks;
    }

    return stocks;
  }
}

module.exports = new KISApi();
