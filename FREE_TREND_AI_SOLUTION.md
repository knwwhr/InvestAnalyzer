# 완전 무료 트렌드 + AI 솔루션

## 🎯 목표: $0 비용으로 Google Trends + AI 모두 사용

---

## 1. 🔍 Google Trends - 무료 솔루션

### Option A: google-trends-api (비공식, 추천 ⭐)

**완전 무료, 바로 사용 가능**

```bash
npm install google-trends-api
```

**장점**:
- ✅ 완전 무료
- ✅ API 키 불필요
- ✅ 실시간 트렌드 데이터
- ✅ Node.js 네이티브 지원

**단점**:
- ⚠️ 비공식 API (Google이 막을 가능성)
- ⚠️ Rate limit 불명확
- ⚠️ 장기 안정성 보장 없음

**사용 예시**:
```javascript
const googleTrends = require('google-trends-api');

// 검색어 트렌드 조회
async function getStockTrend(stockName) {
  try {
    const results = await googleTrends.interestOverTime({
      keyword: stockName,
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7일 전
      endTime: new Date(),
      geo: 'KR' // 한국
    });

    const data = JSON.parse(results);
    return data.default.timelineData;
  } catch (error) {
    console.error('Google Trends 조회 실패:', error);
    return null;
  }
}

// 실시간 인기 검색어
async function getRealTimeTrends() {
  const results = await googleTrends.realTimeTrends({
    geo: 'KR',
    category: 'all'
  });

  const data = JSON.parse(results);
  return data.storySummaries.trendingStories;
}
```

**실전 활용**:
```javascript
// backend/trendCollector.js
const googleTrends = require('google-trends-api');
const supabase = require('./supabaseClient');

async function collectTrendsForStock(stockCode, stockName) {
  try {
    // 최근 7일 검색 트렌드
    const trendData = await googleTrends.interestOverTime({
      keyword: stockName,
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(),
      geo: 'KR'
    });

    const parsed = JSON.parse(trendData);
    const timeline = parsed.default.timelineData;

    if (!timeline || timeline.length === 0) {
      return null;
    }

    // 최근 값과 평균 계산
    const recentValue = timeline[timeline.length - 1].value[0];
    const avgValue = timeline.reduce((sum, d) => sum + d.value[0], 0) / timeline.length;

    // 급증 감지 (평균 대비 3배 이상)
    const isSurging = recentValue > avgValue * 3;

    // Supabase에 저장
    await supabase.from('search_trends').upsert({
      stock_code: stockCode,
      stock_name: stockName,
      search_value: recentValue,
      avg_value: avgValue,
      surge_detected: isSurging,
      collected_at: new Date()
    });

    return {
      stockCode,
      recentValue,
      avgValue,
      changeRate: ((recentValue - avgValue) / avgValue * 100).toFixed(2),
      isSurging
    };

  } catch (error) {
    console.warn(`Trends 수집 실패 [${stockName}]:`, error.message);
    return null;
  }
}
```

---

### Option B: Pytrends (Python, 안정적)

Python 서버를 추가로 띄울 수 있다면 더 안정적입니다.

```bash
pip install pytrends
```

```python
# python/trends_collector.py
from pytrends.request import TrendReq

pytrends = TrendReq(hl='ko-KR', tz=540)

def get_stock_trend(stock_name):
    pytrends.build_payload([stock_name], timeframe='now 7-d', geo='KR')
    data = pytrends.interest_over_time()
    return data

# Node.js에서 호출
# exec('python python/trends_collector.py "삼성전자"')
```

**추천**: Node.js만 쓰는 경우 **Option A**, Python 환경도 있다면 **Option B**

---

## 2. 🤖 AI - 무료 솔루션

### Option A: Google Gemini API (추천 ⭐⭐⭐)

**완전 무료, 가장 강력**

**무료 할당량**:
- ✅ **월 60 requests/분**
- ✅ **일 1,500 requests**
- ✅ **완전 무료** (크레딧 카드 불필요)

```bash
npm install @google/generative-ai
```

**API 키 발급** (무료):
1. https://makersuite.google.com/app/apikey
2. "Create API Key" 클릭
3. 키 복사

**사용 예시**:
```javascript
// backend/aiAnalyzer.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeNewsWithAI(newsTitle, newsContent) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
다음 뉴스를 분석하여 JSON 형식으로 답변해주세요.

뉴스 제목: ${newsTitle}
뉴스 내용: ${newsContent}

분석 항목:
1. 언급된 종목명들 (배열)
2. 감성 (positive/neutral/negative)
3. 핵심 키워드 (3개)
4. 주가에 미치는 영향 점수 (0-100)

JSON 형식:
{
  "stocks": ["종목명1", "종목명2"],
  "sentiment": "positive",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "impact_score": 85,
  "summary": "한 줄 요약"
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 추출 (```json ... ``` 제거)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return null;
  } catch (error) {
    console.error('AI 분석 실패:', error);
    return null;
  }
}

// 실전 활용
async function processNewsWithAI(news) {
  const analysis = await analyzeNewsWithAI(news.title, news.content);

  if (analysis) {
    // Supabase에 저장
    for (const stockName of analysis.stocks) {
      await supabase.from('news_mentions').insert({
        stock_name: stockName,
        news_title: news.title,
        news_url: news.link,
        sentiment: analysis.sentiment,
        impact_score: analysis.impact_score,
        keywords: analysis.keywords,
        ai_summary: analysis.summary,
        published_at: news.pubDate
      });
    }
  }

  return analysis;
}
```

**장점**:
- ✅ 완전 무료 (카드 등록 불필요)
- ✅ GPT-3.5급 성능
- ✅ 한국어 지원 우수
- ✅ 빠른 응답 속도
- ✅ 공식 API (안정적)

---

### Option B: Anthropic Claude API (첫 달 무료)

**첫 달 $5 무료 크레딧**

```bash
npm install @anthropic-ai/sdk
```

**사용 예시**:
```javascript
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function analyzeWithClaude(newsTitle) {
  const message = await anthropic.messages.create({
    model: "claude-3-haiku-20240307", // 가장 저렴
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `다음 뉴스에서 종목명을 추출해주세요: ${newsTitle}`
    }]
  });

  return message.content[0].text;
}
```

**비용**:
- Haiku: $0.25 / 1M tokens (매우 저렴)
- 첫 달 $5 무료 → 약 20M tokens

---

### Option C: HuggingFace Inference API (무료, 제한적)

**완전 무료, 성능 제한적**

```bash
npm install @huggingface/inference
```

```javascript
const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_API_KEY);

async function summarizeNews(text) {
  const result = await hf.summarization({
    model: 'facebook/bart-large-cnn',
    inputs: text
  });

  return result.summary_text;
}
```

**장점**:
- ✅ 완전 무료
- ✅ 다양한 모델 선택

**단점**:
- ⚠️ 한국어 지원 약함
- ⚠️ 성능 제한적
- ⚠️ Rate limit 있음

---

### Option D: Ollama (로컬 LLM, 완전 무료)

**서버 리소스가 있다면 가장 좋음**

```bash
# Ollama 설치
curl -fsSL https://ollama.com/install.sh | sh

# 모델 다운로드 (한국어 지원)
ollama pull llama2-korean
ollama pull mistral
```

```javascript
// backend/localLLM.js
const axios = require('axios');

async function analyzeWithOllama(prompt) {
  const response = await axios.post('http://localhost:11434/api/generate', {
    model: 'llama2-korean',
    prompt: prompt,
    stream: false
  });

  return response.data.response;
}
```

**장점**:
- ✅ 완전 무료
- ✅ 무제한 사용
- ✅ 프라이버시 보장

**단점**:
- ⚠️ 서버 리소스 필요 (최소 8GB RAM)
- ⚠️ 성능이 GPT보다 낮음
- ⚠️ Vercel Serverless에서 사용 불가

---

## 🎯 최종 추천 조합 (완전 무료)

### 🏆 Best Practice (추천)

```javascript
// 1. RSS 뉴스 수집 (무료)
const rssParser = require('rss-parser');

// 2. Google Trends 검색량 (무료)
const googleTrends = require('google-trends-api');

// 3. Gemini AI 분석 (무료)
const { GoogleGenerativeAI } = require("@google/generative-ai");
```

**비용**: **$0/월** ✅

**구성**:
- RSS 파싱: 무료 무제한
- Google Trends: 무료 (비공식 API, 조심스럽게 사용)
- Gemini API: 무료 (월 60 requests/분 = 86,400 requests/일)

**일일 처리량**:
- 뉴스 수집: 무제한
- Trends 조회: 100개 종목 x 1일 1회 = 100 requests
- AI 분석: 100개 뉴스 x 1회 = 100 requests

**여유**: Gemini 일일 1,500 requests 중 100개만 사용 → **94% 여유**

---

## 📊 구현 아키텍처

### 전체 플로우

```
[RSS 피드 수집]
  → 뉴스 헤드라인 + 본문

[Gemini AI 분석]
  → 종목명 추출
  → 감성 분석
  → 영향도 점수
  → AI 요약

[Google Trends 조회]
  → 종목별 검색량
  → 급증 감지

[Supabase 저장]
  → 뉴스 + AI 분석 결과
  → 검색 트렌드 데이터

[트렌드 점수 계산]
  → 뉴스 언급 (40%)
  → 검색량 급증 (30%)
  → AI 영향도 점수 (30%)
```

### 파일 구조

```
backend/
├── newsCollector.js       # RSS 수집
├── trendCollector.js      # Google Trends
├── aiAnalyzer.js          # Gemini AI
├── trendScoring.js        # 점수 계산
└── supabaseClient.js      # DB

api/
├── trends/
│   ├── collect-news.js    # Cron: RSS (1시간마다)
│   ├── collect-trends.js  # Cron: Trends (6시간마다)
│   └── analyze-trends.js  # 종합 분석

.env
├── GEMINI_API_KEY=xxx     # Gemini 무료 키
```

---

## 🚀 단계별 구현 (2주)

### Week 1: RSS + AI

**Day 1-2**: RSS 수집
```javascript
// 구현 완료
npm install rss-parser
```

**Day 3-4**: Gemini AI 연동
```javascript
// 1. API 키 발급 (5분)
https://makersuite.google.com/app/apikey

// 2. 구현
npm install @google/generative-ai
```

**Day 5-7**: AI 기반 종목 추출 + 감성 분석

---

### Week 2: Google Trends + 통합

**Day 8-9**: Google Trends 연동
```javascript
npm install google-trends-api
```

**Day 10-11**: 트렌드 점수 계산

**Day 12-13**: UI 통합

**Day 14**: 테스트 + 배포

---

## 💻 즉시 실행 가능한 예제

### 1. Gemini API 테스트

```javascript
// test-gemini.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `
다음 뉴스 제목에서 종목명을 추출하고 감성을 분석해주세요.

"삼성전자, HBM3 양산 본격화...SK하이닉스 추격"

JSON 형식으로 답변:
{
  "stocks": ["삼성전자", "SK하이닉스"],
  "sentiment": "positive",
  "impact_score": 85
}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  console.log(response.text());
}

test();
```

**실행**:
```bash
# 1. Gemini API 키 발급
# https://makersuite.google.com/app/apikey

# 2. .env에 추가
echo "GEMINI_API_KEY=your_key_here" >> .env

# 3. 패키지 설치
npm install @google/generative-ai

# 4. 테스트
node test-gemini.js
```

---

### 2. Google Trends 테스트

```javascript
// test-trends.js
const googleTrends = require('google-trends-api');

async function test() {
  // 삼성전자 검색 트렌드 (최근 7일)
  const results = await googleTrends.interestOverTime({
    keyword: '삼성전자',
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endTime: new Date(),
    geo: 'KR'
  });

  const data = JSON.parse(results);
  console.log(data.default.timelineData);
}

test();
```

**실행**:
```bash
npm install google-trends-api
node test-trends.js
```

---

## ⚠️ 주의사항

### Google Trends (비공식 API)
- **Rate Limit**: 명시적 제한 없지만, 너무 많이 호출하면 차단될 수 있음
- **대응**:
  - 종목당 하루 1회만 조회
  - 6시간 간격 Cron
  - 에러 시 24시간 대기

### Gemini API
- **무료 제한**: 월 60 requests/분, 일 1,500 requests
- **대응**:
  - 중요한 뉴스만 AI 분석 (상위 100개)
  - 배치 처리 (10개씩 묶어서)
  - 캐싱 (같은 뉴스 재분석 방지)

---

## 🎯 최종 결론

### ✅ 완전 무료로 모두 가능합니다!

**사용 스택**:
1. RSS 파싱 (무료 무제한)
2. Google Trends (무료 비공식 API)
3. Gemini AI (무료 공식 API)

**총 비용**: **$0/월**

**성능**:
- 일일 100개 종목 분석 가능
- AI 요약 + 감성 분석 포함
- 검색량 급증 감지

**제약**:
- Google Trends 안정성 (비공식 API)
- Gemini 일일 1,500 requests 제한

**추천**: 즉시 착수하여 무료로 모든 기능 구현 🚀

---

**다음 단계**:
1. Gemini API 키 발급 (5분)
2. 패키지 설치 (5분)
3. 테스트 코드 실행 (5분)
4. 본격 구현 착수 (2주)

**시작할까요?** 😊
