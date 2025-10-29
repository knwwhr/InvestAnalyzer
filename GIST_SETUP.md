# GitHub Gist 패턴 저장소 설정 가이드

## 🎯 개요

Vercel Serverless 환경은 stateless이기 때문에, API 호출 간 데이터가 유지되지 않습니다.
패턴 분석 결과를 영구적으로 저장하기 위해 **GitHub Gist**를 저장소로 사용합니다.

### 장점
- ✅ **무료**: GitHub 계정만 있으면 사용 가능
- ✅ **영구 저장**: 서버 재시작 후에도 데이터 유지
- ✅ **Public URL**: 인증 없이 읽기 가능 (raw URL)
- ✅ **간단한 API**: GitHub REST API 사용
- ✅ **버전 관리**: Gist 자체가 Git 저장소

---

## 📋 설정 단계

### 1. GitHub Personal Access Token 발급

1. GitHub 로그인 후 [Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens) 이동
2. **"Generate new token (classic)"** 클릭
3. Token 설정:
   - **Note**: `Investar Pattern Storage` (원하는 이름)
   - **Expiration**: `No expiration` (만료 없음) 또는 원하는 기간
   - **Select scopes**: `gist` 체크 ✅
4. **"Generate token"** 클릭
5. 생성된 토큰 복사 (⚠️ 다시 볼 수 없으므로 안전한 곳에 보관!)

예시: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

### 2. Public Gist 생성

1. [gist.github.com](https://gist.github.com) 접속
2. 새 Gist 생성:
   - **Filename**: `investar-patterns.json`
   - **Content**:
     ```json
     {
       "patterns": [],
       "generatedAt": null,
       "parameters": null
     }
     ```
   - **Public** 선택 (Private은 raw URL 접근 불가)
3. **"Create public gist"** 클릭
4. URL에서 **Gist ID** 복사:
   - URL 형식: `https://gist.github.com/knwwhr/[GIST_ID]`
   - 예시: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` (32자리 영숫자)

---

### 3. Vercel 환경변수 설정

#### 3-1. Vercel Dashboard에서 설정

1. [Vercel Dashboard](https://vercel.com/dashboard) 로그인
2. `investar` 프로젝트 선택
3. **Settings → Environment Variables** 이동
4. 다음 2개 변수 추가:

| Name | Value | Environments |
|------|-------|--------------|
| `GITHUB_GIST_ID` | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` | Production, Preview, Development |
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` | Production, Preview, Development |

5. **Save** 클릭

#### 3-2. Vercel CLI로 설정 (선택사항)

```bash
vercel env add GITHUB_GIST_ID
# 입력: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
# Scope: Production, Preview, Development 모두 선택

vercel env add GITHUB_TOKEN
# 입력: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Scope: Production, Preview, Development 모두 선택
```

---

### 4. 로컬 환경 설정 (.env 파일)

```bash
# /home/knoww/investar/.env
KIS_APP_KEY=your_kis_app_key
KIS_APP_SECRET=your_kis_app_secret

# GitHub Gist 설정 (추가)
GITHUB_GIST_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 5. 배포 및 테스트

#### 5-1. Vercel 재배포

```bash
# 환경변수 적용을 위해 재배포
vercel --prod
```

#### 5-2. 패턴 분석 실행

```bash
# 패턴 분석 (Gist에 자동 저장)
curl -X POST https://investar-xi.vercel.app/api/patterns/analyze
```

**예상 로그**:
```
🔍 스마트 패턴 분석 시작...
💾 GitHub Gist에 패턴 저장 시도...
✅ GitHub Gist 저장 성공
✅ 패턴 분석 완료: 5개 패턴 발견
```

#### 5-3. 패턴 목록 조회

```bash
# 패턴 로드 (Gist에서 자동 로드)
curl https://investar-xi.vercel.app/api/patterns/list
```

**예상 응답**:
```json
{
  "success": true,
  "count": 5,
  "patterns": [...],
  "source": "gist"
}
```

---

## 🔍 동작 원리

### 저장 흐름 (analyze.js)

1. 패턴 분석 완료
2. `gistStorage.savePatterns()` 호출
3. GitHub API로 Gist 업데이트 (PATCH 요청)
4. 메모리 캐시에도 저장 (fallback용)

### 로드 흐름 (list.js)

1. **1순위**: GitHub Gist에서 로드 (`gistStorage.loadPatterns()`)
2. **2순위**: 메모리 캐시에서 로드 (Gist 실패 시)
3. **3순위**: 로컬 파일에서 로드 (로컬 개발용)

### 코드 구조

```
backend/gistStorage.js
  ├─ savePatterns(data)      # GitHub API PATCH
  ├─ loadPatterns()          # Public raw URL GET
  └─ isConfigured()          # 환경변수 확인

api/patterns/analyze.js       # 패턴 저장
  └─ gistStorage.savePatterns()

api/patterns/list.js          # 패턴 로드
  └─ gistStorage.loadPatterns()

backend/smartPatternMining.js
  ├─ loadSavedPatterns()      # sync 버전 (캐시만)
  └─ loadSavedPatternsAsync() # async 버전 (Gist 포함)
```

---

## 🐛 트러블슈팅

### 문제 1: "GitHub Gist 저장 실패"

**원인**: `GITHUB_TOKEN` 권한 부족 또는 잘못된 토큰

**해결**:
1. GitHub Token에 `gist` scope 포함 확인
2. Token 만료 여부 확인
3. Vercel 환경변수 올바르게 설정 확인

```bash
# Vercel 환경변수 확인
vercel env ls
```

---

### 문제 2: "Gist에 저장된 패턴 없음" (404)

**원인**: `GITHUB_GIST_ID` 오류 또는 Gist가 Private

**해결**:
1. Gist가 **Public**인지 확인
2. Gist ID 정확히 복사했는지 확인 (32자리)
3. Raw URL 직접 접근 테스트:
   ```bash
   curl https://gist.githubusercontent.com/knwwhr/[GIST_ID]/raw/investar-patterns.json
   ```

---

### 문제 3: 로컬에서 "GitHub Gist 미설정" 경고

**원인**: `.env` 파일에 환경변수 누락

**해결**:
```bash
# .env 파일에 추가
echo "GITHUB_GIST_ID=your_gist_id" >> .env
echo "GITHUB_TOKEN=your_token" >> .env

# 서버 재시작
npm start
```

---

## 📊 검증 방법

### 1. Gist 저장 확인

패턴 분석 후 Gist URL 직접 확인:
```
https://gist.github.com/knwwhr/[GIST_ID]
```

파일 내용에 `patterns` 배열이 있어야 함.

### 2. API 로그 확인

Vercel Dashboard → Project → Logs에서 다음 로그 확인:
```
✅ GitHub Gist에서 5개 패턴 로드 완료
```

### 3. 응답 헤더 확인

```bash
curl -v https://investar-xi.vercel.app/api/patterns/list | grep "source"
# "source": "gist" 확인
```

---

## 🔒 보안 주의사항

1. **GITHUB_TOKEN은 절대 Git에 커밋하지 마세요!**
   - `.env` 파일은 `.gitignore`에 추가되어 있음
   - Vercel 환경변수로만 관리

2. **Token 권한 최소화**
   - `gist` scope만 부여 (repo 접근 불필요)

3. **Token 주기적 갱신**
   - 보안을 위해 6개월마다 토큰 재발급 권장

4. **Public Gist 사용**
   - 민감한 데이터는 저장하지 마세요
   - 패턴 통계 정보만 저장 (개인정보 없음)

---

## 📚 관련 문서

- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [GitHub Gist API](https://docs.github.com/en/rest/gists)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**마지막 업데이트**: 2025-10-28
**문의**: GitHub Issues 또는 직접 연락
