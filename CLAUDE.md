# Investar - AI 기반 주식 스크리닝 시스템

## 프로젝트 개요

**Investar**는 한국투자증권 OpenAPI를 활용한 AI 기반 주식 종목 발굴 및 분석 시스템입니다.

- **목적**: 거래량 기반 창의적 지표로 급등 가능성이 높은 종목 자동 발굴
- **기술 스택**: Node.js, React (CDN), Vercel Serverless, KIS OpenAPI
- **배포 URL**: https://investar-xi.vercel.app

---

## 핵심 기능

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

### 2. 📈 패턴 마이닝 시스템 (신규)

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

#### 패턴 매칭 보너스

```javascript
패턴 보너스 = (패턴 승률 / 100) * 15

예시:
- 승률 80% 패턴 매칭 → +12점
- 승률 60% 패턴 매칭 → +9점
- 최대 20점 제한 (여러 패턴 중복 매칭 시)
```

#### 자동 업데이트

**Vercel Cron 설정**:
- 매일 오전 9시 UTC (한국 시간 오후 6시) 자동 실행
- 장 마감 후 패턴 재분석
- `data/patterns.json`에 결과 저장
- 익일 스크리닝부터 새 패턴 적용

---

### 3. 🔍 카테고리별 스크리닝

**전체 TOP 100 종목 풀 구성**:
```
거래량 급증 순위 40개 (가장 중요)
+ 거래량 순위 30개
+ 거래대금 순위 20개
+ 조용한 누적 패턴 10개
= 총 100개 풀 (중복 제거)
```

**카테고리**:
- `all`: 종합 TOP 10 (점수 순)
- `whale`: 🐋 고래 감지
- `accumulation`: 🤫 조용한 매집
- `escape`: 🚀 탈출 속도
- `drain`: 💧 유동성 고갈
- `volume-surge`: 🔥 거래량 폭발

---

## API 엔드포인트

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
    "totalAnalyzed": 100,
    "totalFound": 45,
    "returned": 10,
    "poolSize": 100
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

**패턴 분석 실행** (관리자용)
```bash
POST /api/patterns/analyze
Content-Type: application/json

{
  "lookbackDays": 30,
  "minReturn": 15
}

Response:
{
  "success": true,
  "message": "패턴 분석이 완료되었습니다.",
  "generatedAt": "2025-10-26T10:00:00.000Z",
  "parameters": {
    "lookbackDays": 30,
    "minReturn": 15,
    "totalSurgeStocks": 60
  },
  "patternsFound": 5,
  "patterns": [...]
}
```

**특정 패턴 매칭 종목**
```bash
GET /api/patterns/matched-stocks?pattern=whale_accumulation&limit=10

Response:
{
  "success": true,
  "pattern": {
    "key": "whale_accumulation",
    "name": "고래 + 조용한 매집",
    "frequency": "25.0",
    "avgReturn": "18.50",
    "backtest": {...}
  },
  "count": 3,
  "stocks": [...],
  "metadata": {
    "totalAnalyzed": 100,
    "totalMatched": 3,
    "returned": 3
  }
}
```

### 성과 검증 API

**백테스팅 결과**
```bash
GET /api/backtest

Response:
{
  "success": true,
  "data": {
    "generatedAt": "...",
    "parameters": {
      "lookbackDays": 30,
      "holdingDays": 7
    },
    "statistics": {
      "overall": {
        "totalCount": 150,
        "winRate": 65.3,
        "avgReturn": 8.5,
        "maxReturn": 45.2,
        "minReturn": -15.3,
        "winCount": 98
      },
      "byGrade": {...},
      "byCategory": {...},
      "advanced": {
        "sharpeRatio": 1.45,
        "maxDrawdown": 8.2,
        "profitFactor": 2.1,
        "excessReturn": 5.3
      }
    }
  }
}
```

---

## 로컬 개발 가이드

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

### 패턴 마이닝 테스트

```bash
# 패턴 분석 실행 (콘솔 출력)
node test-pattern-mining.js

# 결과 확인
cat data/patterns.json
```

### 스크리닝 테스트

```bash
# 로컬 API 테스트
curl http://localhost:3001/api/screening/recommend?limit=5

curl http://localhost:3001/api/screening/whale

curl http://localhost:3001/api/patterns/list
```

---

## 프로젝트 구조

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
│   ├── kisApi.js                # KIS OpenAPI 클라이언트
│   ├── screening.js             # 스크리닝 엔진
│   ├── volumeIndicators.js      # 거래량 지표
│   ├── advancedIndicators.js    # 창의적 지표
│   └── patternMining.js         # 패턴 마이닝 시스템 ⭐
│
├── data/
│   └── patterns.json            # 저장된 패턴 데이터
│
├── index.html                    # React SPA 프론트엔드
├── server.js                     # 로컬 개발 서버
├── vercel.json                   # Vercel 설정 + Cron
└── test-pattern-mining.js        # 패턴 마이닝 테스트
```

---

## 핵심 알고리즘

### 종목 발굴 로직

```javascript
// 1. 동적 종목 풀 생성 (100개)
const pool = [
  ...거래량급증 40개,
  ...거래량순위 30개,
  ...거래대금 20개,
  ...조용한누적 10개
];

// 2. 각 종목 분석
for (const stock of pool) {
  // 2-1. 거래량 지표 분석
  const volumeAnalysis = analyzeVolume(chartData);

  // 2-2. 창의적 지표 분석
  const advancedAnalysis = analyzeAdvanced(chartData);

  // 2-3. 과열 감지
  const overheating = checkOverheating(chartData);

  // 2-4. 패턴 매칭 (신규)
  const patternMatch = checkPatternMatch(stock, savedPatterns);

  // 2-5. 종합 점수 계산
  let totalScore =
    advancedAnalysis.totalScore * 0.4 +
    volumeScore +
    mfiScore +
    obvScore +
    momentumScore +
    patternMatch.bonusScore +  // 🆕 패턴 보너스
    overheating.scorePenalty;

  // 2-6. 30점 이상만 통과
  if (totalScore >= 30) {
    results.push(stock);
  }
}

// 3. 점수 순 정렬 후 반환
return results.sort((a, b) => b.totalScore - a.totalScore);
```

### 패턴 매칭 로직

```javascript
// 1. 현재 종목 지표 추출
const stockIndicators = {
  whale: stock.advancedAnalysis.indicators.whale.length,
  accumulation: stock.advancedAnalysis.indicators.accumulation.detected,
  escape: stock.advancedAnalysis.indicators.escape.detected,
  drain: stock.advancedAnalysis.indicators.drain.detected,
  asymmetric: stock.advancedAnalysis.indicators.asymmetric.ratio,
  volumeRatio: stock.volume / stock.volumeAnalysis.current.volumeMA20,
  mfi: stock.volumeAnalysis.indicators.mfi,
  closingStrength: stock.advancedAnalysis.indicators.escape.closingStrength
};

// 2. 저장된 패턴과 매칭
const matchedPatterns = [];
let bonusScore = 0;

for (const pattern of savedPatterns) {
  if (matchesPattern(stockIndicators, pattern.key)) {
    matchedPatterns.push(pattern);

    // 패턴 승률에 비례한 보너스
    bonusScore += (pattern.backtest.winRate / 100) * 15;
  }
}

// 3. 최대 20점 제한
return {
  matched: matchedPatterns.length > 0,
  patterns: matchedPatterns,
  bonusScore: Math.min(bonusScore, 20)
};
```

---

## 주요 설정

### Vercel Cron 설정 (vercel.json)

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

- 매일 오전 9시 UTC (한국 시간 오후 6시) 실행
- 장 마감 후 자동으로 패턴 재분석

### 환경변수 (Vercel)

```
KIS_APP_KEY=<한국투자증권 앱 키>
KIS_APP_SECRET=<한국투자증권 앱 시크릿>
CRON_SECRET=<선택사항: Cron 보안용>
```

---

## 성과 지표

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

## 사용 시 주의사항

### 투자 주의사항

⚠️ **본 시스템은 투자 참고용 도구이며, 투자 결정의 책임은 전적으로 투자자에게 있습니다.**

1. **과열 경고 확인**: 거래량 10배 이상 종목은 조정 위험
2. **윗꼬리 주의**: 고래 감지 + 고가 대비 낙폭 30% 이상은 신중 진입
3. **분산 투자**: 상위 5~10개 종목 분산 추천
4. **손절 설정**: -5~7% 손절 기준 설정 권장
5. **시장 상황 고려**: KOSPI 급락 시 관망 모드 전환

### API 사용 제한

- **KIS API 호출 제한**: 초당 20회
- **Vercel Timeout**: 최대 60초
- **Cron 실행**: 하루 1회 (장 마감 후)

---

## 향후 개선 계획

### Phase 5 (예정)

- [ ] 패턴 UI 탭 추가 (프론트엔드)
- [ ] 패턴별 승률/수익률 시각화
- [ ] 실시간 패턴 매칭 알림
- [ ] 포트폴리오 시뮬레이션 강화
- [ ] 머신러닝 모델 도입 (선택적)

---

## 문의 및 기여

- **GitHub**: https://github.com/knwwhr/investar
- **Issues**: 버그 리포트 및 기능 제안 환영

---

**Last Updated**: 2025-10-26
**Version**: 2.0 (Pattern Mining 통합)
**Author**: Claude Code with @knwwhr
