/**
 * 백테스트 종목 고정 스크립트
 *
 * 목적:
 * 1. 현재 스크리닝 결과로 백테스트 실행
 * 2. 종목 리스트와 상세 지표 프로필 저장
 * 3. 이후 가중치 변경 시 같은 종목으로 재검증
 */

const screener = require('./backend/screening');
const fs = require('fs');
const path = require('path');

async function captureBacktestStocks() {
  console.log('📸 백테스트 종목 캡처 시작\n');

  try {
    // Step 1: 현재 스크리닝 실행
    console.log('🔍 종목 스크리닝 중...');
    const { stocks } = await screener.screenAllStocks('ALL');

    if (!stocks || stocks.length === 0) {
      console.error('❌ 추천 종목 없음');
      return;
    }

    console.log(`✅ ${stocks.length}개 종목 발견\n`);

    // Step 2: 종목별 상세 프로필 추출
    const stockProfiles = stocks.map(stock => ({
      // 기본 정보
      stockCode: stock.stockCode,
      stockName: stock.stockName,
      currentPrice: stock.currentPrice,

      // 점수 및 등급
      totalScore: stock.totalScore,
      grade: stock.recommendation?.grade,

      // 상세 지표 프로필
      indicators: {
        // 기본 점수 구성
        baseScore: stock.scoreBreakdown?.baseScore || 0,

        // 선행 지표
        vpdScore: stock.volumePriceDivergence?.score || 0,
        institutionalScore: stock.institutionalFlow?.score || 0,
        confluenceScore: stock.confluence?.confluenceScore || 0,
        freshnessScore: stock.freshness?.freshnessScore || 0,
        leadingScore: stock.leadingIndicators?.total || 0,
        cupHandleScore: stock.cupAndHandle?.score || 0,

        // 거래량 지표
        volumeRatio: stock.volumeAnalysis?.current?.volumeMA20
          ? (stock.volume / stock.volumeAnalysis.current.volumeMA20)
          : 0,
        obvTrend: stock.volumeAnalysis?.signals?.obvTrend || null,

        // 기관/외국인
        institutionalFlow: stock.institutionalFlow?.detected || false,

        // 패턴
        whaleDetected: stock.advancedAnalysis?.indicators?.whale?.length > 0,
        accumulationDetected: stock.advancedAnalysis?.indicators?.accumulation?.detected || false
      },

      // 가점 상세
      bonuses: stock.scoreBreakdown?.bonuses || []
    }));

    // Step 3: 등급별 분류
    const byGrade = {
      S: stockProfiles.filter(s => s.grade === 'S'),
      A: stockProfiles.filter(s => s.grade === 'A'),
      B: stockProfiles.filter(s => s.grade === 'B'),
      C: stockProfiles.filter(s => s.grade === 'C'),
      D: stockProfiles.filter(s => s.grade === 'D')
    };

    // Step 4: 점수 범위별 분류 (원본 범위 기준)
    const byScoreRange = {
      'range_58_88': stockProfiles.filter(s => s.totalScore >= 58 && s.totalScore <= 88),
      'range_42_57': stockProfiles.filter(s => s.totalScore >= 42 && s.totalScore <= 57),
      'range_25_41': stockProfiles.filter(s => s.totalScore >= 25 && s.totalScore <= 41),
      'range_89_plus': stockProfiles.filter(s => s.totalScore >= 89),
      'range_below_25': stockProfiles.filter(s => s.totalScore < 25)
    };

    // Step 5: 저장
    const captureData = {
      capturedAt: new Date().toISOString(),
      totalStocks: stocks.length,
      stocks: stockProfiles,
      byGrade: byGrade,
      byScoreRange: byScoreRange,
      stockCodes: stocks.map(s => s.stockCode), // 백테스트용 코드 리스트
      summary: {
        S: byGrade.S.length,
        A: byGrade.A.length,
        B: byGrade.B.length,
        C: byGrade.C.length,
        D: byGrade.D.length
      }
    };

    const outputPath = path.join(__dirname, 'backtest-stocks-snapshot.json');
    fs.writeFileSync(outputPath, JSON.stringify(captureData, null, 2));

    console.log('✅ 종목 프로필 저장 완료!\n');
    console.log('📊 요약:');
    console.log(`  - 총 ${stocks.length}개 종목`);
    console.log(`  - S등급: ${byGrade.S.length}개 (${byScoreRange.range_58_88.length}개 58-88점)`);
    console.log(`  - A등급: ${byGrade.A.length}개 (${byScoreRange.range_42_57.length}개 42-57점)`);
    console.log(`  - B등급: ${byGrade.B.length}개 (${byScoreRange.range_25_41.length}개 25-41점)`);
    console.log(`  - C등급: ${byGrade.C.length}개`);
    console.log(`  - D등급: ${byGrade.D.length}개`);
    console.log(`\n📁 저장 경로: ${outputPath}\n`);

    // Step 6: 우수 종목 지표 분석 (25-41점, 42-57점 범위)
    console.log('📈 우수 종목 지표 분석\n');

    const excellent25_41 = byScoreRange.range_25_41;
    const excellent42_57 = byScoreRange.range_42_57;

    if (excellent25_41.length > 0) {
      console.log(`🎯 25-41점 범위 (${excellent25_41.length}개) - 승률 89.3%, 평균 +24.9%`);
      analyzeCommonIndicators(excellent25_41);
    }

    if (excellent42_57.length > 0) {
      console.log(`\n🎯 42-57점 범위 (${excellent42_57.length}개) - 승률 77.8%, 평균 +27.5%`);
      analyzeCommonIndicators(excellent42_57);
    }

  } catch (error) {
    console.error('❌ 캡처 실패:', error);
    console.error(error.stack);
  }
}

/**
 * 공통 지표 분석
 */
function analyzeCommonIndicators(stocks) {
  if (stocks.length === 0) return;

  const avgIndicators = {
    vpdScore: avg(stocks.map(s => s.indicators.vpdScore)),
    institutionalScore: avg(stocks.map(s => s.indicators.institutionalScore)),
    confluenceScore: avg(stocks.map(s => s.indicators.confluenceScore)),
    freshnessScore: avg(stocks.map(s => s.indicators.freshnessScore)),
    leadingScore: avg(stocks.map(s => s.indicators.leadingScore)),
    cupHandleScore: avg(stocks.map(s => s.indicators.cupHandleScore)),
    volumeRatio: avg(stocks.map(s => s.indicators.volumeRatio))
  };

  console.log('  평균 지표 점수:');
  console.log(`    - VPD (거래량-가격 모멘텀): ${avgIndicators.vpdScore.toFixed(2)}점`);
  console.log(`    - 기관/외국인 수급: ${avgIndicators.institutionalScore.toFixed(2)}점`);
  console.log(`    - 합류점 (Confluence): ${avgIndicators.confluenceScore.toFixed(2)}점`);
  console.log(`    - 당일/전일 신호: ${avgIndicators.freshnessScore.toFixed(2)}점`);
  console.log(`    - 선행 지표 (패턴+DNA): ${avgIndicators.leadingScore.toFixed(2)}점`);
  console.log(`    - Cup&Handle: ${avgIndicators.cupHandleScore.toFixed(2)}점`);
  console.log(`    - 거래량 비율: ${avgIndicators.volumeRatio.toFixed(2)}배`);

  // 가장 높은 지표 3개 찾기
  const indicators = Object.entries(avgIndicators)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log('\n  🔥 주요 강점 지표 TOP 3:');
  indicators.forEach(([name, value], i) => {
    const label = {
      vpdScore: 'VPD (거래량-가격 모멘텀)',
      institutionalScore: '기관/외국인 수급',
      confluenceScore: '합류점 (Confluence)',
      freshnessScore: '당일/전일 신호',
      leadingScore: '선행 지표 (패턴+DNA)',
      cupHandleScore: 'Cup&Handle',
      volumeRatio: '거래량 비율'
    }[name];
    console.log(`    ${i + 1}. ${label}: ${value.toFixed(2)}`);
  });
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

// 실행
captureBacktestStocks();
