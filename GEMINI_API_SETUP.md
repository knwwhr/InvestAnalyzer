# Gemini API 키 발급 가이드 (2025년 최신)

## 🔑 무료 API 키 발급 방법

### ✅ 정확한 URL (2025년 업데이트)

**새 주소**: https://aistudio.google.com/app/apikey

(기존 makersuite.google.com이 aistudio.google.com으로 변경되었습니다)

---

## 📝 단계별 발급 방법

### 1단계: Google AI Studio 접속

```
https://aistudio.google.com/app/apikey
```

### 2단계: Google 계정 로그인

- Gmail 계정으로 로그인
- 계정이 없으면 무료 생성

### 3단계: API 키 생성

**방법 A: 프로젝트 없이 생성 (추천 ⭐)**

1. "Get API Key" 또는 "Create API Key" 버튼 클릭
2. **"Create API key in new project"** 선택
   - 이 옵션을 선택하면 자동으로 프로젝트가 생성됩니다
3. API 키가 즉시 생성됨
4. 키 복사 (예: AIzaSyC...)

**방법 B: 기존 Google Cloud 프로젝트 사용**

1. Google Cloud Console에 먼저 프로젝트 생성
2. AI Studio에서 해당 프로젝트 선택
3. API 키 생성

---

## 🚨 "No Cloud Projects Available" 해결 방법

이 메시지가 나오는 경우:

### 해결책: 새 프로젝트 자동 생성

1. Google AI Studio 메인 페이지로 이동:
   ```
   https://aistudio.google.com/
   ```

2. 좌측 메뉴에서 **"Get API key"** 클릭

3. 파란색 버튼 **"Create API key in new project"** 클릭
   - 이 버튼이 핵심입니다!
   - 프로젝트가 자동으로 생성되면서 API 키가 발급됩니다

4. API 키 복사 (AIzaSy로 시작하는 긴 문자열)

---

## 🎯 더 쉬운 방법 (대안)

### Option 1: Google Cloud Console에서 직접 생성

```
1. https://console.cloud.google.com/ 접속
2. 프로젝트 생성 (이름: investar 또는 아무거나)
3. "APIs & Services" → "Credentials" 메뉴
4. "Create Credentials" → "API key" 선택
5. "Restrict Key" → "Generative Language API" 선택
```

### Option 2: 명령어로 확인 (이미 키가 있는 경우)

```bash
# 기존 키가 있는지 확인
gcloud auth application-default print-access-token
```

---

## 📸 스크린샷으로 보는 방법

### 1. AI Studio 메인 화면

```
https://aistudio.google.com/
```

좌측 메뉴:
- 💬 Prompt
- 🔑 Get API key  ← 여기 클릭!
- 📚 Documentation

### 2. API 키 생성 화면

```
┌─────────────────────────────────────┐
│  Create API key                     │
├─────────────────────────────────────┤
│                                     │
│  🔘 Create API key in new project  │  ← 이거 선택!
│     (Automatically creates project) │
│                                     │
│  ⚪ Create API key in existing proj│
│     (Select from dropdown)          │
│                                     │
└─────────────────────────────────────┘
```

### 3. API 키 복사

```
Your API key: AIzaSyC1234567890abcdefg...
                 ↑
              복사하기
```

---

## 🔐 API 키 설정

### .env 파일에 추가

```bash
# .env
GEMINI_API_KEY=AIzaSyC1234567890abcdefg...
```

### 테스트

```bash
node test-free-apis.js
```

---

## ⚠️ 문제 해결

### "API key not valid" 오류

**원인**: API 활성화 필요

**해결**:
```
1. https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. "Enable" 버튼 클릭
3. 5분 대기
```

### "Quota exceeded" 오류

**원인**: 일일 1,500 requests 초과

**해결**:
- 내일까지 대기
- 또는 새 프로젝트 생성 (무료 할당량 리셋)

### 여전히 프로젝트 생성 안 됨

**최종 해결책**:

```bash
# Google Cloud SDK 설치 후
gcloud projects create investar-ai-$(date +%s)
gcloud config set project investar-ai-XXXXX

# AI Studio 새로고침
```

---

## 📊 무료 할당량 확인

### Google AI Studio 대시보드

```
https://aistudio.google.com/app/apikey
```

화면에 표시:
- ✅ Requests today: 45 / 1,500
- ✅ Requests per minute: 3 / 60

---

## 💡 팁

### API 키 보안

1. **.env 파일은 절대 Git에 커밋하지 않기**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Vercel 환경변수로 설정**
   ```
   Vercel Dashboard → Settings → Environment Variables
   GEMINI_API_KEY = AIzaSy...
   ```

3. **키 제한 설정**
   ```
   Google Cloud Console → Credentials
   → API restrictions: Generative Language API
   → Application restrictions: HTTP referrers
   ```

---

## 🚀 빠른 시작 (요약)

```bash
# 1. AI Studio 접속
https://aistudio.google.com/app/apikey

# 2. "Create API key in new project" 클릭

# 3. 키 복사

# 4. .env에 추가
echo "GEMINI_API_KEY=AIzaSy..." >> .env

# 5. 테스트
node test-free-apis.js
```

---

## 📚 참고 링크

- **공식 문서**: https://ai.google.dev/docs
- **API 키 관리**: https://aistudio.google.com/app/apikey
- **가격**: https://ai.google.dev/pricing (무료: 월 60 RPM)
- **SDK 문서**: https://www.npmjs.com/package/@google/generative-ai

---

**작성일**: 2025-11-03
**업데이트**: MakerSuite → AI Studio 변경 반영
