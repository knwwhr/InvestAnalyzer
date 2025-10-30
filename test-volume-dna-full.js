/**
 * 거래량 DNA 시스템 통합 테스트
 *
 * Phase 1: DNA 추출 → Phase 2: 시장 스캔
 */

const axios = require('axios');

const API_BASE = 'https://investar-xi.vercel.app';

async function testFullDNAWorkflow() {
  console.log('🧬 거래량 DNA 시스템 통합 테스트\n');
  console.log('━'.repeat(60));

  try {
    // ================================================
    // Phase 1: DNA 추출
    // ================================================
    console.log('\n1️⃣ Phase 1: DNA 추출\n');

    const extractRequest = {
      mode: 'extract',
      stocks: [
        { code: '005930', startDate: '20251001', endDate: '20251025' }, // 삼성전자
        { code: '000660', startDate: '20251005', endDate: '20251025' }  // SK하이닉스
      ]
    };

    console.log('📤 DNA 추출 요청...');
    console.log(`   - 종목: ${extractRequest.stocks.map(s => s.code).join(', ')}\n`);

    const extractResponse = await axios.post(
      `${API_BASE}/api/patterns/volume-dna`,
      extractRequest
    );

    if (!extractResponse.data.success) {
      throw new Error(`DNA 추출 실패: ${extractResponse.data.error}`);
    }

    const { commonDNA, dnaStrength, basedOnStocks } = extractResponse.data.result;

    console.log('✅ DNA 추출 성공!\n');
    console.log(`   - DNA 강도: ${dnaStrength}%`);
    console.log(`   - 기반 종목: ${basedOnStocks}개`);
    console.log(`   - 평균 EMA: ${commonDNA.volumeRate.avgEMA}%`);
    console.log(`   - 평균 최근5일: ${commonDNA.volumeRate.avgRecent5d}%`);

    if (commonDNA.institutionFlow) {
      console.log(`   - 기관 평균 연속 매수: ${commonDNA.institutionFlow.avgConsecutiveDays}일`);
    }

    if (commonDNA.foreignFlow) {
      console.log(`   - 외국인 평균 연속 매수: ${commonDNA.foreignFlow.avgConsecutiveDays}일`);
    }

    // ================================================
    // Phase 2: 시장 스캔
    // ================================================
    console.log('\n━'.repeat(60));
    console.log('\n2️⃣ Phase 2: 현재 시장 스캔\n');

    const scanRequest = {
      mode: 'scan',
      commonDNA: commonDNA,
      options: {
        matchThreshold: 60,  // 60점 이상
        limit: 5,            // 상위 5개
        days: 15             // 최근 15일 분석
      }
    };

    console.log('📤 시장 스캔 요청...');
    console.log(`   - 매칭 임계값: ${scanRequest.options.matchThreshold}점`);
    console.log(`   - 최대 반환: ${scanRequest.options.limit}개`);
    console.log(`   - 분석 기간: 최근 ${scanRequest.options.days}일\n`);

    const scanResponse = await axios.post(
      `${API_BASE}/api/patterns/volume-dna`,
      scanRequest
    );

    if (!scanResponse.data.success) {
      throw new Error(`시장 스캔 실패: ${scanResponse.data.error}`);
    }

    const { matchedStocks } = scanResponse.data.result;

    console.log(`✅ 시장 스캔 완료: ${matchedStocks.length}개 종목 발견!\n`);

    if (matchedStocks.length === 0) {
      console.log('   ⚠️ 임계값을 낮춰보세요 (현재: 60점)');
    } else {
      console.log('🏆 DNA 매칭 종목:\n');
      matchedStocks.forEach((stock, i) => {
        console.log(`${i + 1}. ${stock.stockName} (${stock.stockCode})`);
        console.log(`   - 매칭 점수: ${stock.matchScore}점`);
        console.log(`   - 분석 일수: ${stock.analyzedDays}일`);

        if (stock.scoreDetails.volumeRate) {
          console.log(`   - 거래량 EMA: ${stock.scoreDetails.volumeRate.current.emaAvg.toFixed(2)}% (임계값: ${stock.scoreDetails.volumeRate.threshold.emaMin.toFixed(2)}%)`);
          console.log(`   - 최근 5일: ${stock.scoreDetails.volumeRate.current.recent5d.toFixed(2)}% (임계값: ${stock.scoreDetails.volumeRate.threshold.recent5dMin.toFixed(2)}%)`);
        }

        if (stock.scoreDetails.institutionFlow) {
          console.log(`   - 기관 연속 매수: ${stock.scoreDetails.institutionFlow.current}일`);
        }

        if (stock.pattern.volumeRate) {
          console.log(`   - 트렌드: ${stock.pattern.volumeRate.segmented.trend}`);
          console.log(`   - 급등 임박성: ${stock.pattern.volumeRate.urgency}`);
        }

        console.log('');
      });
    }

    // ================================================
    // 결과 요약
    // ================================================
    console.log('━'.repeat(60));
    console.log('\n✅ 통합 테스트 완료!\n');
    console.log('💡 다음 단계:');
    console.log('   1. 매칭된 종목의 차트 확인');
    console.log('   2. 추가 기술적 분석 수행');
    console.log('   3. 매수/매도 전략 수립\n');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);

    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 실행
testFullDNAWorkflow();
