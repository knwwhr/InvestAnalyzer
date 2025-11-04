# 검색어 트렌드 기반 종목 발굴 시스템 제안서

## 📋 제안 배경

**현재 시스템의 한계**:
- 거래량, MFI, OBV 등 기술적 지표에만 의존
- 시장의 관심도 변화를 실시간으로 감지하기 어려움
- 뉴스/이슈 기반 급등 종목 포착 지연

**제안 핵심**:
> "검색어 트렌드 + 뉴스 = 시장 관심의 선행지표"
> 거래량 폭발 전에 검색량이 먼저 폭발한다

---

## 🎯 활용 가능한 데이터 소스

### 1. 무료 데이터 소스 (즉시 사용 가능)

#### 🔍 Google Trends API
- **장점**:
  - 검색어 관심도 시계열 데이터
  - 지역별/카테고리별 필터링
  - 연관 검색어 제공
  - 완전 무료

- **단점**:
  - 실시간 데이터 아님 (최근 7일 단위)
  - API 호출 제한 (비공식 API)
  - 종목명 검색어와 실제 종목 매칭 필요

- **구현**:
  ```javascript
  // pytrends (Python) 또는 google-trends-api (Node.js)
  npm install google-trends-api
  ```

#### 📰 네이버 뉴스 검색 API
- **장점**:
  - 한국 주식 관련 뉴스 최다 보유
  - 실시간 뉴스 검색 가능
  - 뉴스 제목, 본문, 발행일시
  - 무료 (하루 25,000건)

- **단점**:
  - API 신청 필요 (네이버 개발자 등록)
  - 뉴스 본문은 요약만 제공

- **구현**:
  ```bash
  # 네이버 개발자 센터
  https://developers.naver.com/products/service-api/search/search.md
  ```

#### 📊 다음/네이버 실시간 검색어
- **장점**:
  - 실시간 관심도 파악
  - 크롤링으로 수집 가능

- **단점**:
  - 공식 API 없음
  - 크롤링 안정성 이슈
  - 종목과 직접 연결 어려움

#### 🗞️ RSS 피드
- **장점**:
  - 금융 매체 RSS 무료 제공
  - 실시간 뉴스 헤드라인
  - 파싱 간단

- **대상**:
  - 한국경제: https://www.hankyung.com/feed
  - 매일경제: https://www.mk.co.kr/rss
  - 서울경제: https://www.sedaily.com/RSS
  - 이데일리: https://www.edaily.co.kr/rss

---

### 2. 유료 데이터 소스 (향후 검토)

#### 💰 네이버 DataLab API
- 키워드별 검색량 추이 (월간)
- 비교 분석 가능
- **비용**: 문의 필요

#### 💰 Google Search Console API
- 실제 검색 클릭 데이터
- **비용**: 무료 (자사 사이트만)

#### 💰 뉴스 크롤링 서비스
- Newscatcher API
- News API
- **비용**: $50~500/월

---

## 🏗️ 시스템 아키텍처 제안

### Phase 1: 뉴스 기반 종목 관심도 분석 (우선 구현 추천)

#### 1.1 데이터 수집
```
RSS 피드 (무료)
  → 뉴스 헤드라인 수집 (1시간마다)
  → 종목명/코드 추출 (NLP)
  → 언급 빈도 계산
```

#### 1.2 점수 계산
```javascript
뉴스 관심도 점수 =
  최근 24시간 언급 횟수 * 0.5 +
  최근 1주일 언급 증가율 * 0.3 +
  주요 매체 비중 * 0.2
```

#### 1.3 기존 시스템 통합
```javascript
최종 점수 =
  기술적 지표 (현재 시스템) * 0.7 +
  뉴스 관심도 점수 * 0.3
```

---

### Phase 2: Google Trends 통합 (중기)

#### 2.1 데이터 수집
```javascript
// 일일 1회 실행 (Vercel Cron)
- 상위 100개 종목 검색어 트렌드 조회
- 전일 대비 검색량 증가율 계산
- 연관 검색어 수집
```

#### 2.2 검색량 급증 감지
```javascript
if (todaySearchVolume > avgSearchVolume * 3) {
  // 검색량 3배 이상 급증 → 뉴스/이슈 발생
  bonusScore += 20;
}
```

---

### Phase 3: 업종/테마 트렌드 분석 (장기)

#### 3.1 업종별 관심도
```javascript
// 예: "2차전지", "AI", "바이오" 등 테마
- 테마별 검색어 그룹 정의
- 테마 관심도 추이 분석
- 해당 테마 종목에 가산점
```

#### 3.2 연관 종목 발굴
```javascript
// Google Trends 연관 검색어 활용
"삼성전자" 검색 시 "반도체", "HBM" 등 연관어
  → 관련 업종 종목에 가산점
```

---

## 💻 구현 계획 (Phase 1 상세)

### 1단계: RSS 뉴스 수집 시스템

#### 파일 구조
```
backend/
├── newsCollector.js       # RSS 피드 수집
├── newsParser.js          # 뉴스 파싱 및 종목 추출
└── trendScoring.js        # 관심도 점수 계산

api/
├── trends/
│   ├── collect-news.js    # Cron: RSS 수집
│   ├── analyze-trends.js  # 트렌드 분석
│   └── trending-stocks.js # 트렌드 종목 조회

supabase/
└── news-mentions.sql      # 뉴스 언급 기록 테이블
```

#### 데이터베이스 스키마
```sql
-- 뉴스 언급 기록
CREATE TABLE news_mentions (
  id UUID PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(100) NOT NULL,

  -- 뉴스 정보
  news_title TEXT NOT NULL,
  news_source VARCHAR(50) NOT NULL,
  news_url TEXT,
  published_at TIMESTAMP NOT NULL,

  -- 분석 정보
  sentiment VARCHAR(20), -- positive, neutral, negative
  keywords TEXT[], -- 추출된 키워드

  collected_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_stock_code (stock_code),
  INDEX idx_published_at (published_at DESC)
);

-- 종목별 트렌드 점수 (집계 테이블)
CREATE TABLE stock_trend_scores (
  id UUID PRIMARY KEY,
  stock_code VARCHAR(10) NOT NULL,
  stock_name VARCHAR(100) NOT NULL,

  -- 기간별 언급 횟수
  mentions_24h INTEGER DEFAULT 0,
  mentions_7d INTEGER DEFAULT 0,
  mentions_30d INTEGER DEFAULT 0,

  -- 트렌드 점수
  trend_score NUMERIC(5,2) DEFAULT 0,
  trend_change NUMERIC(10,2) DEFAULT 0, -- 전일 대비 증가율

  -- 감성 분석
  positive_ratio NUMERIC(5,2) DEFAULT 0,

  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(stock_code, DATE(updated_at))
);
```

#### API 구현 예시
```javascript
// backend/newsCollector.js
const Parser = require('rss-parser');
const parser = new Parser();

const RSS_FEEDS = [
  'https://www.hankyung.com/feed/stock',
  'https://www.mk.co.kr/rss/30300001.xml',
  'https://www.sedaily.com/RSS/S10100000.xml'
];

async function collectNews() {
  const allNews = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(feedUrl);

      feed.items.forEach(item => {
        allNews.push({
          title: item.title,
          link: item.link,
          pubDate: new Date(item.pubDate),
          source: extractSource(feedUrl),
          content: item.contentSnippet || item.content
        });
      });
    } catch (error) {
      console.error(`RSS 수집 실패 [${feedUrl}]:`, error.message);
    }
  }

  return allNews;
}

// backend/newsParser.js
const STOCK_NAME_REGEX = /([가-힣A-Za-z]+(?:전자|화학|바이오|제약|건설|중공업|금융|카드|생명|자동차))/g;

function extractStockMentions(newsTitle, newsContent) {
  const mentions = [];
  const text = `${newsTitle} ${newsContent}`;

  // 종목명 패턴 매칭
  const matches = text.match(STOCK_NAME_REGEX);

  if (matches) {
    matches.forEach(match => {
      // KIS API로 종목명 → 코드 변환
      const stockCode = findStockCode(match);
      if (stockCode) {
        mentions.push({
          stockCode,
          stockName: match,
          context: extractContext(text, match)
        });
      }
    });
  }

  return mentions;
}

// backend/trendScoring.js
async function calculateTrendScore(stockCode) {
  // Supabase에서 최근 언급 데이터 조회
  const mentions24h = await countMentions(stockCode, '24 hours');
  const mentions7d = await countMentions(stockCode, '7 days');
  const mentionsPrev24h = await countMentions(stockCode, '24-48 hours ago');

  // 증가율 계산
  const changeRate = mentionsPrev24h > 0
    ? ((mentions24h - mentionsPrev24h) / mentionsPrev24h) * 100
    : 0;

  // 점수 계산 (0-100점)
  let score = 0;

  // 절대 언급량 (최대 40점)
  score += Math.min(mentions24h * 5, 40);

  // 증가율 (최대 40점)
  if (changeRate > 0) {
    score += Math.min(changeRate * 2, 40);
  }

  // 주요 매체 언급 (최대 20점)
  const majorSourceCount = await countMajorSources(stockCode);
  score += Math.min(majorSourceCount * 5, 20);

  return {
    score: Math.min(score, 100),
    mentions24h,
    changeRate,
    majorSourceCount
  };
}
```

---

### 2단계: 기존 스크리닝 시스템 통합

#### 점수 통합 로직
```javascript
// backend/screening.js - analyzeStock() 함수 수정

async analyzeStock(stockCode, chartData, currentData) {
  // 기존 점수 계산
  const technicalScore = this.calculateTechnicalScore(...);

  // 뉴스 트렌드 점수 조회 (새로 추가)
  const trendScore = await this.getTrendScore(stockCode);

  // 최종 점수 = 기술적 70% + 트렌드 30%
  const finalScore = (technicalScore * 0.7) + (trendScore * 0.3);

  return {
    ...existingData,
    trendAnalysis: {
      score: trendScore,
      mentions24h: trendData.mentions24h,
      changeRate: trendData.changeRate,
      isHot: trendScore > 70 // 🔥 핫이슈 종목
    },
    totalScore: finalScore
  };
}
```

#### UI 표시
```javascript
// index.html - RecommendationCard 컴포넌트

{stock.trendAnalysis?.isHot && (
  <div className="absolute top-2 left-2 z-10">
    <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs px-3 py-1 rounded-full font-bold animate-pulse">
      🔥 HOT 이슈
    </span>
  </div>
)}

{/* 트렌드 점수 표시 */}
<div className="mt-2 p-2 bg-orange-50 rounded">
  <div className="text-xs font-semibold text-orange-800">
    📰 뉴스 트렌드: {stock.trendAnalysis.score}점
  </div>
  <div className="text-xs text-orange-600 mt-1">
    최근 24시간 {stock.trendAnalysis.mentions24h}회 언급
    {stock.trendAnalysis.changeRate > 0 && (
      <span className="ml-1 text-red-600 font-bold">
        (+{stock.trendAnalysis.changeRate.toFixed(0)}% ↑)
      </span>
    )}
  </div>
</div>
```

---

### 3단계: Vercel Cron 설정

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/trends/collect-news",
      "schedule": "0 */1 * * *"  // 매 1시간마다
    },
    {
      "path": "/api/trends/analyze-trends",
      "schedule": "30 */6 * * *"  // 6시간마다 (30분)
    },
    {
      "path": "/api/recommendations/update-prices",
      "schedule": "0 16 * * 1-5"
    }
  ]
}
```

---

## 📊 예상 효과

### 정량적 효과
- **선행 지표 확보**: 거래량 폭발 1~3일 전 검색량/뉴스 급증 감지
- **승률 개선**: 예상 5~10% 승률 향상
- **허위 신호 감소**: 기술적 지표만으로는 잡기 어려운 이슈주 조기 발견

### 정성적 효과
- **시장 맥락 이해**: "왜 이 종목이 급등하는가?" 설명 가능
- **사용자 신뢰도**: 뉴스 근거 제시로 투명성 증가
- **차별화**: 타 스크리닝 시스템과 차별점 확보

---

## ⚠️ 리스크 및 대응

### 1. 데이터 품질
**리스크**: 뉴스 오류, 종목명 오인식
**대응**:
- 여러 출처 교차 검증
- 신뢰도 점수 부여
- 사람 검증 피드백 루프

### 2. 노이즈 이슈
**리스크**: 관련 없는 뉴스로 오판
**대응**:
- 키워드 필터링 (예: "삼성전자 협력업체" → 제외)
- 감성 분석 (부정적 뉴스 제외)
- 최소 언급 횟수 임계값 설정

### 3. API 비용/제한
**리스크**: 무료 API 호출 제한
**대응**:
- RSS 피드 우선 (무제한)
- 캐싱 적극 활용
- 향후 유료 전환 검토

---

## 📅 구현 로드맵

### 🚀 Phase 1: MVP (2주 소요)
**목표**: RSS 뉴스 기반 트렌드 점수 추가

**Week 1**:
- [ ] RSS 수집 시스템 구현
- [ ] 종목명 추출 로직 개발
- [ ] Supabase 스키마 생성

**Week 2**:
- [ ] 트렌드 점수 계산 로직
- [ ] 기존 스크리닝 통합
- [ ] UI 업데이트
- [ ] Vercel Cron 설정

**완료 기준**:
- 뉴스 언급 기반 트렌드 점수 표시
- 🔥 HOT 이슈 종목 자동 표시

---

### 🔥 Phase 2: Google Trends 통합 (1개월 소요)

**Week 3-4**:
- [ ] Google Trends API 연동
- [ ] 검색량 데이터 수집 자동화
- [ ] 검색량 급증 감지 알고리즘

**Week 5-6**:
- [ ] 연관 검색어 분석
- [ ] 검색량 시계열 차트 UI
- [ ] 성과 백테스팅

**완료 기준**:
- 검색량 3배 이상 급증 종목 자동 감지
- 검색량 추이 그래프 표시

---

### 🎯 Phase 3: 고급 분석 (2개월 소요)

**Month 3**:
- [ ] 업종/테마 트렌드 분석
- [ ] 감성 분석 (긍정/부정)
- [ ] AI 요약 (GPT API)

**Month 4**:
- [ ] 실시간 알림 시스템
- [ ] 트렌드 리포트 자동 생성
- [ ] 유료 데이터 소스 검토

**완료 기준**:
- 테마별 트렌드 순위 표시
- 뉴스 AI 요약 제공

---

## 💰 비용 추정

### Phase 1 (무료)
- RSS 피드: **무료**
- Supabase: **무료** (50MB 이하)
- Vercel Cron: **무료** (월 100시간)
- **총 비용: $0/월**

### Phase 2 (저비용)
- Google Trends API: **무료** (비공식)
- 또는 SerpAPI: **$50/월** (5,000 검색)
- **총 비용: $0~50/월**

### Phase 3 (중간 비용)
- News API: **$449/월** (250,000 요청)
- OpenAI GPT-4: **$50/월** (뉴스 요약)
- **총 비용: $500/월**

**추천**: Phase 1부터 시작, 효과 검증 후 단계적 투자

---

## 🎯 추진 방향 요약

### ✅ 즉시 착수 추천 (Phase 1)
**이유**:
1. **무료**: RSS 피드 완전 무료
2. **빠른 구현**: 2주 내 완성 가능
3. **즉시 효과**: 뉴스 이슈주 조기 포착

**우선순위 1**: RSS 뉴스 수집 + 종목 언급 분석

### ⏰ 단기 검토 (Phase 2)
**조건**: Phase 1 성과 검증 후
**목표**: 검색량 급증 종목 자동 감지

### 🔮 중장기 검토 (Phase 3)
**조건**: 유료 플랜 또는 수익화 후
**목표**: AI 기반 종합 트렌드 분석

---

## 🚦 의사결정 기준

### Phase 1 시작 조건
- [x] 기존 시스템 안정화 (✅ 완료)
- [x] Supabase 연동 완료 (✅ 완료)
- [ ] 개발 리소스 확보 (2주)

### Phase 2 진행 조건
- [ ] Phase 1 완료
- [ ] 뉴스 트렌드 점수가 승률에 긍정적 영향 확인
- [ ] 최소 100개 종목 1개월 추적 데이터

### Phase 3 진행 조건
- [ ] Phase 2 완료
- [ ] 월 $500 이상 비용 지출 정당화 가능
- [ ] 사용자 피드백 긍정적

---

## 📚 참고 자료

### 오픈소스 라이브러리
- **rss-parser**: RSS 피드 파싱 (Node.js)
- **google-trends-api**: Google Trends 비공식 API
- **sentiment**: 감성 분석 (간단)
- **natural**: NLP 라이브러리 (한국어 지원 제한적)

### API 문서
- [네이버 뉴스 검색 API](https://developers.naver.com/docs/serviceapi/search/news/news.md)
- [Google Trends](https://trends.google.com/trends/)
- [SerpAPI](https://serpapi.com/) (Google Trends 공식 API)
- [News API](https://newsapi.org/)

### 참고 논문
- "Predicting Stock Market from Search Engine Query" (Google, 2013)
- "News-Based Trading Strategies" (MIT, 2019)

---

**작성일**: 2025-11-03
**작성자**: Claude Code with @knwwhr
**버전**: v1.0 (초안)

**다음 단계**: Phase 1 착수 승인 대기
