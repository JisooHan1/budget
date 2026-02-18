# 📒 내 가계부 (Firebase 버전)

Google 로그인으로 PC/모바일 데이터 동기화되는 가계부 앱입니다.

---

## 설정 순서

Firebase 프로젝트 만들기 → Firestore 활성화 → 환경변수 입력 → 배포

---

## STEP 1 — Firebase 프로젝트 만들기

1. [console.firebase.google.com](https://console.firebase.google.com) 접속
2. **프로젝트 추가** 클릭
   - 프로젝트 이름: `my-budget`
   - Google Analytics: 사용 안 함 선택
3. **프로젝트 만들기** 클릭

---

## STEP 2 — Firestore Database 만들기

1. 왼쪽 메뉴 **Firestore Database** 클릭
2. **데이터베이스 만들기** 클릭
3. **프로덕션 모드로 시작** 선택
4. 위치: **asia-northeast3 (서울)** 선택
5. **사용 설정** 클릭

**규칙 설정:**
상단 **규칙** 탭 클릭 → 아래 내용으로 교체:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /transactions/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
    match /fixed_items/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
```

**게시** 클릭

---

## STEP 3 — Authentication 설정

1. 왼쪽 메뉴 **Authentication** 클릭
2. **시작하기** 클릭
3. **Google** 클릭
   - 사용 설정 토글 ON
   - 프로젝트 지원 이메일 선택
   - **저장** 클릭

---

## STEP 4 — 웹 앱 등록 & 키 복사

1. 프로젝트 개요 (왼쪽 맨 위) → **</> 웹** 아이콘 클릭
2. 앱 이름: `my-budget-web`
3. **앱 등록** 클릭
4. **firebaseConfig** 객체가 나타나면 값들 복사:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

---

## STEP 5 — Vercel 환경변수 설정

[vercel.com](https://vercel.com) → 프로젝트 → **Settings** → **Environment Variables**

아래 6개 추가:

| Name | Value (Firebase에서 복사) |
|------|---------------------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `my-budget-xxxxx.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `my-budget-xxxxx` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `my-budget-xxxxx.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `VITE_FIREBASE_APP_ID` | `1:123456789:web:abcdef` |

---

## STEP 6 — GitHub push & 재배포

```bash
git add .
git commit -m "Firebase 연동"
git push
```

Vercel이 자동 재배포 → **Deployments** 탭에서 **Redeploy** 클릭 (환경변수 반영)

---

## 사용 방법

1. 배포된 URL 접속
2. **Google 계정으로 로그인** 클릭
3. Google 계정 선택
4. PC/모바일 어디서든 같은 계정으로 로그인하면 **데이터 동기화**

---

## 로컬 테스트

`.env.local` 파일 생성:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=my-budget-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-budget-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=my-budget-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

```bash
npm install
npm run dev
```
