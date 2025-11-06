# Investar - AI 기반 주식 스크리닝 시스템

## 프로젝트 개요

**Investar**는 한국투자증권 OpenAPI를 활용한 거래량 기반 주식 종목 발굴 시스템입니다.

- **목적**: 거래량 지표로 급등 가능성이 높은 종목 자동 발굴
- **기술 스택**: Node.js, React (CDN), Vercel Serverless, KIS OpenAPI
- **배포 URL**: https://investar-xi.vercel.app
- **버전**: 3.3 (Critical Bug Fix - chartData 인덱싱)
- **최종 업데이트**: 2025-11-06

---

## 📊 현재 시스템 상태 (2025-11-06)

### ✅ 작동 현황
- **종목 풀**: 53개 (KOSPI + KOSDAQ, 동적 API 기반)
- **API 호출**: 240개/일 (4개 순위 API × 2시장 × 30개)
- **중복 제거율**: 78% (240개 → 53개)
- **ETF/ETN 필터링**: 15개 키워드 차단 (plus, unicorn, POST IPO 등)

### 🎯 핵심 성과
- ✅ **지표 단순화** - 6개 → 3개 카테고리로 집중
- ✅ **KIS API 통합** - 4개 순위 API 정상 작동
- ✅ **ETF 필터링 강화** - 특수 펀드/파생상품 완벽 차단
- ✅ **Vercel 배포** - Serverless 환경 최적화

---

## 🚀 핵심 기능

### 1. 🎯 종목 스크리닝 시스템

#### 📊 3개 핵심 카테고리 (2025-10-28 단순화)

**1. 🏆 종합집계**
- 모든 지표를 종합하여 점수가 높은 종목 집계
- 30점 이상 전체 표시
- 점수 내림차순 정렬

**2. 🐋 고래 감지**
- **조건**: 거래량 2.5배 이상 + 가격 3% 이상 상승
- **의미**: 기관/외국인 등 세력 매수 신호
- **특징**: 윗꼬리 30% 이상 시 경고

**3. 🤫 조용한 매집**
- **조건**: 가격 변동 <3% + 거래량 증가 >20%
- **의미**: 세력이 물량을 조용히 모으는 중
- **예측**: 1~2주 후 급등 가능성 (선행 지표)

#### 제거된 지표 (2025-10-28)

**제거 이유:**
- **🚀 탈출 속도**: 가격 지표 (저항선 돌파는 이미 급등 후)
- **🔥 거래량 폭발**: 고래 감지와 중복
- **💧 유동성 고갈**: 타이밍 불명확 (몇 달 지속 가능)

**철학**: "적을수록 강하다" - 예측력 높은 지표만 유지

---

### 2. 📈 종합 점수 계산

```javascript
총점 =
  창의적 지표 (0-40점) * 0.4 +
  거래량 비율 (0-30점) +
  MFI (0-15점) +
  OBV 추세 (0-10점) +
  가격 모멘텀 (0-5점) +
  패턴 매칭 보너스 (0-20점) +
  과열 페널티 (-30~0점)

최종 점수: 0~100점
```

#### 추천 등급
- **S등급** (70점 이상): 🔥 최우선 매수
- **A등급** (55~69점): 🟢 적극 매수
- **B등급** (40~54점): 🟡 매수 고려
- **C등급** (30~39점): ⚪ 주목

---

### 3. 🔍 종목 풀 구성

**동적 API 기반 (53개 확보)**:
```
등락률 상승 순위: 30개 × 2시장 = 60개
+ 거래량 증가율 순위: 30개 × 2시장 = 60개
+ 거래량 순위: 30개 × 2시장 = 60개
+ 거래대금 순위: 30개 × 2시장 = 60개
= 총 240개 API 호출 → ETF 필터링 → 중복 제거 후 53개
```

**ETF/ETN 필터링 (15개 키워드)**:
```javascript
// ETF 브랜드
'ETF', 'KODEX', 'TIGER', 'KBSTAR', 'ARIRANG', 'ACE'

// 특수 펀드/파생상품
'plus', 'unicorn', 'POST', 'IPO', 'Active', '액티브',
'국채', '선물', '통안증권', '하이일드'

// 리츠/스팩/레버리지
'리츠', 'REIT', '스팩', 'SPAC', '인버스', '레버리지'
```

---

## 📡 API 엔드포인트

### 스크리닝 API

**종합집계**
```bash
GET /api/screening/recommend?market=ALL&limit=10
```

**고래 감지**
```bash
GET /api/screening/whale?market=KOSPI&limit=5
```

**조용한 매집**
```bash
GET /api/screening/accumulation?market=ALL&limit=5
```

### 🧬 거래량 DNA 시스템 (NEW - 2025-10-30)

**핵심 철학**: "과거 급등주의 거래량 패턴에서 DNA를 추출하여, 현재 시장에서 같은 패턴을 가진 종목을 찾는다"

#### DNA 추출 (Phase 1)
```bash
POST /api/patterns/volume-dna
{
  "mode": "extract",
  "stocks": [
    { "code": "005930", "startDate": "20251001", "endDate": "20251025" },
    { "code": "000660", "startDate": "20251005", "endDate": "20251025" }
  ]
}
```

**응답**:
```json
{
  "success": true,
  "mode": "extract",
  "result": {
    "commonDNA": {
      "volumeRate": {
        "avgEMA": 2.23,
        "avgRecent5d": -0.31,
        "threshold": { "emaMin": 1.134, "recent5dMin": -0.756 }
      },
      "institutionFlow": {
        "avgConsecutiveDays": 2,
        "threshold": { "minConsecutiveDays": 0 }
      }
    },
    "dnaStrength": 100,
    "basedOnStocks": 2
  }
}
```

#### 시장 스캔 (Phase 2)
```bash
POST /api/patterns/volume-dna
{
  "mode": "scan",
  "commonDNA": { ... },  // Phase 1에서 추출된 DNA
  "options": {
    "matchThreshold": 70,  // 최소 매칭 점수
    "limit": 10,           // 최대 반환 개수
    "days": 25             // 분석 기간 (최근 N일)
  }
}
```

**응답**:
```json
{
  "success": true,
  "mode": "scan",
  "result": {
    "matchedStocks": [
      {
        "stockCode": "900270",
        "stockName": "900270",
        "matchScore": 100,
        "scoreDetails": {
          "volumeRate": {
            "score": 100,
            "current": { "emaAvg": 792.09, "recent5d": 762.88 },
            "threshold": { "emaMin": 1.134, "recent5dMin": -0.756 }
          }
        },
        "pattern": {
          "volumeRate": {
            "segmented": { "trend": "accelerating" },
            "compositeScore": 734.33,
            "urgency": "low"
          }
        }
      }
    ]
  }
}
```

#### DNA 시스템 특징

**시간 가중치 분석**:
- **EMA (Exponential Moving Average)**: 지수 가중 평균 (반감기 5일)
- **구간별 분석**: 초반 20%, 중반 30%, 후반 50% 가중치
- **하이브리드 점수**: EMA 40% + 구간별 30% + 최근5일 30%

**지표**:
1. **거래량 증가율**: EMA 평균, 최근 5일 평균, 트렌드 (accelerating/mixed/decelerating)
2. **기관 순매수**: 연속 매수일, 강도 (strong/moderate/weak)
3. **외국인 순매수**: 연속 매수일, 강도

**매칭 로직**:
- 각 종목의 현재 패턴을 추출된 DNA와 비교
- 임계값 이상(기본 70점)인 종목만 반환
- 매칭 점수 내림차순 정렬

---

## 🛠️ 로컬 개발 가이드

### 환경 설정

```bash
# 1. 저장소 클론
git clone https://github.com/knwwhr/investar.git
cd investar

# 2. 의존성 설치
npm install

# 3. 환경변수 설정 (.env 파일 생성)
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret

# 4. 로컬 서버 실행
npm start
# http://localhost:3001
```

### API 테스트

```bash
# 종합집계
curl http://localhost:3001/api/screening/recommend?limit=5

# 고래 감지
curl http://localhost:3001/api/screening/whale

# 조용한 매집
curl http://localhost:3001/api/screening/accumulation
```

---

## 📁 프로젝트 구조

```
investar/
├── api/                          # Vercel Serverless Functions (12개)
│   ├── screening/
│   │   ├── recommend.js         # 종합집계
│   │   ├── [category].js        # whale, accumulation
│   │   └── hybrid.js            # 하이브리드 분석
│   ├── patterns/
│   │   ├── analyze.js           # 패턴 분석
│   │   ├── list.js              # 패턴 목록
│   │   ├── matched-stocks.js    # 패턴 매칭 종목
│   │   └── volume-dna.js        # 🧬 DNA 추출 + 스캔 (NEW)
│   ├── tracking/
│   │   └── today-signals.js     # 오늘의 신호
│   ├── comparison/
│   │   └── ab-test.js           # A/B 테스트
│   ├── backtest/
│   │   └── hybrid.js            # 백테스트
│   ├── cron/
│   │   └── update-patterns.js   # 패턴 자동 업데이트
│   └── health.js                # 헬스체크
│
├── backend/                      # 백엔드 로직
│   ├── kisApi.js                # KIS OpenAPI 클라이언트 ⭐
│   ├── screening.js             # 스크리닝 엔진
│   ├── volumeIndicators.js      # 거래량 지표
│   ├── advancedIndicators.js    # 창의적 지표
│   ├── smartPatternMining.js    # 패턴 마이닝
│   ├── hybridScoring.js         # 하이브리드 점수
│   ├── patternCache.js          # 패턴 캐시
│   └── volumeDnaExtractor.js    # 🧬 DNA 추출 엔진 (NEW)
│
├── index.html                    # React SPA 프론트엔드
├── server.js                     # 로컬 개발 서버
├── vercel.json                   # Vercel 설정
├── test-volume-dna-full.js       # 🧬 DNA 통합 테스트 (NEW)
└── CLAUDE.md                     # 이 문서
```

---

## ⚙️ 주요 설정

### Vercel 배포 설정 (vercel.json)

```json
{
  "functions": {
    "api/**/*.js": {
      "maxDuration": 60
    }
  },
  "crons": [
    {
      "path": "/api/cron/update-patterns",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 환경변수 (Vercel)

```
KIS_APP_KEY=<한국투자증권 앱 키>
KIS_APP_SECRET=<한국투자증권 앱 시크릿>
```

---

## ⚠️ 사용 시 주의사항

### 투자 주의사항

⚠️ **본 시스템은 투자 참고용 도구이며, 투자 결정의 책임은 전적으로 투자자에게 있습니다.**

1. **과열 경고 확인**: 거래량 10배 이상 종목은 조정 위험
2. **윗꼬리 주의**: 고래 감지 + 고가 대비 낙폭 30% 이상은 신중 진입
3. **분산 투자**: 상위 5~10개 종목 분산 추천
4. **손절 설정**: -5~7% 손절 기준 설정 권장

### API 사용 제한

- **KIS API 호출 제한**: 초당 20회 (안전 마진 18회 적용)
- **순위 API 제한**: 최대 30건/호출
- **Vercel Timeout**: 최대 60초

---

### 🗄️ Supabase 성과 추적 시스템 (NEW - 2025-11-03)

**핵심 철학**: \"추천했던 종목들의 실제 성과를 추적하여 시스템 신뢰도를 검증하고, 연속 급등주를 조기에 발견한다\"

#### 자동 추천 저장
```javascript
// 종합집계 조회 시 자동 저장
fetchRecommendations('all') // B등급(40점) 이상 종목만 자동 저장
```

#### 실시간 성과 조회
```bash
GET /api/recommendations/performance?days=30
```

**응답**:
```json
{
  "success": true,
  "count": 15,
  "stocks": [
    {
      "stock_code": "005930",
      "stock_name": "삼성전자",
      "recommended_price": 68000,
      "current_price": 70000,
      "current_return": 2.94,
      "consecutive_rise_days": 3,
      "is_rising": true
    }
  ],
  "statistics": {
    "winRate": 60.0,
    "avgReturn": 1.35,
    "risingCount": 4
  }
}
```

#### 핵심 기능

1. **자동 저장**: 종합집계 조회 시 B등급 이상 자동 저장
2. **일별 추적**: Vercel Cron으로 매일 16시 종가 자동 기록
3. **연속 급등주 감지**: 2일 이상 연속 상승 중인 종목 자동 표시
4. **실시간 수익률**: 추천가 대비 현재 수익률 실시간 계산
5. **등급별 성과**: S/A/B/C 등급별 승률 및 평균 수익률

#### 데이터베이스 스키마

- `screening_recommendations`: 추천 종목 이력
- `recommendation_daily_prices`: 일별 가격 추적
- `recommendation_statistics` (뷰): 종목별 성과 통계
- `overall_performance` (뷰): 전체 성과 요약

자세한 설정: `SUPABASE_SETUP.md` 참조

---

## 📚 참고 자료

### 공식 문서
- **KIS Developers**: https://apiportal.koreainvestment.com
- **Vercel Serverless**: https://vercel.com/docs/functions
- **Supabase**: https://supabase.com/docs

### GitHub 저장소
- **본 프로젝트**: https://github.com/knwwhr/investar
- **공식 샘플 코드**: https://github.com/koreainvestment/open-trading-api

---

## 📝 변경 이력

### v3.3 (2025-11-06) - 🐛 Critical Bug Fix
- 🐛 **chartData 배열 인덱싱 버그 수정** - 시스템 전체에 영향을 주는 critical 버그 발견 및 수정
  - **문제**: KIS API는 chartData를 **내림차순**(최신=0)으로 반환하지만, 코드는 오름차순을 가정
  - **증상**: `chartData[length-1]`로 항상 **가장 오래된 데이터**(9월 19일)를 최신으로 잘못 인식
  - **영향**: volumeAnalysis, advancedIndicators, backtest 모든 분석이 2개월 오래된 데이터로 작동
  - **수정 파일**:
    - `backend/volumeIndicators.js:193` - analyzeVolume() 최신 데이터 인덱스
    - `backend/advancedIndicators.js:508, 953-954` - checkOverheating(), calculateSignalFreshness()
    - `backend/backtest.js:99-101` - 백테스팅 매수/매도가 인덱스
  - **결과**: 9월 19일 → 11월 6일 최신 데이터로 정확한 분석 ✅

### v3.2 (2025-11-03) - 🗄️ Supabase 성과 추적 시스템
- ✅ Supabase 데이터베이스 연동
- ✅ 추천 종목 자동 저장 (B등급 이상)
- ✅ 실시간 성과 조회 API 구현
- ✅ 연속 급등주 감지 (2일 이상 연속 상승)
- ✅ 일별 가격 업데이트 Cron Job
- ✅ 성과 검증 탭 UI 개선
- ✅ 등급별 성과 통계 및 시각화
- 📄 SUPABASE_SETUP.md 가이드 작성

### v3.1 (2025-10-30) - 🧬 거래량 DNA 시스템
- ✅ DNA 추출 시스템 구현 (volumeDnaExtractor.js)
- ✅ 시간 가중치 분석 (EMA + 구간별 + 최근5일)
- ✅ 기관/외국인 투자자 데이터 통합
- ✅ 통합 API 엔드포인트 (extract + scan)
- ✅ 배치 처리 + 병렬 처리 최적화
- ✅ Vercel 12-function limit 준수

### v3.0 (2025-10-28) - 지표 단순화
- ✅ 카테고리 6개 → 3개 축소 (종합집계, 고래 감지, 조용한 매집)
- ✅ ETF/ETN 필터링 강화 (15개 키워드)
- ✅ Unknown 종목명 → [종목코드] 표시
- ✅ "종합 TOP 10" → "종합집계" 변경
- ❌ 제거: 탈출 속도, 거래량 폭발, 유동성 고갈

### v2.1 (2025-10-27)
- ✅ KIS API 통합 완료 (4개 순위 API)
- ✅ 거래량 증가율 API 추가
- ✅ 종목 풀 80개 확보 (67% 중복 제거)

### v2.0 (2025-10-26)
- ✅ 패턴 마이닝 시스템 통합
- ✅ 백테스팅 API 추가
- ✅ Vercel Cron 설정

### v1.0 (2025-10-25)
- ✅ 기본 스크리닝 시스템 구축
- ✅ 창의적 지표 개발
- ✅ React SPA 프론트엔드

---

**Last Updated**: 2025-11-06
**Version**: 3.3 (Critical Bug Fix - chartData Indexing)
**Author**: Claude Code with @knwwhr

**✨ "거래량이 주가에 선행한다" - DNA 기반 종목 발굴 + 실전 성과 추적**

---

## 🔧 알려진 이슈 및 해결

### ✅ 해결됨: chartData 배열 인덱싱 버그 (2025-11-06)

**문제 증상**:
- Vercel 배포 환경에서 스크리닝 API가 항상 9월 18-19일 데이터를 반환
- 로컬 환경에서는 최신 데이터(11월 6일)가 정상 작동

**원인 분석**:
```javascript
// KIS API 응답 구조 (내림차순)
chartData[0] = "20251106"  // 최신 ✅
chartData[1] = "20251105"
...
chartData[29] = "20250918" // 가장 오래됨 ❌

// 기존 코드 (잘못됨)
const latestData = chartData[chartData.length - 1];  // ❌ 9월 18일
const latestDate = chartData[chartData.length - 1].date;  // ❌ 9월 18일

// 수정된 코드 (올바름)
const latestData = chartData[0];  // ✅ 11월 6일
const latestDate = chartData[0].date;  // ✅ 11월 6일
```

**영향 범위**:
- ❌ `volumeAnalysis.current` - 항상 9월 19일 데이터 표시
- ❌ `advancedIndicators` - 과열 감지 및 신호 신선도 계산 오류
- ❌ `backtest` - 백테스팅 매수/매도가 계산 오류
- 🎯 **결과**: 모든 추천이 2개월 오래된 데이터 기반으로 부정확

**수정 결과**:
```bash
# 수정 전
"volumeAnalysis": { "current": { "date": "20250919" } }  # ❌

# 수정 후
"volumeAnalysis": { "current": { "date": "20251106" } }  # ✅
```

**교훈**:
- ⚠️ KIS API는 **내림차순** 응답 (최신 데이터가 첫 번째)
- ⚠️ 배열 인덱싱 시 API 응답 구조 명확히 확인 필요
- ⚠️ 로컬과 Vercel 환경의 데이터 일관성 테스트 필요
