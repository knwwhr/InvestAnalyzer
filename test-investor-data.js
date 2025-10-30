/**
 * 기관/외국인 투자자 데이터 API 테스트
 */

const kisApi = require('./backend/kisApi');

async function testInvestorAPI() {
  console.log('🔍 기관/외국인 투자자 데이터 API 테스트\n');

  try {
    const stockCode = '005930'; // 삼성전자
    const days = 10; // 최근 10일

    console.log(`종목: ${stockCode} (삼성전자)`);
    console.log(`조회 기간: 최근 ${days}일\n`);

    const investorData = await kisApi.getInvestorData(stockCode, days);

    if (!investorData || investorData.length === 0) {
      console.log('❌ 데이터 없음');
      return;
    }

    console.log(`✅ 데이터 조회 성공: ${investorData.length}일\n`);

    // 최근 5일 데이터 출력
    console.log('📊 최근 5일 투자자별 순매수 데이터:\n');
    console.log('날짜       | 종가    | 개인      | 외국인    | 기관');
    console.log('-'.repeat(60));

    investorData.slice(-5).forEach(day => {
      const date = day.date;
      const price = day.closePrice.toLocaleString();
      const individual = (day.individual.netBuyQty / 1000).toFixed(0); // 천주 단위
      const foreign = (day.foreign.netBuyQty / 1000).toFixed(0);
      const institution = (day.institution.netBuyQty / 1000).toFixed(0);

      console.log(
        `${date} | ${price.padStart(7)} | ${individual.padStart(7)}천주 | ${foreign.padStart(7)}천주 | ${institution.padStart(7)}천주`
      );
    });

    // 누적 순매수 통계
    console.log('\n📈 최근 10일 누적 순매수 통계:\n');

    const totalIndividual = investorData.reduce((sum, d) => sum + d.individual.netBuyQty, 0);
    const totalForeign = investorData.reduce((sum, d) => sum + d.foreign.netBuyQty, 0);
    const totalInstitution = investorData.reduce((sum, d) => sum + d.institution.netBuyQty, 0);

    console.log(`개인 누적:    ${(totalIndividual / 1000000).toFixed(2)}백만주`);
    console.log(`외국인 누적:  ${(totalForeign / 1000000).toFixed(2)}백만주`);
    console.log(`기관 누적:    ${(totalInstitution / 1000000).toFixed(2)}백만주`);

    // 매수/매도 강도 분석
    console.log('\n🎯 매수 세력 분석 (연속 순매수일):\n');

    let individualBuyDays = 0;
    let foreignBuyDays = 0;
    let institutionBuyDays = 0;

    for (let i = investorData.length - 1; i >= 0; i--) {
      if (investorData[i].individual.netBuyQty > 0) individualBuyDays++;
      else break;
    }

    for (let i = investorData.length - 1; i >= 0; i--) {
      if (investorData[i].foreign.netBuyQty > 0) foreignBuyDays++;
      else break;
    }

    for (let i = investorData.length - 1; i >= 0; i--) {
      if (investorData[i].institution.netBuyQty > 0) institutionBuyDays++;
      else break;
    }

    console.log(`개인:   ${individualBuyDays}일 연속 순매수 ${individualBuyDays >= 3 ? '✅' : ''}`);
    console.log(`외국인: ${foreignBuyDays}일 연속 순매수 ${foreignBuyDays >= 3 ? '✅ 강세!' : ''}`);
    console.log(`기관:   ${institutionBuyDays}일 연속 순매수 ${institutionBuyDays >= 3 ? '✅ 강세!' : ''}`);

    console.log('\n✅ 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    }
  }
}

// 실행
testInvestorAPI();
