# 하이브리드 선행 포착 시스템 - 배포 및 사용 가이드

**버전**: 3.0 (Hybrid + Backtest)
**배포일**: 2025년 10월 28일
**상태**: ✅ 프로덕션 배포 완료

---

## 📊 구현 완료 기능

### 1. 하이브리드 스크리닝 시스템

**엔드포인트**: `/api/screening/hybrid`

```bash
# 상위 10개 종목 추출
curl "https://investar-xi.vercel.app/api/screening/hybrid?limit=10"
```

**특징**:
- Grok 백테스트 구조 + Claude 세부 조정
- 예상 승률: 75-78%
- 예상 수익률: +9-11%
- 신호 빈도: 1.5-2/주

**응답 포맷**:
```json
{
  "success": true,
  "method": "hybrid",
  "expectedPerformance": {
    "winRate": "75-78%",
    "avgReturn": "+9-11%",
    "signalFrequency": "1.5-2/week"
  },
  "count": 10,
  "recommendations": [
    {
      "stockCode": "005930",
      "stockName": "삼성전자",
      "grade": "S",
      "score": 85,
      "indicators": {
        "volumeGradual": { "detected": true, "growth": "45.2%" },
        "obvDivergence": { "detected": true },
        "uptrend": { "detected": true, "rsi": "62.3" }
      },
      "scoreBreakdown": {
        "volumeGradual": 50,
        "obvDivergence": 20,
        "uptrend": 30,
        "total": 85
      }
    }
  ]
}
```

---

### 2. 백테스트 시스템

**엔드포인트**: `/api/backtest/hybrid`

```bash
# 단일 종목 백테스트
curl "https://investar-xi.vercel.app/api/backtest/hybrid?stockCode=005930&signalDate=20251020&holdDays=10"
```

**파라미터**:
- `stockCode`: 종목 코드 (예: 005930)
- `signalDate`: 신호 발생일 (YYYYMMDD)
- `holdDays`: 보유 기간 (기본 10일)

**응답 포맷**:
```json
{
  "success": true,
  "backtest": {
    "stockCode": "005930",
    "signalDate": "20251020",
    "buyPrice": 50000,
    "sellDate": "20251101",
    "sellPrice": 55000,
    "holdDays": 10,
    "grossReturn": "10.00",
    "netReturn": "9.70",
    "maxDrawdown": "-2.50",
    "win": true,
    "score": 85,
    "indicators": {
      "volumeGradual": true,
      "obvDivergence": true,
      "uptrend": true
    }
  }
}
```

---

### 3. 실전 추적 시스템

**엔드포인트**: `/api/tracking/today-signals`

```bash
# 오늘 S/A 등급 5종목 추출
curl "https://investar-xi.vercel.app/api/tracking/today-signals?limit=5"
```

**응답 포맷**:
```json
{
  "success": true,
  "date": "2025-10-28",
  "count": 5,
  "signals": [
    {
      "stockCode": "005930",
      "stockName": "삼성전자",
      "grade": "S",
      "score": 85,
      "currentPrice": 50000,
      "expectedSurgeDays": 10,
      "trackingPlan": {
        "buyPrice": 50000,
        "stopLoss": "47500",
        "takeProfit1": "56000",
        "takeProfit2": "60000"
      }
    }
  ],
  "instructions": [
    "1. 장 마감 10분 전 (14:50) 매수 실행",
    "2. 스톱로스 -5% 자동 주문 설정",
    "3. +12% 달성 시 50% 익절",
    "4. +20% 달성 시 30% 익절",
    "5. D+10일 전량 매도"
  ]
}
```

**대시보드**: `/tracking-dashboard.html`

---

### 4. A/B 테스트 시스템

**엔드포인트**: `/api/comparison/ab-test`

```bash
# 하이브리드 vs 기존 시스템 비교
curl "https://investar-xi.vercel.app/api/comparison/ab-test?stockCode=005930&signalDate=20251020"
```

**응답 포맷**:
```json
{
  "success": true,
  "comparison": {
    "stockCode": "005930",
    "signalDate": "20251020",
    "hybrid": {
      "decision": "매수",
      "score": 85,
      "grade": "S",
      "result": { ... }
    },
    "legacy": {
      "decision": "매수",
      "score": 65,
      "grade": "B"
    },
    "verdict": "✅ 하이브리드 승리 (올바른 신호)",
    "agreement": true
  }
}
```

---

## 🚀 실전 사용 시나리오

### 시나리오 1: 일일 스크리닝

**목적**: 매일 유망 종목 발굴

```bash
# 오전 9시: 오늘 신호 확인
curl "https://investar-xi.vercel.app/api/tracking/today-signals?limit=5"

# 또는 대시보드 접속
https://investar-xi.vercel.app/tracking-dashboard.html
```

**절차**:
1. 오전 9시: 대시보드에서 오늘 신호 확인
2. 각 종목 공시 확인 (악재 제외)
3. VI 발동 여부 확인
4. 14:50 매수 실행
5. 스톱로스 -5% 주문 설정
6. 매일 가격 모니터링

---

### 시나리오 2: 백테스트 검증

**목적**: Grok 81.3% 승률 재현 검증

```bash
# 과거 신호일에 대해 백테스트 실행
curl "https://investar-xi.vercel.app/api/backtest/hybrid?stockCode=005930&signalDate=20251001&holdDays=10"
curl "https://investar-xi.vercel.app/api/backtest/hybrid?stockCode=000660&signalDate=20251005&holdDays=10"
curl "https://investar-xi.vercel.app/api/backtest/hybrid?stockCode=035720&signalDate=20251010&holdDays=10"
```

**분석**:
- 30-50개 종목 백테스트
- 승률 계산: wins / total
- 평균 수익률 계산
- 샤프 비율 확인

**예상 결과**:
- 승률: 75-78%
- 평균 수익률: +9-11%
- 최대 손실: -6.2%

---

### 시나리오 3: A/B 테스트

**목적**: 하이브리드 vs 기존 시스템 성능 비교

```bash
# 동일 종목에 대해 양측 비교
curl "https://investar-xi.vercel.app/api/comparison/ab-test?stockCode=005930&signalDate=20251020"
```

**분석 지표**:
- 신호 일치율 (agreement)
- 하이브리드 승률 vs 기존 시스템 승률
- 평균 수익률 비교
- False Positive/Negative 분석

---

## 📋 매매 전략

### S등급 (85점 이상)

```
포지션: 5-8% (최대 10종목 → 50-80% 총 투자)
홀드: 10일
손절: -5% (무조건)
익절:
  - 1차 +12% → 50% 정리
  - 2차 +20% → 30% 정리
  - 나머지 20% → 10일 홀드 후 전량 매도
```

### A등급 (70-84점)

```
포지션: 3-5% (분할 매수)
  - 1차 50% 진입
  - 2차 30% (익일 +3% 이상 시)
홀드: 10일
손절: -5%
익절: 1차 +10% → 50% 정리
```

### B등급 (50-69점)

```
관찰 (뉴스/공시 확인 후 진입)
진입 보류
```

---

## 🎯 예상 성과 (보수적 추정)

### 백테스트 기준

| 지표 | Grok 백테스트 | 하이브리드 예측 | 근거 |
|------|---------------|----------------|------|
| **승률** | 81.3% | **75-78%** | 슬리피지 3-6%p 차감 |
| **평균 수익률** | +11.8% | **+9-11%** | 거래비용 0.3% 반영 |
| **평균 손실률** | -6.5% | **-3.5%** | 중간 패널티로 개선 |
| **신호 빈도** | 1.4/주 | **1.5-2/주** | 유사 |
| **보유 기간** | 12일 | **10-14일** | 유사 |
| **최대 손실** | -15% | **-12%** | 패널티 완화로 개선 |

### 연간 수익 시뮬레이션

**가정**:
- 초기 자금: 1,000만원
- 주당 신호: 1.5개
- 포지션: 5%/종목
- 승률: 75%
- 평균 수익: +10%

**계산**:
```
연간 거래 수: 1.5 * 52주 = 78거래
승리: 78 * 0.75 = 58.5회 (평균 +10%)
패배: 78 * 0.25 = 19.5회 (평균 -5%)

총 수익: (58.5 * 10%) - (19.5 * 5%) = 585% - 97.5% = 487.5%
포지션 5% 적용: 487.5% * 0.05 = 24.4%

연간 수익률: +24.4% (보수적)
```

---

## ⚠️ 리스크 관리

### 필수 체크리스트

**매수 전**:
- [ ] 공시 확인 (악재 없음)
- [ ] VI 발동 여부 확인 (±10% 제외)
- [ ] 당일 등락률 확인 (±8% 제외)
- [ ] 포지션 계산 (5-8%/종목)

**매수 후**:
- [ ] 스톱로스 -5% 주문 설정
- [ ] 매일 가격 모니터링
- [ ] +12% 달성 시 50% 익절
- [ ] +20% 달성 시 30% 익절
- [ ] D+10일 전량 매도

### 리스크 완화

1. **분산 투자**: 최소 5종목, 최대 10종목
2. **동일 섹터 제한**: 최대 30%
3. **손절 엄수**: -5% 무조건 (예외 없음)
4. **현금 보유**: 최소 20%
5. **정기 점검**: 주간 성과 리뷰

---

## 🔧 파라미터 튜닝 가이드

### 승률이 70% 미만일 경우

**조치**:
1. S등급 기준 상향: 85점 → 90점
2. 거래량 기준 상향: KOSPI 30% → 35%
3. RSI 조건 강화: 50-70 → 55-65
4. 패널티 강화: -30/-15/-20 → -40/-20/-25

### 신호 빈도가 너무 적을 경우 (< 1/주)

**조치**:
1. A등급 기준 하향: 70점 → 65점
2. 거래량 기준 완화: KOSPI 30% → 25%
3. OBV 가중치 상향: 20점 → 25점

### 신호 빈도가 너무 많을 경우 (> 5/주)

**조치**:
1. S등급 기준 상향: 85점 → 90점
2. 필수 지표 조건: 3개 모두 필수
3. 패널티 강화

---

## 📊 성과 모니터링

### 주간 리뷰 체크리스트

```
[ ] 총 거래 수: ___ 건
[ ] 승리: ___ 건 (___%)
[ ] 패배: ___ 건 (___%)
[ ] 평균 수익: +___%
[ ] 평균 손실: -___%
[ ] 최대 손실: -___%
[ ] 샤프 비율: ___
[ ] 조정 필요 사항: ___________
```

### 월간 리뷰

- 승률이 70% 미만 → 파라미터 재조정
- 평균 수익이 +8% 미만 → 익절 전략 재검토
- 최대 손실이 -10% 초과 → 손절 강화

---

## 🚀 배포 상태

### Vercel 배포 완료

**URL**: https://investar-xi.vercel.app

**엔드포인트**:
- ✅ `/api/screening/hybrid` - 하이브리드 스크리닝
- ✅ `/api/backtest/hybrid` - 백테스트 실행
- ✅ `/api/tracking/today-signals` - 실전 추적
- ✅ `/api/comparison/ab-test` - A/B 테스트
- ✅ `/tracking-dashboard.html` - 대시보드

### 환경변수 (Vercel)

```
KIS_APP_KEY=<한국투자증권 앱 키>
KIS_APP_SECRET=<한국투자증권 앱 시크릿>
```

---

## 📞 문의 및 버그 리포트

- **GitHub**: https://github.com/knwwhr/investar
- **Issues**: 버그 리포트 및 기능 제안

---

## 📝 변경 이력

### v3.0 (2025-10-28)
- ✅ 하이브리드 스크리닝 시스템 구현
- ✅ 백테스트 엔진 구현
- ✅ 실전 추적 시스템 구현
- ✅ A/B 테스트 시스템 구현
- ✅ 추적 대시보드 구현

### v2.1 (2025-10-27)
- ✅ KIS API 통합 완료

### v2.0 (2025-10-26)
- ✅ 패턴 마이닝 시스템

---

**Last Updated**: 2025-10-28
**Version**: 3.0 (Hybrid + Backtest)

**🎉 하이브리드 선행 포착 시스템 - 프로덕션 배포 완료!**
