// 한국투자증권 거래량 순위 API 테스트
const kisApi = require('./kisApi');
const axios = require('axios');
require('dotenv').config();

async function testVolumeRankAPI() {
  try {
    console.log('🔍 거래량 순위 API 테스트 시작...\n');

    const baseUrl = 'https://openapi.koreainvestment.com:9443';
    const token = await kisApi.getAccessToken();

    // 테스트할 TR_ID 리스트
    const testAPIs = [
      {
        name: '거래량 순위',
        tr_id: 'FHPST01710000',
        endpoint: '/uapi/domestic-stock/v1/quotations/volume-rank',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',  // J: 주식
          FID_COND_SCR_DIV_CODE: '20171', // 화면분류코드
          FID_INPUT_ISCD: '0000',  // 조회종목코드 (0000: 전체)
          FID_DIV_CLS_CODE: '0',    // 분류구분코드
          FID_BLNG_CLS_CODE: '0',   // 소속구분코드 (0: 전체)
          FID_TRGT_CLS_CODE: '111111111', // 대상구분코드
          FID_TRGT_EXLS_CLS_CODE: '000000', // 제외구분
          FID_INPUT_PRICE_1: '',    // 입력가격1
          FID_INPUT_PRICE_2: '',    // 입력가격2
          FID_VOL_CNT: '',          // 거래량수
          FID_INPUT_DATE_1: ''      // 입력날짜1
        }
      },
      {
        name: '거래량 급증 순위',
        tr_id: 'FHPST01730000',
        endpoint: '/uapi/domestic-stock/v1/quotations/volume-surge-rank',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20173',
          FID_INPUT_ISCD: '0000',
          FID_DIV_CLS_CODE: '0',
          FID_BLNG_CLS_CODE: '0',
          FID_TRGT_CLS_CODE: '111111111',
          FID_TRGT_EXLS_CLS_CODE: '000000'
        }
      },
      {
        name: '거래대금 순위',
        tr_id: 'FHPST01720000',
        endpoint: '/uapi/domestic-stock/v1/quotations/trading-value-rank',
        params: {
          FID_COND_MRKT_DIV_CODE: 'J',
          FID_COND_SCR_DIV_CODE: '20172',
          FID_INPUT_ISCD: '0000',
          FID_DIV_CLS_CODE: '0',
          FID_BLNG_CLS_CODE: '0',
          FID_TRGT_CLS_CODE: '111111111',
          FID_TRGT_EXLS_CLS_CODE: '000000'
        }
      }
    ];

    for (const api of testAPIs) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 ${api.name} (${api.tr_id})`);
      console.log(`${'='.repeat(60)}`);

      try {
        const response = await axios.get(`${baseUrl}${api.endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            'authorization': `Bearer ${token}`,
            'appkey': process.env.KIS_APP_KEY,
            'appsecret': process.env.KIS_APP_SECRET,
            'tr_id': api.tr_id
          },
          params: api.params
        });

        if (response.data.rt_cd === '0') {
          console.log(`✅ 성공! 데이터 ${response.data.output.length}개 조회됨\n`);

          // 상위 5개만 출력
          console.log('📈 상위 5개 종목:');
          response.data.output.slice(0, 5).forEach((stock, idx) => {
            console.log(`${idx + 1}. ${stock.hts_kor_isnm || stock.prdt_name || '종목명'} (${stock.mksc_shrn_iscd || stock.stck_shrn_iscd})`);
            console.log(`   현재가: ${stock.stck_prpr}원, 거래량: ${stock.acml_vol || stock.data_rank}회`);
          });

          // 전체 종목 코드 리스트 반환
          console.log(`\n💾 ${api.name} 전체 종목 코드:`);
          const stockCodes = response.data.output.map(s => s.mksc_shrn_iscd || s.stck_shrn_iscd);
          console.log(stockCodes.slice(0, 30).join(', '));

        } else {
          console.log(`❌ 실패: ${response.data.msg1}`);
        }

      } catch (error) {
        console.log(`❌ API 호출 오류: ${error.response?.data?.msg1 || error.message}`);
      }

      // API 호출 제한 대응
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ 모든 테스트 완료!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
  }
}

testVolumeRankAPI();
