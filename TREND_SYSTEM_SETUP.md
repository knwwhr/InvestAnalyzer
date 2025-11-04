# 트렌드 분석 시스템 설정 가이드

## 📋 개요

Google Trends + 네이버 뉴스 + Gemini AI를 활용한 트렌드 기반 종목 분석 시스템입니다.

**완전 무료**: 모든 API가 무료 티어로 운영됩니다.

---

## 🗄️ 1단계: Supabase 데이터베이스 설정

### 1.1 Supabase 프로젝트 생성

1. https://supabase.com 접속 및 로그인
2. "New Project" 클릭
3. 프로젝트명: `investar-trends` (또는 원하는 이름)
4. 데이터베이스 비밀번호 설정
5. Region: Seoul (또는 가까운 지역)
6. 생성 완료 대기 (~2분)

### 1.2 환경변수 설정

Supabase 대시보드에서 Settings > API로 이동하여 다음 정보 복사:

```bash
# .env 파일에 추가 (이미 완료됨)
SUPABASE_URL=https://tyeemuggotmsloosvhcb.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
```

### 1.3 데이터베이스 스키마 생성

Supabase 대시보드에서:

1. SQL Editor 메뉴 클릭
2. "+ New Query" 클릭
3. `supabase-trends-schema.sql` 파일 내용 전체 복사하여 붙여넣기
4. "Run" 버튼 클릭 실행

또는 psql 클라이언트로 직접 실행:

```bash
psql postgres://postgres:[비밀번호]@[프로젝트URL]:5432/postgres < supabase-trends-schema.sql
```

### 1.4 테이블 생성 확인

SQL Editor에서 다음 쿼리 실행:

```sql
-- 테이블 생성 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('search_trends', 'news_mentions', 'stock_trend_scores');

-- 뷰 생성 확인
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('hot_issue_stocks', 'search_surge_stocks');
```

예상 결과:
- 테이블 3개: `search_trends`, `news_mentions`, `stock_trend_scores`
- 뷰 2개: `hot_issue_stocks`, `search_surge_stocks`

---

## 🔑 2단계: 네이버 API 키 발급

### 2.1 네이버 개발자 센터 가입

1. https://developers.naver.com 접속
2. 로그인 (네이버 계정 필요)
3. "Application" > "애플리케이션 등록" 클릭

### 2.2 애플리케이션 등록

**애플리케이션 정보 입력:**
- 애플리케이션 이름: `Investar Trend Analysis`
- 사용 API: **검색** 체크
- 비로그인 오픈 API 서비스 환경:
  - 웹 서비스 URL: `https://investar-xi.vercel.app`

### 2.3 API 키 복사

등록 완료 후 다음 정보 복사:

```bash
# .env 파일에 추가
NAVER_CLIENT_ID=your_client_id_here
NAVER_CLIENT_SECRET=your_client_secret_here
```

### 2.4 Vercel 환경변수 설정

Vercel 대시보드에서:

1. 프로젝트 선택 > Settings > Environment Variables
2. 다음 변수 추가:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `NAVER_CLIENT_ID`
   - `NAVER_CLIENT_SECRET`
   - `GEMINI_API_KEY` (이미 설정됨)

---

## 🤖 3단계: Gemini AI 설정

### 3.1 API 키 발급 (이미 완료)

```bash
# .env 파일에 이미 추가됨
GEMINI_API_KEY=AIzaSyABYlTUmy5v5pbtGerDWCOO3dBc532C-QE
```

### 3.2 API 활성화 확인

1. https://aistudio.google.com 접속
2. API Key 페이지에서 활성화 상태 확인
3. 5-10분 정도 기다린 후 사용 가능

---

## ⚙️ 4단계: 시스템 테스트

### 4.1 로컬 테스트

```bash
# Google Trends + RSS + Gemini AI 테스트
node test-free-apis.js
```

예상 출력:
```
✅ Google Trends API 정상 작동
✅ RSS 피드 수집 정상 작동 (또는 네이버 API 사용)
✅ Gemini AI 정상 작동
```

### 4.2 Supabase 연결 테스트

```bash
# Node.js REPL에서
node
> const supabase = require('./backend/supabaseClient')
> console.log(supabase ? '✅ 연결됨' : '❌ 연결 실패')
```

### 4.3 트렌드 수집 테스트

```bash
# Google Trends 수집 (로컬)
curl -X POST http://localhost:3001/api/trends/collect-search

# 네이버 뉴스 수집 (로컬)
curl -X POST http://localhost:3001/api/trends/collect-news

# HOT 이슈 조회
curl http://localhost:3001/api/trends/hot-issues?limit=5
```

### 4.4 Vercel 배포 후 테스트

```bash
# 프로덕션 URL로 테스트
curl https://investar-xi.vercel.app/api/trends/hot-issues?limit=5
```

---

## 📊 5단계: 자동화 설정

### 5.1 Vercel Cron 작업

`vercel.json`에 다음 Cron 작업이 설정되어 있습니다:

```json
{
  "crons": [
    {
      "path": "/api/trends/collect-search",
      "schedule": "0 */6 * * *"  // 매 6시간마다
    },
    {
      "path": "/api/trends/collect-news",
      "schedule": "30 */6 * * *"  // 매 6시간마다 (30분 간격)
    }
  ]
}
```

### 5.2 실행 스케줄

- **00:00** - Google Trends 수집
- **00:30** - 네이버 뉴스 수집
- **06:00** - Google Trends 수집
- **06:30** - 네이버 뉴스 수집
- **12:00** - Google Trends 수집
- **12:30** - 네이버 뉴스 수집
- **18:00** - Google Trends 수집
- **18:30** - 네이버 뉴스 수집

---

## 🔍 6단계: API 엔드포인트 활용

### 6.1 HOT 이슈 종목 조회

```bash
GET /api/trends/hot-issues?limit=10
```

응답:
```json
{
  "success": true,
  "count": 5,
  "hotIssues": [
    {
      "stockCode": "005930",
      "stockName": "삼성전자",
      "trendScore": 85.5,
      "grade": "S",
      "breakdown": {
        "search": { "score": 38, "surge": true },
        "news": { "score": 35, "mentions24h": 15 },
        "sentiment": { "score": 12.5 }
      }
    }
  ]
}
```

### 6.2 종목별 트렌드 점수 조회

```bash
GET /api/trends/scores?stockCode=005930
```

### 6.3 종합 추천 (트렌드 점수 통합)

```bash
GET /api/screening/recommend?limit=10
```

응답에 `trendScore` 필드가 추가되어 있습니다:
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

## 📈 7단계: 점수 계산 방식

### 7.1 트렌드 점수 (0-100점)

**검색 점수 (0-40점)**:
- 절대 검색량: 0-20점 (검색량 0-100 → 0-20점)
- 변화율: 0-20점 (0-500% → 0-20점)
- 급증 보너스: +10점 (평균 대비 3배 이상)

**뉴스 점수 (0-40점)**:
- 절대 언급량: 0-20점 (24시간 10회 = 20점)
- 증가율: 0-20점 (7일 평균 대비 3배 = 20점)

**감성 점수 (0-20점)** (Gemini AI):
- 긍정 비율 70% 이상: 20점
- 긍정+중립 80% 이상: 15점
- 그 외: (긍정비율/70) * 20점

### 7.2 종합 점수 통합

```
최종 점수 = (기술적 점수 × 0.7) + (트렌드 점수 × 0.3)
```

**HOT 이슈 배지**:
- 트렌드 점수 70점 이상 → "🔥 HOT 이슈" 배지 추가
- S등급 + HOT 이슈 → "S+" 등급 부여

---

## 💰 8단계: 비용 확인

### 8.1 완전 무료

모든 API가 무료 티어로 운영됩니다:

| 서비스 | 무료 한도 | 현재 사용량 예상 |
|--------|----------|----------------|
| Google Trends | 무료 무제한 | 매 6시간 50개 종목 = 200개/일 |
| 네이버 뉴스 API | 25,000 req/일 | 매 6시간 50개 = 200개/일 |
| Gemini AI | 1,500 req/일 | 200개/일 (뉴스 분석) |
| Supabase | 500MB DB, 2GB 전송 | ~10MB/일 |

**총 비용: $0/월**

### 8.2 사용량 모니터링

**네이버 API 사용량 확인**:
- https://developers.naver.com > 내 애플리케이션 > 통계

**Gemini API 사용량 확인**:
- https://aistudio.google.com > API 사용량

**Supabase 사용량 확인**:
- Supabase 대시보드 > Settings > Usage

---

## 🐛 문제 해결

### 문제 1: Supabase 연결 오류

```
Error: Invalid Supabase URL
```

**해결**:
1. `.env` 파일의 `SUPABASE_URL` 확인
2. Vercel 환경변수 재확인
3. `backend/supabaseClient.js` 파일 확인

### 문제 2: 네이버 API 403 오류

```
Error: 403 Forbidden
```

**해결**:
1. 네이버 개발자 센터에서 API 사용량 확인
2. 일일 한도(25,000) 초과 확인
3. Client ID/Secret 재확인

### 문제 3: Gemini API 404 오류

```
Error: models/gemini-1.5-flash is not found
```

**해결**:
1. API 활성화 후 5-10분 대기
2. https://aistudio.google.com 에서 API 키 상태 확인
3. API 활성화 재시도

### 문제 4: 트렌드 점수가 null

```json
{
  "trendScore": null
}
```

**해결**:
1. 트렌드 수집 API 먼저 실행: `POST /api/trends/collect-search`
2. Supabase 테이블에 데이터 있는지 확인
3. `stock_code` 일치 여부 확인

---

## ✅ 최종 체크리스트

- [ ] Supabase 프로젝트 생성
- [ ] Supabase 스키마 실행 완료
- [ ] 네이버 API 키 발급
- [ ] Gemini API 활성화 확인
- [ ] 환경변수 설정 (로컬 + Vercel)
- [ ] 로컬 테스트 성공
- [ ] Vercel 배포 완료
- [ ] Cron 작업 활성화
- [ ] HOT 이슈 조회 테스트
- [ ] 종합 추천 API 트렌드 점수 확인

---

## 📚 참고 문서

- **Supabase 문서**: https://supabase.com/docs
- **네이버 검색 API**: https://developers.naver.com/docs/serviceapi/search/news/news.md
- **Gemini API**: https://ai.google.dev/docs
- **Google Trends API**: https://www.npmjs.com/package/google-trends-api

---

**Last Updated**: 2025-11-04
**Version**: 1.0

**✨ "검색 트렌드 + 뉴스 + AI 감성 분석으로 화제의 종목을 먼저 발굴한다"**
