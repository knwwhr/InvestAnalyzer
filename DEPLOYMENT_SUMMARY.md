# Investar 트렌드 시스템 배포 완료 🎉

## 배포 정보

- **배포 일시**: 2025-11-04
- **배포 URL**: https://investar-xi.vercel.app
- **버전**: v3.3 (Trend Analysis System)
- **상태**: ✅ 배포 완료

---

## ✅ 완료된 작업

### 1. 데이터베이스 설정
- [x] Supabase 프로젝트: `investar` (tyeemuggotmsloosvhcb)
- [x] 트렌드 테이블 3개 생성
  - `search_trends` - Google Trends 검색량
  - `news_mentions` - 네이버 뉴스 언급
  - `stock_trend_scores` - 종합 트렌드 점수
- [x] 뷰 2개 생성
  - `hot_issue_stocks` - HOT 이슈 종목
  - `search_surge_stocks` - 검색량 급증 종목

### 2. API 키 설정
- [x] 네이버 검색 API
  - Client ID: `0zGU7N0ZiTachrSyy5rS`
  - Client Secret: `QcExsPzdXP`
  - 무료 한도: 25,000 requests/일
- [x] Google Gemini AI
  - API Key: `AIzaSyABYlTUmy5v5pbtGerDWCOO3dBc532C-QE`
  - 무료 한도: 1,500 requests/일
- [x] Supabase
  - URL: `https://tyeemuggotmsloosvhcb.supabase.co`
  - Anon Key: 설정 완료

### 3. Vercel 환경변수
- [x] `NAVER_CLIENT_ID` → Production
- [x] `NAVER_CLIENT_SECRET` → Production
- [x] `GEMINI_API_KEY` → (이미 설정됨)
- [x] `SUPABASE_URL` → (이미 설정됨)
- [x] `SUPABASE_ANON_KEY` → (이미 설정됨)

### 4. API 최적화
- [x] 20개 API → 12개로 축소 (Vercel 무료 플랜 제한)
- [x] 삭제된 API
  - `/api/comparison/ab-test.js`
  - `/api/backtest/hybrid.js`
  - `/api/tracking/today-signals.js`
  - `/api/screening/hybrid.js`
- [x] 트렌드 API 5개 → 1개 통합
  - `/api/trends/index.js` (action 파라미터로 구분)

### 5. Cron 작업 설정
- [x] 5개 → 2개로 축소 (Vercel 무료 플랜 제한)
- [x] 자동 실행 (2개)
  - **09:00** - 패턴 업데이트
  - **16:00** - 추천 가격 업데이트 (평일만)
- [x] 수동 실행 (3개)
  - Google Trends 수집
  - 네이버 뉴스 수집
  - Gemini AI 감성 분석

---

## 📊 API 엔드포인트

### 기존 스크리닝 API (정상 작동 ✅)

```bash
# 종합 추천
GET https://investar-xi.vercel.app/api/screening/recommend?limit=10

# 카테고리별
GET https://investar-xi.vercel.app/api/screening/whale
GET https://investar-xi.vercel.app/api/screening/accumulation
```

### 트렌드 API (신규 추가)

#### 📈 조회 (GET)

```bash
# HOT 이슈 종목 (트렌드 70점 이상)
GET https://investar-xi.vercel.app/api/trends?action=hot-issues&limit=10

# 특정 종목 트렌드 점수
GET https://investar-xi.vercel.app/api/trends?action=scores&stockCode=005930

# 점수 범위 필터링
GET https://investar-xi.vercel.app/api/trends?action=scores&minScore=70
```

#### 🔄 수집 (POST - 수동 실행)

```bash
# Google Trends 수집
POST https://investar-xi.vercel.app/api/trends?action=collect-search

# 네이버 뉴스 수집
POST https://investar-xi.vercel.app/api/trends?action=collect-news

# Gemini AI 감성 분석
POST https://investar-xi.vercel.app/api/trends?action=analyze-sentiment
```

---

## 🚀 사용 방법

### 1. 첫 실행: 트렌드 데이터 수집

처음에는 Supabase에 데이터가 없으므로 수동으로 수집해야 합니다:

```bash
# 1단계: Google Trends 수집 (2-3분 소요)
curl -X POST "https://investar-xi.vercel.app/api/trends?action=collect-search"

# 2단계: 네이버 뉴스 수집 (20-30초 소요)
curl -X POST "https://investar-xi.vercel.app/api/trends?action=collect-news"

# 3단계: Gemini AI 감성 분석 (30-60초 소요)
curl -X POST "https://investar-xi.vercel.app/api/trends?action=analyze-sentiment"
```

### 2. HOT 이슈 조회

데이터 수집 후 조회 가능:

```bash
# 상위 10개 HOT 이슈
curl "https://investar-xi.vercel.app/api/trends?action=hot-issues&limit=10"
```

### 3. 기존 추천 시스템 (트렌드 통합)

기존 추천 API에 트렌드 점수가 자동 포함됩니다:

```bash
curl "https://investar-xi.vercel.app/api/screening/recommend?limit=5"
```

응답에 `trendScore` 필드 포함:
```json
{
  "stockCode": "005930",
  "totalScore": 78.5,  // 기술적 70% + 트렌드 30%
  "trendScore": {
    "total": 85.5,
    "search": 38,
    "news": 35,
    "sentiment": 12.5,
    "isHotIssue": true,
    "searchSurge": true
  },
  "recommendation": {
    "grade": "S+",
    "text": "🔥 HOT 이슈 - 🔥 최우선 매수"
  }
}
```

---

## 💰 비용

### 완전 무료 (월 $0)

| 서비스 | 무료 한도 | 현재 사용량 |
|--------|----------|------------|
| Google Trends | 무제한 | 하루 1회 (50개 종목) |
| 네이버 뉴스 API | 25,000 req/일 | 하루 1회 (500개 뉴스) |
| Gemini AI | 1,500 req/일 | 하루 1회 (300개 분석) |
| Supabase | 500MB DB | ~10MB/일 |
| Vercel | 12 Functions, 2 Crons | 사용 중 |

**총 비용: $0/월** ✅

---

## 📋 다음 단계

### 즉시 가능

1. **첫 데이터 수집** (위의 "첫 실행" 참조)
   ```bash
   curl -X POST "https://investar-xi.vercel.app/api/trends?action=collect-search"
   curl -X POST "https://investar-xi.vercel.app/api/trends?action=collect-news"
   curl -X POST "https://investar-xi.vercel.app/api/trends?action=analyze-sentiment"
   ```

2. **HOT 이슈 확인**
   ```bash
   curl "https://investar-xi.vercel.app/api/trends?action=hot-issues&limit=10"
   ```

3. **기존 추천에서 트렌드 확인**
   ```bash
   curl "https://investar-xi.vercel.app/api/screening/recommend?limit=5"
   ```

### 향후 개선 (선택)

- [ ] 자동 수집 스케줄러 (GitHub Actions 또는 외부 Cron)
- [ ] UI 대시보드에 HOT 이슈 배지 표시
- [ ] 트렌드 히스토리 차트
- [ ] 실시간 알림 (텔레그램/이메일)

---

## 🐛 문제 해결

### 트렌드 API 에러

**증상**: `FUNCTION_INVOCATION_FAILED` 에러

**원인**: Supabase에 데이터가 없음

**해결**: 위의 "첫 실행" 단계로 데이터 수집

### Gemini API 404 에러

**증상**: `models/gemini-1.5-flash is not found`

**원인**: API 활성화 후 5-10분 대기 필요

**해결**: 10분 후 재시도

### 네이버 API 403 에러

**증상**: `403 Forbidden`

**원인**: 일일 한도(25,000) 초과 또는 API 키 오류

**해결**:
1. 네이버 개발자 센터에서 사용량 확인
2. API 키 재확인

---

## 📚 참고 문서

- `TREND_SYSTEM_SETUP.md` - 시스템 설정 가이드
- `TREND_IMPLEMENTATION_SUMMARY.md` - 구현 완료 보고서
- `supabase-trends-schema.sql` - 데이터베이스 스키마

---

**마지막 업데이트**: 2025-11-04
**배포 버전**: v3.3
**상태**: ✅ 프로덕션 배포 완료

**다음 작업**: 첫 데이터 수집 실행 → HOT 이슈 확인
