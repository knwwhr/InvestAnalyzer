/**
 * 과거 추천 종목의 일별 가격 데이터 소급 저장
 *
 * 사용법:
 *   node backfill-daily-prices.js
 *
 * 동작:
 *   1. Supabase에서 활성 추천 종목 조회
 *   2. 추천일부터 오늘까지 일봉 데이터 조회
 *   3. recommendation_daily_prices에 일별 가격 저장
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const kisApi = require('./backend/kisApi');

// Supabase 클라이언트
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수 누락: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 날짜 문자열을 Date 객체로 변환
 */
function parseDate(dateStr) {
  // YYYY-MM-DD 또는 YYYYMMDD 형식 지원
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  } else {
    // YYYYMMDD
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return new Date(`${year}-${month}-${day}`);
  }
}

/**
 * Date 객체를 YYYY-MM-DD 형식으로 변환
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜 배열 생성 (startDate부터 endDate까지)
 */
function generateDateRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);

  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

async function backfillDailyPrices() {
  console.log('\n📊 과거 추천 종목 일별 가격 데이터 소급 저장 시작...\n');

  try {
    // 1. 활성 추천 종목 조회
    const { data: recommendations, error: fetchError } = await supabase
      .from('screening_recommendations')
      .select('*')
      .eq('is_active', true)
      .order('recommendation_date', { ascending: false });

    if (fetchError) {
      throw new Error(`추천 종목 조회 실패: ${fetchError.message}`);
    }

    if (!recommendations || recommendations.length === 0) {
      console.log('활성 추천 종목이 없습니다.');
      return;
    }

    console.log(`활성 추천: ${recommendations.length}개\n`);

    // 2. 각 종목별로 과거 데이터 채우기
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const rec of recommendations) {
      try {
        const recDate = parseDate(rec.recommendation_date);
        const today = new Date();
        const daysSince = Math.floor((today - recDate) / (1000 * 60 * 60 * 24));

        console.log(`\n[${rec.stock_code}] ${rec.stock_name}`);
        console.log(`  추천일: ${rec.recommendation_date} (${daysSince}일 전)`);

        // 3. 일봉 데이터 조회 (추천일부터 오늘까지)
        const chartDays = Math.min(daysSince + 5, 30); // 최대 30일
        const chartData = await kisApi.getDailyChart(rec.stock_code, chartDays);

        if (!chartData || chartData.length === 0) {
          console.log(`  ⚠️ 차트 데이터 없음 - 스킵`);
          totalSkipped++;
          continue;
        }

        // 4. 추천일 이후 데이터만 필터링
        const filteredData = chartData.filter(d => {
          const chartDate = parseDate(d.date);
          return chartDate >= recDate;
        });

        console.log(`  📈 차트 데이터: ${filteredData.length}일치 (${filteredData[0]?.date} ~ ${filteredData[filteredData.length - 1]?.date})`);

        // 5. 일별 가격 데이터 생성
        const dailyPrices = filteredData.map(dayData => {
          const trackingDate = dayData.date; // YYYYMMDD
          const formattedDate = trackingDate.slice(0, 4) + '-' + trackingDate.slice(4, 6) + '-' + trackingDate.slice(6, 8);

          const trackingDateObj = parseDate(formattedDate);
          const daysSinceRec = Math.floor((trackingDateObj - recDate) / (1000 * 60 * 60 * 24));

          // 전일 대비 변화율 계산
          const prevDayIndex = filteredData.findIndex(d => d.date === trackingDate) + 1;
          let changeRate = 0;
          if (prevDayIndex < filteredData.length && filteredData[prevDayIndex]) {
            const prevClose = filteredData[prevDayIndex].close;
            if (prevClose > 0) {
              changeRate = ((dayData.close - prevClose) / prevClose * 100);
            }
          }

          // 누적 수익률 계산
          const cumulativeReturn = rec.recommended_price > 0
            ? ((dayData.close - rec.recommended_price) / rec.recommended_price * 100)
            : 0;

          return {
            recommendation_id: rec.id,
            tracking_date: formattedDate,
            closing_price: dayData.close,
            change_rate: parseFloat(changeRate.toFixed(2)),
            volume: dayData.volume || 0,
            cumulative_return: parseFloat(cumulativeReturn.toFixed(2)),
            days_since_recommendation: daysSinceRec
          };
        });

        // 6. Supabase에 저장 (upsert)
        if (dailyPrices.length > 0) {
          const { data: inserted, error: insertError } = await supabase
            .from('recommendation_daily_prices')
            .upsert(dailyPrices, {
              onConflict: 'recommendation_id,tracking_date',
              ignoreDuplicates: false  // 최신 데이터로 업데이트
            });

          if (insertError) {
            console.log(`  ❌ 저장 실패: ${insertError.message}`);
            totalFailed++;
          } else {
            console.log(`  ✅ 저장 완료: ${dailyPrices.length}일치`);
            totalInserted += dailyPrices.length;
          }
        }

        // Rate limit 방지
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        console.log(`  ❌ 오류: ${error.message}`);
        totalFailed++;
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ 소급 저장 완료`);
    console.log(`   - 총 추천 종목: ${recommendations.length}개`);
    console.log(`   - 저장된 일별 데이터: ${totalInserted}건`);
    console.log(`   - 스킵: ${totalSkipped}개`);
    console.log(`   - 실패: ${totalFailed}개`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  } catch (error) {
    console.error('\n❌ 소급 저장 실패:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 실행
backfillDailyPrices();
