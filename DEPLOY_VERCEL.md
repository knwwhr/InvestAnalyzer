# 🚀 Vercel 배포 가이드

**완전 초보자를 위한 단계별 가이드**

---

## 📋 준비물

1. ✅ GitHub 계정
2. ✅ 한국투자증권 API 키 (APP_KEY, APP_SECRET)
3. ✅ 이메일 주소 (Vercel 가입용)

---

## 1️⃣ GitHub 저장소 생성

### 백엔드 저장소 만들기

```bash
cd ~/stock-volume-analyzer/backend

# Git 초기화
git init

# 파일 추가
git add .

# 커밋
git commit -m "Initial commit: Vercel serverless backend"
```

### GitHub에서 저장소 생성
1. https://github.com 접속
2. 오른쪽 상단 **"+"** 클릭 → **"New repository"**
3. Repository name: `stock-analyzer-backend`
4. Public 또는 Private 선택
5. **"Create repository"** 클릭

### 로컬과 연결
```bash
# GitHub에 표시된 명령어 복사해서 실행
git remote add origin https://github.com/your-username/stock-analyzer-backend.git
git branch -M main
git push -u origin main
```

---

## 2️⃣ Vercel 가입 및 프로젝트 연결

### Vercel 가입
1. https://vercel.com 접속
2. **"Sign Up"** 클릭
3. **"Continue with GitHub"** 선택
4. GitHub 계정으로 로그인
5. Vercel 권한 승인

### 프로젝트 Import
1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. GitHub 저장소 목록에서 `stock-analyzer-backend` 찾기
3. **"Import"** 클릭

### 프로젝트 설정
#### Framework Preset
- **"Other"** 선택 (자동 감지됨)

#### Root Directory
- **비워두기** (기본값)

#### Build and Output Settings
- **Build Command**: 비워두기
- **Output Directory**: 비워두기
- **Install Command**: `npm install`

---

## 3️⃣ 환경변수 설정 (중요!)

### Environment Variables 섹션
**"Environment Variables"** 클릭 후 다음 입력:

#### 1. KIS_APP_KEY
```
Name: KIS_APP_KEY
Value: [한국투자증권에서 발급받은 APP KEY 붙여넣기]
```

#### 2. KIS_APP_SECRET
```
Name: KIS_APP_SECRET
Value: [한국투자증권에서 발급받은 APP SECRET 붙여넣기]
```

#### 3. NODE_ENV
```
Name: NODE_ENV
Value: production
```

**"Add"** 버튼을 누를 때마다 환경변수가 추가됩니다.

---

## 4️⃣ 배포 시작

1. 환경변수 입력 완료 후 **"Deploy"** 버튼 클릭
2. 배포 진행 상황 확인 (약 2-3분 소요)
3. ✅ **"Congratulations!"** 메시지 표시되면 완료

---

## 5️⃣ 배포 URL 확인

### Vercel이 자동으로 생성한 URL
```
https://stock-analyzer-backend.vercel.app
```

또는

```
https://stock-analyzer-backend-your-username.vercel.app
```

### API 테스트
브라우저에서 접속:
```
https://your-vercel-url.vercel.app/api/health
```

결과:
```json
{
  "status": "OK",
  "timestamp": "2025-01-..."
}
```

---

## 6️⃣ 프론트엔드 설정 업데이트

### index.html 수정
`frontend/index.html` 파일의 66번째 줄:

**변경 전:**
```javascript
: 'https://your-vercel-backend.vercel.app/api';
```

**변경 후:**
```javascript
: 'https://stock-analyzer-backend-your-username.vercel.app/api';
```

실제 Vercel URL로 교체하세요!

---

## 7️⃣ 프론트엔드 GitHub Pages 배포

### 프론트엔드 저장소 생성
```bash
cd ~/stock-volume-analyzer/frontend

git init
git add .
git commit -m "Initial commit: Frontend"
```

### GitHub 저장소 생성
1. GitHub에서 **"New repository"**
2. Repository name: `stock-analyzer-frontend`
3. Public으로 설정 (GitHub Pages 무료 사용)
4. Create repository

### 연결 및 푸시
```bash
git remote add origin https://github.com/your-username/stock-analyzer-frontend.git
git branch -M main
git push -u origin main
```

### GitHub Pages 활성화
1. GitHub 저장소 페이지에서 **"Settings"**
2. 왼쪽 메뉴에서 **"Pages"** 클릭
3. **"Source"** → **"Deploy from a branch"**
4. **"Branch"** → **"main"** → **"/ (root)"** 선택
5. **"Save"** 클릭

### 배포 완료 확인 (2-3분 소요)
```
https://your-username.github.io/stock-analyzer-frontend/
```

---

## 8️⃣ 완료! 🎉

### 최종 URL
- **프론트엔드**: https://your-username.github.io/stock-analyzer-frontend/
- **백엔드**: https://your-project.vercel.app/api

---

## 🔧 문제 해결

### 1. CORS 에러
**증상**: 프론트엔드에서 "CORS policy" 에러

**해결**:
- Vercel 함수에 CORS 헤더가 이미 설정되어 있습니다
- 캐시 문제일 수 있으니 브라우저 새로고침 (Ctrl+Shift+R)

### 2. API 호출 실패
**증상**: "서버와 연결할 수 없습니다"

**확인사항**:
1. Vercel 환경변수 제대로 입력했는지 확인
2. API 키가 유효한지 확인
3. Vercel 배포 로그 확인 (Vercel 대시보드 → Deployments → Logs)

### 3. 환경변수 변경 후 반영 안됨
**해결**:
1. Vercel 대시보드 → Settings → Environment Variables
2. 값 수정 후 **"Save"**
3. **Deployments** → 최신 배포 → **"Redeploy"** 클릭

### 4. 스크리닝 타임아웃
**증상**: "Function execution timed out"

**원인**: Vercel 무료 티어는 함수 실행 10초 제한

**해결**:
- 전체 스크리닝 대신 캐시된 결과 사용
- 또는 Vercel Pro 플랜 사용 ($20/월, 60초 제한)

---

## 📝 업데이트 방법

### 백엔드 업데이트
```bash
cd ~/stock-volume-analyzer/backend
git add .
git commit -m "Update backend"
git push
```
→ Vercel이 자동으로 재배포 (약 2분)

### 프론트엔드 업데이트
```bash
cd ~/stock-volume-analyzer/frontend
git add .
git commit -m "Update frontend"
git push
```
→ GitHub Pages가 자동으로 재배포 (약 3분)

---

## 💰 비용

### 완전 무료!
- ✅ Vercel 무료 티어: 월 100GB 대역폭
- ✅ GitHub Pages 무료
- ✅ 한국투자증권 API 무료 (모의투자)

### 제한사항
- Vercel 함수 실행: 10초
- 월 100GB 트래픽
- 일반 사용자라면 충분!

---

## 🎯 다음 단계

### 커스텀 도메인 연결 (선택사항)
1. 도메인 구매 (예: GoDaddy, Namecheap)
2. Vercel → Settings → Domains
3. 도메인 추가 및 DNS 설정

### 모니터링
- Vercel Analytics 활성화 (무료)
- 함수 실행 시간, 에러 추적

---

## ❓ FAQ

**Q: 배포 후 수정하려면?**
A: 코드 수정 → git push → 자동 재배포

**Q: 백엔드만 재배포하려면?**
A: `backend` 폴더에서 git push하면 백엔드만 재배포

**Q: 비용 걱정 없나요?**
A: 개인 사용이라면 무료 티어로 충분합니다!

**Q: API 키 보안은?**
A: Vercel 환경변수는 암호화되어 안전합니다. 절대 프론트엔드에 넣지 마세요!

---

**🎉 배포 완료! 이제 전 세계 어디서나 접속 가능합니다!**
