# 스마트 패턴 마이닝 시스템

## 개요

기존 패턴 마이닝의 비효율성을 개선한 **3단계 스마트 필터링** 방식

### 기존 방식의 문제점
- 전체 종목 중 20% 랜덤 샘플링 (약 500개 → 100개)
- 무작위 선택으로 급등 가능성 낮은 종목까지 분석
- API 호출 낭비 및 분석 시간 과다

### 스마트 방식의 장점
- ✅ **효율성**: 60개만 분석 (기존 대비 40% 감소)
- ✅ **정확성**: 이미 거래량 급증한 종목만 타겟팅
- ✅ **실용성**: 급등 패턴 발견 확률 대폭 향상

---

## 🎯 3단계 필터링 전략

### Phase 1: 거래량 증가율 상위 60개 선별
```
KIS API의 거래량 증가율 순위 활용
- KOSPI 상위 30개
- KOSDAQ 상위 30개
= 총 60개 (중복 제거 전)
```

**로직**:
```javascript
// kisApi.getVolumeSurgeRank() 활용
// fid_blng_cls_code='1' (거래증가율)
const kospiSurge = await kisApi.getVolumeSurgeRank('KOSPI', 30);
const kosdaqSurge = await kisApi.getVolumeSurgeRank('KOSDAQ', 30);
```

**효과**: 이미 거래량이 급증한 종목만 1차 선별

---

### Phase 2: 10거래일 대비 +15% 이상 상승 종목
```
수익률 필터:
- 10거래일 전 종가 vs 현재 종가
- 상승률 15% 미만 → 제외
```

**로직**:
```javascript
const returnRate = ((today.close - tenDaysAgo.close) / tenDaysAgo.close) * 100;

if (returnRate < 15) {
  continue; // 탈락
}
```

**효과**: 실제로 급등한 종목만 2차 선별

---

### Phase 3: 되돌림 필터링 (고가 대비 -10% 이상 제외)
```
조정 종목 제외:
- 최근 10거래일 고점 대비 현재가
- 10% 이상 하락 → 제외 (되돌림 진행 중)
```

**로직**:
```javascript
const recentHigh = Math.max(...chartData.slice(-10).map(d => d.high));
const pullbackRate = ((recentHigh - today.close) / recentHigh) * 100;

if (pullbackRate >= 10) {
  continue; // 되돌림 중 → 제외
}
```

**효과**: 급등 후 조정 들어간 종목 제외, 건강한 상승만 선별

---

## 📊 처리 플로우

```
[KIS API]
  ↓
Phase 1: 거래량 증가율 상위 60개 (API 순위 활용)
  ↓
Phase 2: 10거래일 대비 +15% 이상 (약 20~30개 예상)
  ↓
Phase 3: 고가 대비 -10% 되돌림 제외 (약 15~20개 예상)
  ↓
[패턴 분석]
  - 8가지 패턴 조합 검사
  - 빈도 및 승률 계산
  ↓
[백테스팅]
  - 각 패턴의 과거 성과 검증
  - 승률, 평균 수익률 계산
  ↓
[상위 5개 패턴 선정]
  - 승률 기준 정렬
  - 최소 2개 샘플 필요
  ↓
[data/patterns.json 저장]
```

---

## 🔧 구현 파일

### 1. `backend/smartPatternMining.js` (새로 작성)
**핵심 클래스**: `SmartPatternMiner`

**주요 메서드**:
- `getHighVolumeSurgeStocks()` - Phase 1 필터
- `filterBySurgeAndPullback(stockCodes)` - Phase 2+3 필터
- `extractPatterns(qualifiedStocks)` - 패턴 추출
- `backtestPatterns(patterns, stocks)` - 백테스팅
- `analyzeSmartPatterns()` - 전체 파이프라인 실행

### 2. `api/patterns/analyze.js` (수정)
기존 `patternMiner` → `smartPatternMiner`로 변경

```javascript
const smartPatternMiner = require('../../backend/smartPatternMining');

const result = await smartPatternMiner.analyzeSmartPatterns();
```

### 3. `backend/screening.js` (수정)
패턴 매칭 시 `smartPatternMiner` 사용

```javascript
const smartPatternMiner = require('./smartPatternMining');

const patternMatch = smartPatternMiner.checkPatternMatch(
  { volumeAnalysis, advancedAnalysis },
  this.savedPatterns
);
```

---

## 📈 예상 성과

### 효율성 비교

| 항목 | 기존 방식 | 스마트 방식 | 개선율 |
|------|-----------|-------------|--------|
| 1차 후보 | 100개 (랜덤) | 60개 (거래량 상위) | 40% 감소 |
| 2차 필터 | 없음 | 15% 수익률 | - |
| 3차 필터 | 없음 | 되돌림 제외 | - |
| 최종 분석 | 100개 | 15~20개 | 80% 감소 |
| 급등 패턴 발견률 | 낮음 | 높음 | 3~5배 향상 예상 |

### 기대 효과
1. **API 호출 감소**: 100회 → 60회 (40% 절감)
2. **분석 시간 단축**: 약 10분 → 약 3분
3. **패턴 품질 향상**: 실제 급등 종목 기반 학습
4. **운영 비용 절감**: Vercel Serverless 타임아웃 위험 감소

---

## 🚀 실행 방법

### 로컬 테스트
```bash
node test-smart-pattern-mining.js
```

### Vercel API 호출
```bash
# POST 요청
curl -X POST https://investar-xi.vercel.app/api/patterns/analyze

# 또는
curl -X POST http://localhost:3001/api/patterns/analyze
```

### 패턴 목록 조회
```bash
# 저장된 패턴 확인
curl https://investar-xi.vercel.app/api/patterns/list
```

---

## 📝 저장 데이터 구조

### `data/patterns.json`
```json
{
  "generatedAt": "2025-10-27T12:00:00.000Z",
  "parameters": {
    "phase1Candidates": 60,
    "phase2MinReturn": 15,
    "phase3PullbackThreshold": 10,
    "lookbackDays": 10,
    "totalQualified": 18
  },
  "patterns": [
    {
      "key": "whale_accumulation",
      "name": "고래 + 조용한 매집",
      "count": 8,
      "frequency": "44.4",
      "avgReturn": "22.50",
      "backtest": {
        "winRate": 87.5,
        "avgReturn": 22.50,
        "maxReturn": 35.20,
        "minReturn": 15.80,
        "totalSamples": 8,
        "wins": 7
      }
    }
  ]
}
```

---

## 🎓 8가지 패턴 정의

1. **고래 + 조용한 매집**: 큰 손 매수 + 낮은 변동성
2. **유동성 고갈 + 탈출 속도**: 거래량 감소 후 폭발
3. **고래 + 대량 거래**: 큰 손 매수 + 거래량 2.5배 이상
4. **비대칭 매집 + 조용한 매집**: 상승일 거래량 > 하락일 거래량
5. **탈출 속도 + 강한 마감**: 저항선 돌파 + 종가 강도 70% 이상
6. **MFI 과매도 + 고래**: 자금 흐름 바닥 + 큰 손 매수
7. **유동성 고갈 + 비대칭 매집**: 거래량 축소 + 매집 신호
8. **조용한 매집 + 적정 거래량**: 낮은 변동성 + 1.5~3배 거래량

---

## ⚠️ 주의사항

### 환경변수 필수
```bash
# .env 파일
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
```

### API 제한
- 거래량 증가율 순위: 최대 30개/시장
- Phase 1 실제 확보: KOSPI 30 + KOSDAQ 30 = 60개

### Vercel Timeout
- 최대 실행 시간: 60초
- 예상 실행 시간: 30~40초 (60개 분석 기준)

---

## 🔄 Cron 자동화 (선택사항)

### `vercel.json` 설정
```json
{
  "crons": [
    {
      "path": "/api/patterns/analyze",
      "schedule": "0 18 * * 1-5"
    }
  ]
}
```

**스케줄**: 월~금 오후 6시 (장 마감 후)

---

## 📚 참고 자료

- [KIS Developers](https://apiportal.koreainvestment.com/)
- [GitHub - koreainvestment/open-trading-api](https://github.com/koreainvestment/open-trading-api)
- [CLAUDE.md - 프로젝트 전체 문서](./CLAUDE.md)

---

**Last Updated**: 2025-10-27
**Author**: Claude Code with @knwwhr
**Version**: 1.0 (Smart Pattern Mining)
