# 🤖 Investar - 거래량 기반 AI 주식 스크리너

**한국투자증권 OpenAPI 기반 주식 종목 발굴 시스템**

거래량 지표로 급등 가능성이 높은 종목을 자동 발굴하는 AI 스크리닝 시스템입니다.

🌐 **배포 URL**: https://investar-xi.vercel.app

---

## 🎯 핵심 기능

### 📊 3개 카테고리 (2025-10-28 단순화)

**1. 🏆 종합집계**
- 모든 지표 종합 점수 순위
- 30점 이상 전체 표시

**2. 🐋 고래 감지**
- 거래량 2.5배 + 가격 3% 상승
- 세력 매수 신호 포착

**3. 🤫 조용한 매집**
- 가격 안정 + 거래량 20% 증가
- 1~2주 후 급등 전조 (선행 지표)

### ✅ 주요 특징

- **동적 종목 풀**: 53개 (KIS API 실시간)
- **ETF 필터링**: 15개 키워드 차단
- **Vercel 배포**: Serverless 최적화
- **철학**: "적을수록 강하다" - 예측력 높은 지표만 유지

---

## 🚀 빠른 시작

### 1. 환경 설정

```bash
# 저장소 클론
git clone https://github.com/knwwhr/investar.git
cd investar

# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
nano .env
```

`.env` 파일:
```env
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
```

### 2. 로컬 실행

```bash
npm start
# http://localhost:3001
```

### 3. API 테스트

```bash
# 종합집계
curl http://localhost:3001/api/screening/recommend?limit=5

# 고래 감지
curl http://localhost:3001/api/screening/whale

# 조용한 매집
curl http://localhost:3001/api/screening/accumulation
```

---

## 📡 API 엔드포인트

### 스크리닝 API

```bash
# 종합집계
GET /api/screening/recommend?market=ALL&limit=10

# 고래 감지
GET /api/screening/whale?market=KOSPI&limit=5

# 조용한 매집
GET /api/screening/accumulation?market=ALL&limit=5

# 하이브리드 분석
GET /api/screening/hybrid?limit=3

# 오늘의 신호
GET /api/tracking/today-signals?limit=5
```

### 패턴 마이닝 API

```bash
# 패턴 목록
GET /api/patterns/list

# 패턴 분석 실행
POST /api/patterns/analyze

# 패턴 매칭 종목
GET /api/patterns/matched-stocks?pattern=whale_accumulation
```

---

## 📁 프로젝트 구조

```
investar/
├── api/                # Vercel Serverless Functions (11개)
│   ├── screening/     # 스크리닝 엔드포인트
│   ├── patterns/      # 패턴 분석
│   ├── tracking/      # 실전 추적
│   ├── backtest/      # 백테스트
│   └── comparison/    # A/B 테스트
│
├── backend/           # 백엔드 로직
│   ├── kisApi.js     # KIS OpenAPI 클라이언트
│   ├── screening.js  # 스크리닝 엔진
│   └── hybridScoring.js  # 하이브리드 점수
│
├── index.html        # React SPA
├── server.js         # 로컬 서버
└── vercel.json       # Vercel 설정
```

---

## 📊 종목 풀 구성

```
4개 순위 API × 2시장 = 240개 호출
  ├─ 등락률 상승: 30개 × 2 = 60개
  ├─ 거래량 증가율: 30개 × 2 = 60개
  ├─ 거래량 순위: 30개 × 2 = 60개
  └─ 거래대금 순위: 30개 × 2 = 60개

ETF 필터링 (15개 키워드)
  → plus, unicorn, POST IPO, 국채, 선물 등

중복 제거 (78%)
  → 최종 53개 확보
```

---

## 🎓 사용 가이드

### 등급 체계

- **S등급** (70점+): 🔥 최우선 매수
- **A등급** (55-69점): 🟢 적극 매수
- **B등급** (40-54점): 🟡 매수 고려
- **C등급** (30-39점): ⚪ 주목

### 카테고리 해석

**고래 감지**
```
✅ 거래량 2.5배 + 가격 3% 상승
→ 세력 매수 신호
⚠️ 윗꼬리 30% 이상 시 경고
```

**조용한 매집**
```
✅ 가격 변동 <3% + 거래량 +20%
→ 세력이 물량을 조용히 모으는 중
📈 1~2주 후 급등 가능성
```

---

## ⚠️ 주의사항

### 투자 책임
⚠️ **본 시스템은 투자 참고용 도구이며, 투자 결정의 책임은 전적으로 투자자에게 있습니다.**

### API 제한
- KIS API: 초당 20회 (안전 마진 18회)
- 순위 API: 최대 30건/호출
- Vercel Timeout: 60초

---

## 📝 변경 이력

### v3.0 (2025-10-28) - 지표 단순화
- ✅ 카테고리 6개 → 3개 축소
- ✅ ETF/ETN 필터링 강화
- ✅ Unknown → [종목코드] 표시
- ❌ 제거: 탈출 속도, 거래량 폭발, 유동성 고갈

### v2.1 (2025-10-27)
- ✅ KIS API 통합 완료
- ✅ 4개 순위 API 정상 작동

### v1.0 (2025-10-25)
- ✅ 기본 스크리닝 시스템

---

## 📚 참고 자료

- **KIS Developers**: https://apiportal.koreainvestment.com
- **Vercel Docs**: https://vercel.com/docs/functions
- **GitHub**: https://github.com/knwwhr/investar

---

## 🤝 기여

버그 리포트, 기능 제안, Pull Request 환영합니다!

---

**Last Updated**: 2025-10-28
**Version**: 3.0
**License**: MIT

**✨ "적을수록 강하다" - 핵심 지표만 남기다 ✨**
