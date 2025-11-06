# 🤖 Investar - AI 기반 주식 스크리닝 시스템

**한국투자증권 OpenAPI 기반 거래량 종목 발굴 시스템**

거래량 지표로 급등 가능성이 높은 종목을 자동 발굴하는 AI 스크리닝 시스템

🌐 **배포 URL**: https://investar-xi.vercel.app
📚 **상세 문서**: [CLAUDE.md](./CLAUDE.md)

---

## 🎯 핵심 기능

### 📊 3개 카테고리 스크리닝

**1. 🏆 종합집계**
모든 지표 종합 점수 순위 (30점 이상)

**2. 🐋 고래 감지**
거래량 2.5배 + 가격 3% 상승 (기관/외국인 매수 신호)

**3. 🤫 조용한 매집**
가격 횡보 + 거래량 증가 (세력 물량 모으기, 선행 지표)

---

## 📈 종합 점수 시스템

```
S등급 (70점+): 🔥 최우선 매수
A등급 (55-69): 🟢 적극 매수
B등급 (40-54): 🟡 매수 고려
C등급 (30-39): ⚪ 주목
```

---

## 🚀 빠른 시작

```bash
# 저장소 클론
git clone https://github.com/knwwhr/investar.git
cd investar

# 의존성 설치
npm install

# 환경변수 설정 (.env)
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret

# 로컬 서버 실행
npm start
# http://localhost:3001
```

---

## 📡 API 엔드포인트

```bash
# 종합집계
GET /api/screening/recommend?market=ALL&limit=10

# 고래 감지
GET /api/screening/whale?market=KOSPI&limit=5

# 조용한 매집
GET /api/screening/accumulation?market=ALL&limit=5
```

---

## 🗄️ 주요 기능

- ✅ **동적 종목 풀**: KIS API 4개 순위 순위 기반 53개 종목 확보
- ✅ **ETF/ETN 필터링**: 15개 키워드로 특수 펀드/파생상품 차단
- ✅ **거래량 DNA 시스템**: 과거 급등주 패턴 추출 및 현재 종목 매칭
- ✅ **Supabase 성과 추적**: 추천 종목 실시간 성과 모니터링
- ✅ **Vercel Serverless**: 자동 배포 및 Cron Job

---

## 📁 프로젝트 구조

```
investar/
├── api/                    # Vercel Serverless Functions (12개)
│   ├── screening/         # 스크리닝 API
│   ├── patterns/          # 패턴 분석 API
│   └── cron/              # 정기 작업
├── backend/               # 백엔드 로직
│   ├── kisApi.js         # KIS OpenAPI 클라이언트
│   ├── screening.js      # 스크리닝 엔진
│   └── volumeIndicators.js  # 거래량 지표
├── index.html            # React SPA 프론트엔드
└── server.js             # 로컬 개발 서버
```

---

## ⚙️ 주요 설정

### 환경변수 (Vercel)

```
KIS_APP_KEY=<한국투자증권 앱 키>
KIS_APP_SECRET=<한국투자증권 앱 시크릿>
```

### API 제한

- KIS API: 초당 18회 (안전 마진)
- Vercel Timeout: 최대 60초
- 순위 API: 최대 30건/호출

---

## ⚠️ 투자 주의사항

**본 시스템은 투자 참고용 도구이며, 투자 결정의 책임은 전적으로 투자자에게 있습니다.**

1. 과열 경고 확인 (거래량 10배 이상)
2. 윗꼬리 주의 (고가 대비 낙폭 30% 이상)
3. 분산 투자 (상위 5-10개 종목)
4. 손절 설정 (-5~7% 권장)

---

## 📝 최신 업데이트

### v3.3 (2025-11-06) - 🐛 Critical Bug Fix
- **chartData 배열 인덱싱 버그 수정**
  - 문제: 항상 9월 19일 데이터를 최신으로 잘못 인식
  - 해결: 11월 6일 최신 데이터로 정확한 분석
  - 영향: volumeAnalysis, advancedIndicators, backtest 전체 수정

### v3.2 (2025-11-03) - Supabase 성과 추적
- 추천 종목 자동 저장 및 성과 모니터링
- 연속 급등주 감지 (2일 이상)
- 등급별 성과 통계

### v3.1 (2025-10-30) - 거래량 DNA 시스템
- 과거 급등주 패턴 DNA 추출
- 현재 시장에서 유사 종목 탐색
- EMA + 구간별 + 최근5일 하이브리드 분석

---

## 📚 참고 자료

- **상세 문서**: [CLAUDE.md](./CLAUDE.md) - 전체 시스템 설명
- **Supabase 설정**: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- **KIS Developers**: https://apiportal.koreainvestment.com
- **Vercel Docs**: https://vercel.com/docs/functions
- **GitHub**: https://github.com/knwwhr/investar

---

**Version**: 3.3 (Critical Bug Fix)
**Author**: Claude Code with @knwwhr
**Last Updated**: 2025-11-06

**✨ "거래량이 주가에 선행한다" - DNA 기반 종목 발굴 + 실전 성과 추적**
