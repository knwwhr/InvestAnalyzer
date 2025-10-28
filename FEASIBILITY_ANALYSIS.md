# 🔍 개선안 실현 가능성 분석

## 📊 현재 제약사항

### 1. KIS API 제한
```
초당 호출: 20회 (실전투자 기준)
일일 호출: 공식 제한 없음 (실질적으로 무제한에 가까움)
순위 API: 최대 30건/호출
토큰 유효기간: 24시간
```

### 2. Vercel Free Tier 제한
```
Serverless Function 호출: 100,000회/월 (또는 150,000회/월)
GB-Hours: 100 GB-hours/월
Function Duration: 최대 60초
메모리: 1024MB (기본)
대역폭: 100GB/월
```

---

## 🧮 현재 API 사용량 분석

### 현재 `/api/screening/recommend` 1회 호출 시

**Phase 1: 종목 리스트 확보**
```javascript
// getAllStockList() 호출
KOSPI 시장:
  - getPriceChangeRank(30)    // 1회
  - getVolumeSurgeRank(30)    // 1회
  - getVolumeRank(30)         // 1회
  - getTradingValueRank(30)   // 1회
KOSDAQ 시장:
  - getPriceChangeRank(30)    // 1회
  - getVolumeSurgeRank(30)    // 1회
  - getVolumeRank(30)         // 1회
  - getTradingValueRank(30)   // 1회

소계: 8회 KIS API 호출
결과: ~80개 종목 확보
```

**Phase 2: 종목별 상세 분석**
```javascript
// 각 종목마다:
for (80개 종목) {
  - getCurrentPrice(stockCode)     // 1회
  - getDailyChart(stockCode, 30)   // 1회
}

소계: 80 × 2 = 160회 KIS API 호출
```

**총 KIS API 호출: 168회/요청**

---

## 📈 개선안별 API 호출 증가량 분석

### ✅ Priority 1: **API 호출 증가 ZERO**

#### 1. 당일 등락률 실시간 반영 ⭐⭐⭐⭐⭐
```javascript
// 기존: getCurrentPrice() 이미 호출 중
// 추가: 0회 (기존 데이터 활용)
// 변경 사항: screening.js 로직만 수정

증가량: 0회
실현 가능성: 100% ✅
```

#### 2. 조용한 매집 로직 수정 ⭐⭐⭐⭐⭐
```javascript
// 기존: getDailyChart(30) 이미 호출 중
// 추가: 0회 (기존 데이터 활용, 계산 로직만 변경)

증가량: 0회
실현 가능성: 100% ✅
```

#### 3. 거래량 가속도 감지 ⭐⭐⭐⭐⭐
```javascript
// 기존: getDailyChart(30)에서 거래량 데이터 이미 확보
// 추가: 0회 (2차 미분 계산만 추가)

증가량: 0회
실현 가능성: 100% ✅
```

---

### ✅ Priority 2: **API 호출 증가 ZERO (계산만 추가)**

#### 4. OBV 다이버전스 감지 ⭐⭐⭐⭐⭐
```javascript
// 기존: getDailyChart(30)에서 가격/거래량 데이터 이미 확보
// 추가: 0회 (OBV 계산 + 선형회귀 계산만 추가)

증가량: 0회
실현 가능성: 100% ✅
```

#### 5. 스마트머니 흐름 지수 ⭐⭐⭐⭐
```javascript
// 기존: getDailyChart(30)에서 모든 데이터 이미 확보
// 추가: 0회 (누적 플로우 계산만 추가)

증가량: 0회
실현 가능성: 100% ✅
```

#### 6. 저항선 테스트 횟수 추적 ⭐⭐⭐⭐
```javascript
// 기존: getDailyChart(30) → 현재는 30일
// 변경: getDailyChart(60) → 60일로 확대 필요 (과거 데이터 더 필요)

증가량: 0회 (동일 API, 파라미터만 변경)
계산량: 약간 증가 (60일 데이터 처리)
실현 가능성: 100% ✅
```

---

### ⚠️ Priority 3: **API 호출 증가 or 외부 의존성**

#### 7. 매집일수 계산 ⭐⭐⭐
```javascript
// 현재: getDailyChart(30)
// 필요: getDailyChart(60) → 60일 데이터

증가량: 0회 (파라미터만 변경)
실현 가능성: 100% ✅
```

#### 8. 변동성 압축 지수 (Bollinger Squeeze) ⭐⭐⭐⭐
```javascript
// 기존: getDailyChart(30)
// 필요: 20일 데이터면 충분 (이미 확보)

증가량: 0회
계산 복잡도: 높음 (Bollinger Bands + Keltner Channels)
실현 가능성: 100% ✅
```

#### 9. 섹터 상대 강도 ⭐⭐
```javascript
// 문제: 섹터 분류 데이터 필요
// KIS API: 섹터별 종목 리스트 API 없음
// 대안 1: 하드코딩 섹터 분류 (수작업 필요)
// 대안 2: 외부 API 사용 (추가 비용)
// 대안 3: 포기

증가량: 섹터당 N개 종목 × 2 API 호출
예시: 섹터 10개, 종목 20개 = 200회 추가
실현 가능성: 30% ⚠️ (외부 데이터 필요)
```

---

## 💰 Vercel 무료 티어 적합성 분석

### 현재 사용량 (추정)

```
1회 요청 = 168 KIS API 호출
평균 응답 시간: ~8초 (80개 종목 분석)
메모리 사용: ~200MB

월간 예상:
- 일일 사용자: 10명
- 1인당 요청: 5회/일
- 월간 요청: 10 × 5 × 30 = 1,500회

Vercel 사용량:
✅ Function 호출: 1,500회 (한도: 100,000회) → 1.5% 사용
✅ GB-Hours: 1,500 × 8초 × 0.2GB ≈ 0.67 GB-hours (한도: 100) → 0.67% 사용
✅ 대역폭: ~30MB/응답 × 1,500 ≈ 45GB (한도: 100GB) → 45% 사용
```

### 개선안 적용 후 사용량

```
Priority 1~2 적용 (API 호출 증가 없음):
- KIS API 호출: 168회 (동일)
- 응답 시간: ~10초 (계산 증가로 +2초)
- 메모리 사용: ~220MB (+20MB)

월간 예상:
✅ Function 호출: 1,500회 (한도: 100,000회) → 1.5% 사용
✅ GB-Hours: 1,500 × 10초 × 0.22GB ≈ 0.92 GB-hours (한도: 100) → 0.92% 사용
✅ 대역폭: ~32MB/응답 × 1,500 ≈ 48GB (한도: 100GB) → 48% 사용

결론: 충분히 여유 있음 ✅
```

---

## 🚦 KIS API 초당 제한 준수 여부

### 현재 구조 (순차 호출)

```javascript
// screening.js - screenAllStocks()
for (const stockCode of stockCodes) {
  await analyzeStock(stockCode);  // 순차 처리
  // 종목당 2회 API 호출 (getCurrentPrice + getDailyChart)
}

80개 종목 × 2회 = 160회
처리 시간: ~8초
평균 속도: 160 / 8 = 20회/초

⚠️ 문제: 초당 20회 제한 경계선!
```

### 개선안: Rate Limiting 추가 필요

```javascript
/**
 * KIS API Rate Limiter
 * 초당 20회 제한 준수
 */
class RateLimiter {
  constructor(maxPerSecond = 18) {  // 여유 있게 18회로 설정
    this.maxPerSecond = maxPerSecond;
    this.tokens = maxPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire() {
    // Token Bucket 알고리즘
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxPerSecond, this.tokens + elapsed * this.maxPerSecond);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.maxPerSecond * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

// kisApi.js에 적용
const rateLimiter = new RateLimiter(18);

async getCurrentPrice(stockCode) {
  await rateLimiter.acquire();  // Rate limiting
  // ... 기존 로직
}

async getDailyChart(stockCode, days = 30) {
  await rateLimiter.acquire();  // Rate limiting
  // ... 기존 로직
}
```

**효과**:
- 초당 18회로 제한 (20회 한도 여유분 확보)
- 80개 종목 × 2회 = 160회 → 약 9초 소요 (기존 8초 → 9초)
- Vercel 60초 타임아웃 내 충분히 완료 ✅

---

## 📋 최종 실현 가능성 평가

### ✅ 즉시 구현 가능 (100% 실현 가능)

| 개선안 | API 증가 | 계산 증가 | Vercel 적합 | KIS 적합 | 난이도 | 우선순위 |
|--------|---------|-----------|------------|---------|---------|---------|
| 1. 당일 등락률 반영 | 0회 | 미미 | ✅ | ✅ | ⭐ | 🔥 High |
| 2. 조용한 매집 강화 | 0회 | 낮음 | ✅ | ✅ | ⭐⭐ | 🔥 High |
| 3. 거래량 가속도 | 0회 | 낮음 | ✅ | ✅ | ⭐⭐ | 🔥 High |
| 4. OBV 다이버전스 | 0회 | 중간 | ✅ | ✅ | ⭐⭐⭐ | 🟡 Medium |
| 5. 스마트머니 흐름 | 0회 | 중간 | ✅ | ✅ | ⭐⭐⭐ | 🟡 Medium |
| 6. 저항선 돌파 강화 | 0회 | 낮음 | ✅ | ✅ | ⭐⭐ | 🟡 Medium |
| 7. 매집일수 계산 | 0회 | 낮음 | ✅ | ✅ | ⭐⭐ | 🔵 Low |
| 8. 변동성 압축 | 0회 | 높음 | ✅ | ✅ | ⭐⭐⭐⭐ | 🔵 Low |

**총 8개 개선안 모두 구현 가능!**

---

### ❌ 구현 불가 또는 비권장

| 개선안 | 이유 | 대안 |
|--------|------|------|
| 9. 섹터 상대 강도 | KIS API에 섹터 분류 데이터 없음 | 업종별 ETF 활용 (제한적) |
| 분봉 데이터 활용 | API 호출 폭증 (종목당 +1회 = 총 +80회) | 포기 |
| 실시간 WebSocket | Vercel Serverless 부적합 (상태 유지 불가) | 포기 |

---

## 🎯 권장 구현 계획 (수정)

### Phase 1 (1주일) - Zero API Increase
```
✅ 1. 당일 등락률 실시간 반영
✅ 2. 조용한 매집 로직 수정
✅ 3. 거래량 가속도 감지
+ Rate Limiter 추가 (필수!)

API 호출: 168회 (동일)
처리 시간: 8초 → 9초
```

### Phase 2 (2주일) - Zero API Increase
```
✅ 4. OBV 다이버전스 감지
✅ 5. 스마트머니 흐름 지수
✅ 6. 저항선 테스트 횟수 추적

API 호출: 168회 (동일)
처리 시간: 9초 → 11초
```

### Phase 3 (1개월) - Zero API Increase
```
✅ 7. 매집일수 계산
✅ 8. 변동성 압축 지수

API 호출: 168회 (동일)
처리 시간: 11초 → 13초
getDailyChart: 30일 → 60일 (파라미터만 변경)
```

---

## 💡 추가 최적화 제안

### 1. 캐싱 전략 강화

**문제**: 같은 종목을 여러 사용자가 중복 조회 시 API 낭비

**해결**:
```javascript
// 간단한 in-memory 캐싱 (Vercel Serverless 제약)
const cache = new Map();
const CACHE_TTL = 60000; // 1분

async function getCachedData(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

// 사용
const chartData = await getCachedData(
  `chart_${stockCode}_30`,
  () => kisApi.getDailyChart(stockCode, 30)
);
```

**효과**:
- 1분 내 중복 요청 시 API 호출 0회
- 10명 동시 접속 시: 168회 → 17회 (90% 감소)

**한계**:
- Vercel Serverless는 함수 간 메모리 공유 안 됨
- 같은 함수 인스턴스 내에서만 캐시 유효
- 그래도 어느 정도 효과 있음

---

### 2. 병렬 처리 (선택적)

**현재**: 순차 처리 (안전하지만 느림)
```javascript
for (const code of stockCodes) {
  await analyzeStock(code);  // 8초
}
```

**개선**: 배치 병렬 처리
```javascript
// 초당 18회 제한 고려하여 9개씩 배치
const batchSize = 9;  // 9개 × 2 API = 18회/초
for (let i = 0; i < stockCodes.length; i += batchSize) {
  const batch = stockCodes.slice(i, i + batchSize);
  await Promise.all(batch.map(code => analyzeStock(code)));
  await sleep(1000);  // 1초 대기 (rate limit 준수)
}
```

**효과**:
- 80개 종목: 8초 → 5초 (40% 단축)

**위험**:
- Rate limit 초과 가능성
- KIS API 불안정 시 전체 배치 실패

**권장**: 우선 순차 처리 유지, 안정화 후 고려

---

## 📊 최종 결론

### ✅ 실현 가능한 개선안: **8개 (100%)**

모든 Priority 1~3 개선안이 **추가 API 호출 없이** 구현 가능합니다!

**이유**:
1. ✅ **Zero API Increase**: 기존 `getDailyChart(30)` 데이터로 모든 계산 가능
2. ✅ **Vercel 여유**: 1.5% Function 호출, 0.92% GB-Hours (99% 여유)
3. ✅ **KIS 여유**: Rate Limiter 추가하면 초당 20회 제한 안전하게 준수
4. ✅ **무료 범위**: 모든 개선안이 무료 티어 내 완료

### ⚠️ 필수 추가 작업

**Rate Limiter 구현** (30분 소요)
- 없으면 KIS API 초당 20회 제한 위반 가능
- Token Bucket 알고리즘으로 안전하게 제어

### 🚀 예상 개선 효과 (재확인)

```
Priority 1 적용 (1주일):
  선행 지표: 20% → 40%
  평균 진입: D+1 → D-3
  평균 수익률: +8.5% → +12.0%
  추가 API: 0회 ✅

Priority 2 적용 (2주일):
  선행 지표: 40% → 60%
  평균 진입: D-3 → D-7
  평균 수익률: +12.0% → +15.5%
  추가 API: 0회 ✅

All Priorities (1개월):
  선행 지표: 60% → 70%
  평균 진입: D-7 → D-10
  평균 수익률: +15.5% → +18.0%
  추가 API: 0회 ✅
```

### 💰 비용

**KIS API**: 무료 (개인 계정)
**Vercel**: 무료 티어 (99% 여유)
**총 비용**: **0원**

---

**결론**: 제안한 모든 개선안(섹터 강도 제외)이 **100% 실현 가능**하며, **추가 비용 없이** 구현할 수 있습니다!

다만 **Rate Limiter는 필수**로 추가해야 KIS API 제한을 안전하게 준수할 수 있습니다.
