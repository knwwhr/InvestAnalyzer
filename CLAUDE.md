# Investar - AI 기반 주식 스크리닝 시스템

## 프로젝트 개요

**Investar**는 한국투자증권 OpenAPI를 활용한 거래량 기반 주식 종목 발굴 시스템입니다.

- **목적**: 거래량 지표로 급등 가능성이 높은 종목 자동 발굴
- **기술 스택**: Node.js, React (CDN), Vercel Serverless, KIS OpenAPI
- **배포 URL**: https://investar-xi.vercel.app
- **버전**: 3.0 (카테고리 단순화 완료)
- **최종 업데이트**: 2025-10-28

---

## 📊 현재 시스템 상태 (2025-10-28)

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
├── api/                          # Vercel Serverless Functions (11개)
│   ├── screening/
│   │   ├── recommend.js         # 종합집계
│   │   ├── [category].js        # whale, accumulation
│   │   └── hybrid.js            # 하이브리드 분석
│   ├── patterns/
│   │   ├── analyze.js           # 패턴 분석
│   │   ├── list.js              # 패턴 목록
│   │   └── matched-stocks.js    # 패턴 매칭 종목
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
│   └── patternCache.js          # 패턴 캐시
│
├── index.html                    # React SPA 프론트엔드
├── server.js                     # 로컬 개발 서버
├── vercel.json                   # Vercel 설정
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

## 📚 참고 자료

### 공식 문서
- **KIS Developers**: https://apiportal.koreainvestment.com
- **Vercel Serverless**: https://vercel.com/docs/functions

### GitHub 저장소
- **본 프로젝트**: https://github.com/knwwhr/investar
- **공식 샘플 코드**: https://github.com/koreainvestment/open-trading-api

---

## 📝 변경 이력

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

**Last Updated**: 2025-10-28
**Version**: 3.0 (Category Simplification Complete)
**Author**: Claude Code with @knwwhr

**✨ "적을수록 강하다" - 핵심 지표만 남기다**
