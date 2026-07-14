# 🍇 GrapeNote

피아노 학원의 종이 진도카드(포도알 스티커)를 온라인으로 옮긴 웹서비스.

**핵심 루프**: 학생이 포도송이 카드의 빈 포도알을 탭 → 연습 영상 촬영/업로드 → 선생님이 영상 확인 후 **합격**(포도알 채워짐 🍇) 또는 **재연습**(코멘트와 함께 다시 도전 ↺) 판정. 연습 1회 = 영상 1개 = 포도알 1개.

## 스택

- **Next.js 16** (App Router, TypeScript) + Tailwind CSS 4
- **Supabase** — Auth / Postgres(RLS) / Storage
- 배포: Vercel

## 시작하기

### 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com)에서 프로젝트 생성 (리전: Northeast Asia — Seoul 권장)
2. **SQL Editor**에서 `supabase/migrations/` 아래 SQL 3개를 순서대로 실행
   (`0001_init.sql` → `0002_rls.sql` → `0003_storage.sql`)
3. **Authentication → Sign In / Providers → Email**: 활성화 + **Confirm email 끄기**
4. **Project Settings → API**에서 키 복사

### 2. 로컬 실행

```bash
cp .env.example .env.local   # 키 3개 채우기
npm install
npm run dev
```

### 3. 테스트

```bash
npm test        # 포도알 상태 머신 단위 테스트 (vitest)
npm run build   # 타입/빌드 검증
```

## 구조

- `supabase/migrations/` — 스키마, RLS 정책, Storage 버킷
- `src/lib/grapes.ts` — 포도알 상태 유도 (submissions → empty/pending/approved/retry)
- `src/lib/actions/` — 서버 액션 (인증, 초대, 카드, 업로드, 판정)
- `src/components/GrapeBunch.tsx` — 포도송이 SVG
- `src/proxy.ts` — 세션 갱신 + 역할(teacher/student) 라우트 가드

## 계정 구조

- **선생님**: 이메일 가입 → 온보딩에서 학원 생성
- **학생**: 선생님이 발급한 초대코드로 가입 → 아이디 + 숫자 6자리 비밀번호
  (내부적으로 `{아이디}@student.grapenote.app` 가짜 이메일로 Supabase Auth 사용)

## 보안 모델

- 데이터 접근은 전부 Postgres **RLS**로 강제 (role/academy_id는 JWT `app_metadata`)
- 영상 버킷은 private + Storage 정책 없음 — 업로드는 signed upload URL, 재생은 서버 검증 후 발급되는 signed URL(1시간)만 사용
- 학생은 submission을 `pending`으로 insert만 가능 — 셀프 합격 불가
