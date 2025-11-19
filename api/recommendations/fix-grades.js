/**
 * 저장된 추천 종목 등급 일괄 수정 API
 * POST /api/recommendations/fix-grades
 *
 * 목적: v3.8 등급 체계 변경 후, 과거 저장된 종목의 등급을 점수에 맞게 재계산
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 서비스 롤 클라이언트
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * 점수 기반 등급 계산 (v3.8 기준)
 */
function calculateGrade(score) {
  if (score >= 58 && score <= 88) {
    return {
      grade: 'S',
      text: '🔥 최우선 매수',
      tooltip: '거래량 폭발, 기관 본격 매수 (백테스트: 승률 86.7%, 평균 +24.9%)'
    };
  } else if (score >= 42 && score <= 57) {
    return {
      grade: 'A',
      text: '🟢 적극 매수',
      tooltip: '거래량 증가 시작, 기관 초기 진입 (백테스트: 승률 77.8%, 평균 +27.5%)'
    };
  } else if (score >= 25 && score <= 41) {
    return {
      grade: 'B',
      text: '🟡 매수 고려',
      tooltip: '선행 패턴 감지 (백테스트: 승률 89.3%, 평균 +24.9%)'
    };
  } else if (score >= 89) {
    return {
      grade: 'C',
      text: '⚠️ 과열 경고',
      tooltip: '모든 지표 점등, 조정 가능성 (백테스트: 샘플 부족)'
    };
  } else {
    return {
      grade: 'D',
      text: '⚫ 관망',
      tooltip: '선행 지표 미감지, 관망 권장'
    };
  }
}

module.exports = async (req, res) => {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Supabase 비활성화 시
  if (!supabase) {
    return res.status(503).json({
      error: 'Supabase not configured'
    });
  }

  try {
    console.log('\n🔧 저장된 종목 등급 일괄 수정 시작...\n');

    // 1. 활성 추천 종목 조회
    const { data: recommendations, error: fetchError } = await supabase
      .from('screening_recommendations')
      .select('*')
      .eq('is_active', true);

    if (fetchError) {
      console.error('추천 조회 실패:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    if (!recommendations || recommendations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active recommendations',
        updated: 0
      });
    }

    console.log(`활성 추천: ${recommendations.length}개`);

    // 2. 등급 불일치 종목 찾기 및 수정
    const updates = [];
    let matchCount = 0;
    let mismatchCount = 0;

    for (const rec of recommendations) {
      const score = rec.total_score;
      const oldGrade = rec.recommendation_grade;

      // 점수에 맞는 새 등급 계산
      const newGradeInfo = calculateGrade(score);
      const newGrade = newGradeInfo.grade;

      if (oldGrade !== newGrade) {
        updates.push({
          id: rec.id,
          recommendation_grade: newGrade
        });

        console.log(`수정: ${rec.stock_name} (${rec.stock_code}) - ${oldGrade}등급 ${score}점 → ${newGrade}등급`);
        mismatchCount++;
      } else {
        matchCount++;
      }
    }

    console.log(`\n등급 일치: ${matchCount}개, 불일치: ${mismatchCount}개\n`);

    // 3. 일괄 업데이트
    let updatedCount = 0;
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('screening_recommendations')
          .update({ recommendation_grade: update.recommendation_grade })
          .eq('id', update.id);

        if (updateError) {
          console.error(`업데이트 실패 [${update.id}]:`, updateError.message);
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`✅ 등급 수정 완료: ${updatedCount}/${mismatchCount}개\n`);

    return res.status(200).json({
      success: true,
      total: recommendations.length,
      matched: matchCount,
      mismatched: mismatchCount,
      updated: updatedCount,
      message: `${updatedCount}개 종목 등급 수정 완료`
    });

  } catch (error) {
    console.error('등급 수정 실패:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
