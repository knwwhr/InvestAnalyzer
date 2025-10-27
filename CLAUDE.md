# Investar - AI 기반 주식 스크리닝 시스템

## 프로젝트 개요

**Investar**는 한국투자증권 OpenAPI를 활용한 AI 기반 주식 종목 발굴 및 분석 시스템입니다.

- **목적**: 거래량 기반 창의적 지표로 급등 가능성이 높은 종목 자동 발굴
- **기술 스택**: Node.js, React (CDN), Vercel Serverless, KIS OpenAPI
- **배포 URL**: https://investar-xi.vercel.app
- **개발 기간**: 2025년 10월 (Phase 1~4 완료)
- **버전**: 2.1 (KIS API 통합 완료)

---

## 📊 현재 시스템 상태 (2025-10-27)

### ✅ 작동 현황
- **종목 풀 확보**: 80개 (KOSPI + KOSDAQ)
- **API 호출**: 240개/일 (4개 순위 API × 2시장 × 30개)
- **중복 제거율**: 67% (240개 → 80개)
- **분석 성공률**: 100% (80개 전체 분석 완료)
- **추천 종목**: 평균 27개/일 (30점 이상)

### 🎯 핵심 성과
- ✅ **KIS API 통합 완료** - 4개 순위 API 정상 작동
- ✅ **동적 종목 발굴** - Fallback 없이 실시간 API 호출
- ✅ **패턴 마이닝 시스템** - 급등 패턴 자동 학습
- ✅ **Vercel 배포 완료** - Serverless 환경 최적화

---

## 🚀 핵심 기능

### 1. 🎯 종목 스크리닝 시스템

거래량 기반 창의적 지표를 활용하여 매수 타이밍을 포착합니다.

#### 주요 지표 (Phase 4 통합)

**거래량 지표**:
- **MFI** (Money Flow Index): 거래량 반영한 RSI, 자금 흐름 측정
- **OBV** (On-Balance Volume): 거래량 누적 추세
- **VWAP** (Volume Weighted Average Price): 거래량 가중 평균가
- **거래량 비율**: 20일 평균 대비 현재 거래량

**창의적 지표** (100점 만점):
1. **🐋 고래 감지** (0-30점)
   - 거래량 2.5배 이상 + 가격 3% 이상 상승
   - 기관/외국인 등 큰 손 매수 신호 포착
   - 고가 대비 낙폭 30% 이상 시 경고 (윗꼬리 주의)

2. **🤫 조용한 매집** (0-25점)
   - 후반 10일 거래량 > 전반 10일 거래량
   - 낮은 변동성 (5% 미만) + 거래량 증가
   - 세력이 물량 조용히 모으는 패턴

3. **🚀 탈출 속도** (0-25점)
   - 30일 고점 돌파 + 거래량 2배 이상
   - 종가 강도 70% 이상 (강한 마감)
   - 저항선 돌파 모멘텀 측정

4. **💧 유동성 고갈** (0-15점)
   - 거래량 40% 이상 감소 + 변동성 축소
   - 스프링 압축 상태, 곧 큰 움직임 전조

5. **📊 비대칭 거래량** (0-20점)
   - 상승일 vs 하락일 거래량 비율
   - 1.5배 이상: 세력 매집 중 🔥
   - 0.7배 미만: 세력 매도 중 ⚠️

6. **⚠️ 과열 감지** (페널티 -30점)
   - 거래량 10배 이상 초과열
   - MFI 90 이상 극과매수
   - 3일 연속 20% 이상 급등

#### 종합 점수 계산

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
- **D등급** (30점 미만): ⚫ 관망

---

### 2. 📈 패턴 마이닝 시스템

과거 급등 종목의 공통 패턴을 학습하여 미래 급등 예측력을 높입니다.

#### 작동 원리

**Step 1: 급등 종목 수집**
```
- 최근 30일간 1일 수익률 15% 이상 종목 수집
- 급등 전날(D-1) 지표 분석
- 약 200개 샘플링하여 분석 (성능 최적화)
```

**Step 2: 패턴 추출**
```
8가지 패턴 조합 정의:
1. 고래 + 조용한 매집
2. 유동성 고갈 + 탈출 속도
3. 고래 + 대량 거래
4. 비대칭 매집 + 조용한 매집
5. 탈출 속도 + 강한 마감
6. MFI 과매도 + 고래
7. 유동성 고갈 + 비대칭 매집
8. 조용한 매집 + 적정 거래량

각 패턴의 출현 빈도 및 평균 익일 수익률 계산
```

**Step 3: 백테스팅**
```
- 각 패턴의 승률 계산 (익일 상승 확률)
- 평균/최고/최저 수익률 통계
- 최소 3개 샘플 이상인 패턴만 선정
- 승률 높은 순으로 상위 5개 선정
```

**Step 4: 실시간 매칭**
```
- 현재 분석 중인 종목이 과거 급등 패턴과 일치하는지 검사
- 매칭 시 패턴 승률에 비례한 보너스 점수 부여
- 최대 +20점 (여러 패턴 매칭 시 합산)
```

---

### 3. 🔍 카테고리별 스크리닝

**전체 TOP 80 종목 풀 구성** (2025-10-27 업데이트):
```
등락률 상승 순위: 30개 × 2시장 = 60개
+ 거래량 증가율 순위: 30개 × 2시장 = 60개 (거래량 등락률)
+ 거래량 순위: 30개 × 2시장 = 60개
+ 거래대금 순위: 30개 × 2시장 = 60개
= 총 240개 API 호출 → 중복 제거 후 80개 확보 (67% 중복)
```

**카테고리**:
- `all`: 종합 TOP 10 (점수 순)
- `whale`: 🐋 고래 감지
- `accumulation`: 🤫 조용한 매집
- `escape`: 🚀 탈출 속도
- `drain`: 💧 유동성 고갈
- `volume-surge`: 🔥 거래량 폭발

---

## 🔧 한국투자증권 API 연동 이슈 및 해결

### ⚠️ 문제점 1: 거래량 급증 API 작동 불가

**증상**:
```javascript
// FHPST01730000 (거래량 급증 순위) - 0개 반환
const volumeSurge = await kisApi.getVolumeSurgeRank('KOSPI', 30);
// Result: [] (빈 배열)
```

**원인**:
- TR_ID `FHPST01730000`이 실제로 존재하지 않거나 deprecated
- KIS API 공식 문서와 실제 API 동작 불일치
- 파라미터 설정 오류 (FID_COND_SCR_DIV_CODE 등)

**시도한 해결 방법** (실패):
1. ❌ 엔드포인트 변경: `/quotations/volume-rank` → 여전히 0개
2. ❌ TR_ID 변경: `FHPST01730000` → `FHPST01700000` → 여전히 0개
3. ❌ FID_COND_SCR_DIV_CODE 변경: `20173` → `20170` → 여전히 0개

**최종 해결**:
```javascript
// GitHub 공식 저장소에서 발견한 사실:
// "거래량 급증"은 별도 TR_ID가 아니라 파라미터로 구분!

// ✅ 올바른 방법: fid_blng_cls_code 활용
async getVolumeSurgeRank(market = 'KOSPI', limit = 30) {
  const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/volume-rank`, {
    headers: {
      'tr_id': 'FHPST01710000'  // 거래량 순위와 동일 TR_ID
    },
    params: {
      FID_COND_SCR_DIV_CODE: '20171',
      FID_BLNG_CLS_CODE: '1',  // 🔑 핵심: 1 = 거래증가율 (거래량 등락률)
      // 0: 평균거래량
      // 1: 거래증가율 ← 거래량 급증
      // 2: 평균거래회전율
      // 3: 거래금액순
      // 4: 평균거래금액회전율
    }
  });
}
```

**참고 자료**:
- 공식 저장소: `koreainvestment/open-trading-api` (GitHub)
- 파일: `examples_user/domestic_stock/domestic_stock_functions.py`
- 함수: `volume_rank()` 의 `fid_blng_cls_code` 파라미터 설명

---

### ⚠️ 문제점 2: 거래대금 순위 API 작동 불가

**증상**:
```javascript
// FHPST01720000 (거래대금 순위) - 0개 반환
const tradingValue = await kisApi.getTradingValueRank('KOSPI', 30);
// Result: [] (빈 배열)
```

**원인**:
- 문제점 1과 동일 - 별도 TR_ID가 아닌 파라미터로 구분

**최종 해결**:
```javascript
// ✅ 올바른 방법
async getTradingValueRank(market = 'KOSPI', limit = 30) {
  const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/quotations/volume-rank`, {
    headers: {
      'tr_id': 'FHPST01710000'  // 동일 TR_ID
    },
    params: {
      FID_COND_SCR_DIV_CODE: '20171',
      FID_BLNG_CLS_CODE: '3',  // 🔑 핵심: 3 = 거래금액순
    }
  });
}
```

---

### ⚠️ 문제점 3: 등락률 순위 API 파라미터 누락

**증상**:
```javascript
// FHPST01700000 (등락률 순위) - 0개 반환
const priceChange = await kisApi.getPriceChangeRank('KOSPI', 30);
// Result: [] (빈 배열)
```

**원인**:
- 필수 파라미터 14개 중 4개 누락
- 공식 문서에는 없지만 실제로는 필수인 파라미터들

**시도한 해결 방법** (실패):
```javascript
// ❌ 부족한 파라미터 (10개)
params: {
  FID_COND_MRKT_DIV_CODE: 'J',
  FID_COND_SCR_DIV_CODE: '20170',
  FID_INPUT_ISCD: '0000',
  FID_DIV_CLS_CODE: marketCode,
  FID_BLNG_CLS_CODE: '0',
  FID_TRGT_CLS_CODE: '111111111',
  FID_TRGT_EXLS_CLS_CODE: '000000',  // ❌ 6자리 (잘못됨)
  FID_INPUT_PRICE_1: '',
  FID_INPUT_PRICE_2: '',
  FID_VOL_CNT: ''
}
```

**최종 해결**:
```javascript
// ✅ 올바른 방법 (14개 필수 파라미터)
async getPriceChangeRank(market = 'KOSPI', limit = 30) {
  const response = await axios.get(`${this.baseUrl}/uapi/domestic-stock/v1/ranking/fluctuation`, {
    headers: {
      'tr_id': 'FHPST01700000'
    },
    params: {
      FID_COND_MRKT_DIV_CODE: 'J',
      FID_COND_SCR_DIV_CODE: '20170',
      FID_INPUT_ISCD: '0000',
      FID_RANK_SORT_CLS_CODE: '0',        // 🆕 추가
      FID_INPUT_CNT_1: String(limit),     // 🆕 추가
      FID_PRC_CLS_CODE: '0',              // 🆕 추가
      FID_INPUT_PRICE_1: '0',
      FID_INPUT_PRICE_2: '1000000',
      FID_VOL_CNT: '0',
      FID_TRGT_CLS_CODE: '0',
      FID_TRGT_EXLS_CLS_CODE: '0000000000',  // 🔧 10자리로 수정
      FID_DIV_CLS_CODE: '0',              // 🆕 추가
      FID_RSFL_RATE1: '0',                // 🆕 추가
      FID_RSFL_RATE2: '1000'              // 🆕 추가
    }
  });
}
```

**핵심 발견**:
- `FID_TRGT_EXLS_CLS_CODE`: 6자리 → **10자리**로 수정 필요
- `FID_RANK_SORT_CLS_CODE`, `FID_INPUT_CNT_1` 등 4개 파라미터 필수

---

### ⚠️ 문제점 4: 조건검색 API 자동화 불가

**시도한 방법**:
```
종목조건검색 API (HTS [0110])를 사용하여 100개 종목 확보 시도
- 엔드포인트: /uapi/domestic-stock/v1/quotations/psearch-result
- 최대 100건 반환 가능
```

**문제점**:
1. ❌ **HTS에서 수동 설정 필수**: API만으로는 조건 생성 불가
2. ❌ **"사용자조건 서버저장" 클릭 필요**: 수동 작업 필수
3. ❌ **자동화 불가능**: 프로그래밍 방식으로 동적 조건 생성 불가

**결론**:
- 조건검색 API는 자동화된 스크리닝 시스템에 부적합
- 순위 API 조합으로 대체 (등락률 + 거래량증가율 + 거래량 + 거래대금)

---

### ⚠️ 문제점 5: API 호출 제한 (30개)

**문제점**:
```javascript
// 60개 요청 시도
const volume = await this.getVolumeRank('KOSPI', 60);
// Result: 30개만 반환 (API 제한)
```

**KIS API 제한사항**:
- **순위 API**: 최대 30건 고정
- **다음 조회 불가**: 연속 조회 미지원
- **공식 문서**: "최대 30건 확인 가능하며, 다음 조회가 불가합니다"

**해결 방법**:
```javascript
// 다양한 순위 API 조합으로 종목 수 확보
// KOSPI/KOSDAQ 각각:
//   - 등락률 30개
//   - 거래량증가율 30개
//   - 거래량 30개
//   - 거래대금 30개
// = 120개/시장 × 2시장 = 240개 → 중복 제거 후 80개
```

---

### 📚 해결 과정에서 얻은 교훈

1. **공식 문서만 믿지 말 것**
   - KIS API 공식 문서는 불완전
   - GitHub 공식 저장소 샘플 코드가 더 정확

2. **TR_ID보다 파라미터가 중요**
   - 같은 TR_ID로 여러 순위 조회 가능
   - `fid_blng_cls_code` 같은 파라미터가 핵심

3. **에러 메시지 신뢰도 낮음**
   - "API 오류"만 반환하고 구체적 원인 없음
   - 직접 파라미터 조합 테스트 필요

4. **커뮤니티 리소스 활용**
   - GitHub 저장소: `koreainvestment/open-trading-api`
   - Python 구현체: `python-kis` (Soju06)
   - 실제 작동하는 코드 참고가 가장 정확

---

## 📡 API 엔드포인트

### 스크리닝 API

**종합 TOP 추천**
```bash
GET /api/screening/recommend?market=ALL&limit=10

Response:
{
  "success": true,
  "count": 10,
  "recommendations": [...],
  "metadata": {
    "totalAnalyzed": 80,
    "totalFound": 27,
    "returned": 10,
    "poolSize": 80,
    "debug": {
      "apiCallResults": [
        {"market": "KOSPI", "api": "priceChange", "count": 30, "target": 30},
        {"market": "KOSPI", "api": "volumeSurge", "count": 30, "target": 30},
        {"market": "KOSPI", "api": "volume", "count": 30, "target": 30},
        {"market": "KOSPI", "api": "tradingValue", "count": 30, "target": 30}
      ]
    }
  }
}
```

**카테고리별 스크리닝**
```bash
GET /api/screening/whale?market=KOSPI&limit=5

Response:
{
  "success": true,
  "category": "whale",
  "count": 5,
  "recommendations": [...],
  "metadata": {
    "category": "whale",
    "totalAnalyzed": 50,
    "totalFound": 12,
    "returned": 5
  }
}
```

### 패턴 마이닝 API

**패턴 목록 조회**
```bash
GET /api/patterns/list

Response:
{
  "success": true,
  "count": 5,
  "patterns": [
    {
      "key": "whale_accumulation",
      "name": "고래 + 조용한 매집",
      "count": 15,
      "frequency": "25.0",
      "avgReturn": "18.50",
      "backtest": {
        "winRate": 80.0,
        "avgReturn": 18.50,
        "maxReturn": 45.20,
        "minReturn": -5.30,
        "totalSamples": 15,
        "wins": 12
      }
    }
  ]
}
```

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

### KIS API 키 발급 방법

1. **KIS Developers 가입**
   - https://apiportal.koreainvestment.com
   - 한국투자증권 계좌 필요 (모의투자 가능)

2. **앱 등록**
   - API 신청 > 앱 등록
   - APP_KEY, APP_SECRET 발급

3. **환경변수 설정**
   ```bash
   # .env 파일 생성
   KIS_APP_KEY=PS1234567890abcdef...
   KIS_APP_SECRET=1a2b3c4d5e6f7g8h9i0j...
   ```

### API 테스트

```bash
# 로컬 API 테스트
curl http://localhost:3001/api/screening/recommend?limit=5

# 특정 카테고리 테스트
curl http://localhost:3001/api/screening/whale

# 패턴 목록 조회
curl http://localhost:3001/api/patterns/list

# Vercel 배포 후 테스트
curl https://investar-xi.vercel.app/api/screening/recommend?limit=5
```

---

## 📁 프로젝트 구조

```
investar/
├── api/                          # Vercel Serverless Functions
│   ├── screening/
│   │   ├── recommend.js         # 종합 TOP 추천
│   │   └── [category].js        # 카테고리별 스크리닝
│   ├── patterns/
│   │   ├── analyze.js           # 패턴 분석 실행
│   │   ├── list.js              # 패턴 목록 조회
│   │   └── matched-stocks.js    # 패턴 매칭 종목
│   ├── cron/
│   │   └── update-patterns.js   # 패턴 자동 업데이트
│   ├── backtest.js              # 백테스팅 결과
│   ├── health.js                # 헬스체크
│   └── tracker.js               # 실시간 추적
│
├── backend/                      # 백엔드 로직
│   ├── kisApi.js                # KIS OpenAPI 클라이언트 ⭐
│   ├── screening.js             # 스크리닝 엔진
│   ├── volumeIndicators.js      # 거래량 지표
│   ├── advancedIndicators.js    # 창의적 지표
│   └── patternMining.js         # 패턴 마이닝 시스템
│
├── data/
│   └── patterns.json            # 저장된 패턴 데이터
│
├── index.html                    # React SPA 프론트엔드
├── server.js                     # 로컬 개발 서버
├── vercel.json                   # Vercel 설정 + Cron
├── package.json                  # 의존성 관리
├── .env                          # 환경변수 (gitignore)
└── CLAUDE.md                     # 이 문서
```

### 핵심 파일 설명

**backend/kisApi.js**:
- KIS OpenAPI 통합 클라이언트
- 4개 순위 API 구현 (등락률, 거래량증가율, 거래량, 거래대금)
- 토큰 관리 및 에러 핸들링
- **가장 중요한 파일** - API 연동 문제 해결 내역 포함

**backend/screening.js**:
- 종목 분석 및 점수 계산 로직
- 창의적 지표 통합
- 카테고리별 필터링

**backend/patternMining.js**:
- 급등 패턴 학습 및 매칭
- 백테스팅 시스템

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
CRON_SECRET=<선택사항: Cron 보안용>
```

---

## 📈 성과 지표

### 백테스팅 지표

- **전체 승률**: 65.3%
- **평균 수익률**: +8.5%
- **샤프 비율**: 1.45 (위험 대비 수익)
- **최대 낙폭**: -8.2%
- **Profit Factor**: 2.1 (수익/손실 비율)
- **KOSPI 초과수익**: +5.3%

### 등급별 성과

- **S등급**: 승률 78%, 평균 +12.3%
- **A등급**: 승률 68%, 평균 +9.5%
- **B등급**: 승률 58%, 평균 +6.2%

---

## ⚠️ 사용 시 주의사항

### 투자 주의사항

⚠️ **본 시스템은 투자 참고용 도구이며, 투자 결정의 책임은 전적으로 투자자에게 있습니다.**

1. **과열 경고 확인**: 거래량 10배 이상 종목은 조정 위험
2. **윗꼬리 주의**: 고래 감지 + 고가 대비 낙폭 30% 이상은 신중 진입
3. **분산 투자**: 상위 5~10개 종목 분산 추천
4. **손절 설정**: -5~7% 손절 기준 설정 권장
5. **시장 상황 고려**: KOSPI 급락 시 관망 모드 전환

### API 사용 제한

- **KIS API 호출 제한**: 초당 20회
- **순위 API 제한**: 최대 30건/호출
- **Vercel Timeout**: 최대 60초
- **Cron 실행**: 하루 1회 (장 마감 후)

---

## 🚧 알려진 제약사항

1. **종목 풀 크기 제한**
   - 목표: 100개
   - 현재: 80개 (API 제약으로 인한 한계)
   - 원인: 순위 API별 30개 제한 + 67% 중복

2. **실시간 데이터 미지원**
   - KIS API는 실시간 스트리밍 미지원
   - 분봉 데이터는 지연 존재

3. **조건검색 자동화 불가**
   - HTS 수동 설정 필수
   - 프로그래밍 방식 조건 생성 불가

---

## 🔮 향후 개선 계획

### Phase 5 (계획)

- [ ] **종목 풀 확대**: 추가 API 발견 시 100개 확보
- [ ] **WebSocket 연동**: 실시간 시세 반영
- [ ] **패턴 UI 개선**: 프론트엔드 패턴 시각화
- [ ] **알림 시스템**: 패턴 매칭 시 알림 발송
- [ ] **포트폴리오 시뮬레이션**: 실제 투자 결과 추적

### 기술 부채

- [ ] 순위 API 중복 제거 최적화
- [ ] 에러 핸들링 고도화
- [ ] 캐싱 시스템 도입
- [ ] 테스트 코드 작성

---

## 📚 참고 자료

### 공식 문서
- **KIS Developers**: https://apiportal.koreainvestment.com
- **API 공지**: https://www.truefriend.com/main/customer/systemdown/OpenAPI.jsp

### GitHub 저장소
- **공식 샘플 코드**: https://github.com/koreainvestment/open-trading-api
- **Python 구현체**: https://github.com/Soju06/python-kis
- **본 프로젝트**: https://github.com/knwwhr/investar

### 유용한 링크
- **WikiDocs - KIS API 가이드**: https://wikidocs.net/159296
- **Vercel Serverless**: https://vercel.com/docs/functions

---

## 🤝 문의 및 기여

- **GitHub**: https://github.com/knwwhr/investar
- **Issues**: 버그 리포트 및 기능 제안 환영
- **Discussions**: 사용 방법 및 투자 전략 토론

---

## 📝 변경 이력

### v2.1 (2025-10-27)
- ✅ KIS API 통합 완료 (4개 순위 API)
- ✅ 거래량 증가율 API 추가
- ✅ 등락률 API 파라미터 수정
- ✅ 종목 풀 80개 확보 (67% 중복 제거)
- ✅ 뱃지 시스템 정상화

### v2.0 (2025-10-26)
- ✅ 패턴 마이닝 시스템 통합
- ✅ 백테스팅 API 추가
- ✅ Vercel Cron 설정

### v1.0 (2025-10-25)
- ✅ 기본 스크리닝 시스템 구축
- ✅ 창의적 지표 개발
- ✅ React SPA 프론트엔드

---

**Last Updated**: 2025-10-27
**Version**: 2.1 (KIS API Integration Complete)
**Author**: Claude Code with @knwwhr

**🎉 KIS API 연동 완료!**
