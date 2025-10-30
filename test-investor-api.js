/**
 * KIS API 투자자별 데이터 테스트
 * 목적: FHKST01010100 (현재가) 응답에 기관/외국인 데이터 포함 여부 확인
 */

const kisApi = require('./backend/kisApi');
require('dotenv').config();

async function testInvestorData() {
  console.log('🔍 KIS API 투자자별 데이터 테스트 시작\n');

  try {
    // 1. 현재가 조회 API 원본 응답 확인
    console.log('1️⃣ 현재가 조회 API (FHKST01010100) 테스트');
    console.log('   종목: 005930 (삼성전자)\n');

    const axios = require('axios');
    const token = await kisApi.getAccessToken();

    const response = await axios.get(`${kisApi.baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price`, {
      headers: {
        'Content-Type': 'application/json',
        'authorization': `Bearer ${token}`,
        'appkey': kisApi.appKey,
        'appsecret': kisApi.appSecret,
        'tr_id': 'FHKST01010100'
      },
      params: {
        FID_COND_MRKT_DIV_CODE: 'J',
        FID_INPUT_ISCD: '005930'
      }
    });

    if (response.data.rt_cd === '0') {
      const output = response.data.output;

      console.log('✅ API 응답 성공');
      console.log('\n📋 전체 응답 필드:');
      console.log(JSON.stringify(output, null, 2));

      // 기관/외국인 데이터 탐색
      console.log('\n🔍 기관/외국인 관련 필드 검색:');
      const investorFields = Object.keys(output).filter(key =>
        key.includes('ntby') ||  // 순매수
        key.includes('frgn') ||  // 외국인
        key.includes('orgn') ||  // 기관
        key.includes('prsn')     // 개인
      );

      if (investorFields.length > 0) {
        console.log('✅ 발견된 투자자 관련 필드:');
        investorFields.forEach(field => {
          console.log(`   - ${field}: ${output[field]}`);
        });
      } else {
        console.log('❌ 현재가 API에는 투자자 데이터 없음');
        console.log('   → 별도 API 필요: FHKST01010900 추정');
      }

    } else {
      console.error('❌ API 오류:', response.data.msg1);
    }

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('   응답 상태:', error.response.status);
      console.error('   응답 데이터:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 실행
testInvestorData();
