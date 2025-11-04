/**
 * Gemini API 사용 가능한 모델 목록 확인
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
  console.log('\n🔍 Gemini API 사용 가능한 모델 목록\n');

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    return;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    // 모델 목록 조회 (공식 메소드가 있다면)
    console.log('SDK를 통한 모델 목록 조회 시도...\n');

    // 직접 API 호출로 모델 목록 확인
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!response.ok) {
      console.error('❌ API 호출 실패:', response.status, response.statusText);
      return;
    }

    const data = await response.json();

    if (data.models && data.models.length > 0) {
      console.log(`✅ 사용 가능한 모델: ${data.models.length}개\n`);

      data.models.forEach((model, index) => {
        console.log(`${index + 1}. ${model.name}`);
        console.log(`   지원 메소드: ${model.supportedGenerationMethods.join(', ')}`);
        console.log(`   설명: ${model.displayName || 'N/A'}\n`);
      });

      // generateContent를 지원하는 모델 필터링
      const compatibleModels = data.models.filter(m =>
        m.supportedGenerationMethods.includes('generateContent')
      );

      console.log(`\n📌 generateContent 지원 모델: ${compatibleModels.length}개`);
      compatibleModels.forEach(m => {
        console.log(`   - ${m.name.replace('models/', '')}`);
      });

    } else {
      console.log('⚠️  모델 목록이 비어있습니다.');
    }

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    console.error('상세:', error);
  }
}

listModels().catch(console.error);
