/**
 * 거래량 DNA 추출 시스템 테스트
 *
 * 시나리오:
 * 1. 과거 급등했던 종목들의 "급등 전" 패턴 추출
 * 2. 공통 DNA 분석
 * 3. 현재 시장에서 매칭되는 종목 찾기 (향후 구현)
 */

const volumeDnaExtractor = require('./backend/volumeDnaExtractor');

async function testVolumeDNA() {
  console.log('🧬 거래량 DNA 추출 시스템 테스트 시작\n');

  try {
    // 테스트 시나리오: 과거 급등 종목 3개
    // (실제 사용 시: 사용자가 실제 급등했던 종목과 날짜를 입력)

    const testStocks = [
      {
        code: '005930',  // 삼성전자
        name: '삼성전자',
        startDate: '20250101',
        endDate: '20250120',
        note: '2025년 1월 초 구간'
      },
      {
        code: '000660',  // SK하이닉스
        name: 'SK하이닉스',
        startDate: '20250105',
        endDate: '20250125',
        note: '2025년 1월 초 구간'
      },
      {
        code: '035720',  // 카카오
        name: '카카오',
        startDate: '20250110',
        endDate: '20250130',
        note: '2025년 1월 중순 구간'
      }
    ];

    console.log('📋 테스트 종목 목록:\n');
    testStocks.forEach((stock, i) => {
      console.log(`${i + 1}. ${stock.name} (${stock.code})`);
      console.log(`   기간: ${stock.startDate} ~ ${stock.endDate}`);
      console.log(`   ${stock.note}\n`);
    });

    // ================================================
    // 1단계: 개별 종목 패턴 추출
    // ================================================

    console.log('━'.repeat(60));
    console.log('1️⃣ 개별 종목 패턴 추출\n');

    const stockPatterns = [];

    for (const stock of testStocks) {
      const pattern = await volumeDnaExtractor.extractStockPattern(
        stock.code,
        stock.startDate,
        stock.endDate
      );

      if (!pattern.error) {
        stockPatterns.push(pattern);

        console.log(`\n✅ ${stock.name} 패턴 추출 성공:`);
        console.log(`   - 분석 기간: ${pattern.days}일`);
        console.log(`   - 거래량 EMA: ${pattern.pattern.volumeRate.emaAvg}%`);
        console.log(`   - 최근 5일 증가율: ${pattern.pattern.volumeRate.recent5d}%`);
        console.log(`   - 트렌드: ${pattern.pattern.volumeRate.segmented.trend}`);
        console.log(`   - 종합 점수: ${pattern.pattern.volumeRate.compositeScore}`);

        if (pattern.pattern.institutionFlow) {
          console.log(`   - 기관 연속 매수: ${pattern.pattern.institutionFlow.consecutiveDays}일 (${pattern.pattern.institutionFlow.intensity})`);
        }

        if (pattern.pattern.foreignFlow) {
          console.log(`   - 외국인 연속 매수: ${pattern.pattern.foreignFlow.consecutiveDays}일 (${pattern.pattern.foreignFlow.intensity})`);
        }
      } else {
        console.error(`\n❌ ${stock.name} 패턴 추출 실패: ${pattern.error}`);
      }
    }

    if (stockPatterns.length < 2) {
      console.error('\n❌ 최소 2개 종목의 유효한 패턴 필요');
      return;
    }

    // ================================================
    // 2단계: 공통 DNA 추출
    // ================================================

    console.log('\n' + '━'.repeat(60));
    console.log('2️⃣ 공통 DNA 추출\n');

    const dnaResult = volumeDnaExtractor.extractCommonDNA(stockPatterns);

    if (dnaResult.error) {
      console.error(`❌ DNA 추출 실패: ${dnaResult.error}`);
      return;
    }

    console.log('🧬 공통 DNA 추출 성공!\n');
    console.log(`📊 DNA 강도: ${dnaResult.dnaStrength}% (${dnaResult.basedOnStocks}개 종목 기반)\n`);

    // 거래량 패턴 DNA
    if (dnaResult.commonDNA.volumeRate) {
      console.log('📈 거래량 증가율 DNA:');
      console.log(`   평균 EMA: ${dnaResult.commonDNA.volumeRate.avgEMA.toFixed(2)}%`);
      console.log(`   평균 최근 5일: ${dnaResult.commonDNA.volumeRate.avgRecent5d.toFixed(2)}%`);
      console.log(`   공통 트렌드: ${dnaResult.commonDNA.volumeRate.commonTrend}`);
      console.log(`   임계값:`);
      console.log(`     - EMA 최소: ${dnaResult.commonDNA.volumeRate.threshold.emaMin.toFixed(2)}%`);
      console.log(`     - 최근 5일 최소: ${dnaResult.commonDNA.volumeRate.threshold.recent5dMin.toFixed(2)}%`);
    }

    // 기관 매매 DNA
    if (dnaResult.commonDNA.institutionFlow) {
      console.log(`\n🏢 기관 순매수 DNA:`);
      console.log(`   평균 연속 매수일: ${dnaResult.commonDNA.institutionFlow.avgConsecutiveDays.toFixed(1)}일`);
      console.log(`   공통 강도: ${dnaResult.commonDNA.institutionFlow.commonIntensity}`);
      console.log(`   임계값:`);
      console.log(`     - 최소 연속일: ${dnaResult.commonDNA.institutionFlow.threshold.minConsecutiveDays}일`);
    }

    // 외국인 매매 DNA
    if (dnaResult.commonDNA.foreignFlow) {
      console.log(`\n🌍 외국인 순매수 DNA:`);
      console.log(`   평균 연속 매수일: ${dnaResult.commonDNA.foreignFlow.avgConsecutiveDays.toFixed(1)}일`);
      console.log(`   공통 강도: ${dnaResult.commonDNA.foreignFlow.commonIntensity}`);
      console.log(`   임계값:`);
      console.log(`     - 최소 연속일: ${dnaResult.commonDNA.foreignFlow.threshold.minConsecutiveDays}일`);
    }

    // ================================================
    // 3단계: DNA 매칭 테스트 (같은 종목으로 검증)
    // ================================================

    console.log('\n' + '━'.repeat(60));
    console.log('3️⃣ DNA 매칭 테스트 (자기 검증)\n');

    console.log('추출된 DNA와 원본 종목들의 매칭 점수:\n');

    for (const pattern of stockPatterns) {
      const matchScore = volumeDnaExtractor.calculateMatchScore(
        pattern.pattern,
        dnaResult.commonDNA
      );

      console.log(`${pattern.stockCode}: ${matchScore.totalScore.toFixed(2)}점`);

      if (matchScore.details.volumeRate) {
        console.log(`  - 거래량: ${matchScore.details.volumeRate.score.toFixed(2)}점`);
      }
      if (matchScore.details.institutionFlow) {
        console.log(`  - 기관: ${matchScore.details.institutionFlow.score.toFixed(2)}점`);
      }
      if (matchScore.details.foreignFlow) {
        console.log(`  - 외국인: ${matchScore.details.foreignFlow.score.toFixed(2)}점`);
      }
      console.log('');
    }

    console.log('━'.repeat(60));
    console.log('✅ 테스트 완료!\n');

    console.log('💡 다음 단계:');
    console.log('   1. 현재 시장의 전체 종목을 이 DNA와 비교');
    console.log('   2. 매칭 점수 70점 이상인 종목 선별');
    console.log('   3. 급등 가능성이 높은 종목 추천\n');

  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 실행
testVolumeDNA();
