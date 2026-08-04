# Zoner UI 리디자인 — 다크 테크 대시보드

## 배경

Zoner는 학습 영상을 녹화하고 AI가 집중도를 분석해주는 학습 서비스다. 현재 UI는 Figma 익스포트를 그대로 옮긴 `position: absolute` + 고정 1440px 레이아웃으로, 반응형이 없고 시맨틱 HTML/접근성/디자인 토큰이 전무하다 (프로젝트 표준 `.claude/standards/design-tokens.md`, `accessibility.md` 미준수). 사용자 평가: "지금 넘 구림".

## 목표

Home, Login, SignUp, Mypage 4개 핵심 페이지를 "AI·집중도 분석" 느낌의 다크 테크 대시보드 스타일로 재작성한다. 나머지 9개 페이지(Save, Read, Report_a, Save_report, Trash, Trashread, Pricing, FAQ, UserGuide)는 이번 범위에서 제외하되, 공용 토큰/네비게이션은 상속받도록 구조를 잡는다.

## 비주얼 방향

- **스타일**: 다크 테크 대시보드 — 어두운 배경 + 시안(cyan) 포인트 컬러. Linear/Vercel류 분석 툴 느낌.
- **팔레트**: `.claude/standards/design-tokens.md` 규약을 따라 원시→의미 2계층 oklch 토큰. 강조색은 시안 계열.
- **타이포그래피**: 헤딩은 굵은 산세리프, 본문은 Pretendard(한글 가독성, 프로젝트 표준 폰트). 최대 2종.
- **반응형**: 320~1440px, flex/grid 기반. 절대좌표 레이아웃 제거.
- **모션**: transform/opacity만 애니메이션, `prefers-reduced-motion` 대응.

## 아키텍처 / 접근 방식

기존 로직(상태, 라우팅, 핸들러)은 유지하고 마크업 구조와 CSS만 재작성한다. 절대좌표를 쓰던 구조를 flexbox/grid 기반 시맨틱 마크업으로 바꾸지 않으면 반응형이 불가능하므로, 이 부분은 선택이 아니라 필수 변경이다.

### 신규 파일

- `src/styles/tokens.css` — 색·타이포·간격·반경·그림자·모션 토큰 (전역 1회 로드)
- `src/components/NavBar.js` + `NavBar.css` — Home/Login에 중복되던 로고+메뉴(User Guide/Pricing/FAQ) 블록을 공용 컴포넌트로 통합. 모바일에서는 햄버거 메뉴로 전환.

### 수정 파일

- `src/App.js` — `tokens.css` import 추가
- `src/index.css` — 다크 배경 기본값, 리셋 보강
- `public/index.html` — `lang="ko"`, `<title>Zoner</title>`, Pretendard 폰트 `<link>`, `theme-color` 다크로 조정
- `src/components/Home.js` / `Home.css`
- `src/components/Login.js` / `Login.css`
- `src/components/SignUp.js` / `SignUp.css`
- `src/components/Mypage.js` / `Mypage.css`

## 페이지별 설계

### Home

- 상단 `NavBar` (로고 + Home/Guide/Pricing/FAQ, 우측 "시작하기" CTA)
- 히어로: "Focus Smarter, Learn Better" 헤드라인 + 서브카피 "Zoner : 학습에 혁신을 더하다" + 큰 CTA 버튼(`/login`으로 이동). 배경에 은은한 시안 글로우/그라디언트.
- 비전 섹션: 기존 3장의 원본 이미지를 그대로 쓰되, "집중도 분석 / AI 리포트 / 학습 기록" 3개 기능 카드(Bento 스타일, 아이콘 + 한 줄 설명)로 감싸 정보 위계를 부여.
- 하단에 큰 워터마크 "ZONER" 텍스트는 유지하되 opacity/blink 애니메이션은 `prefers-reduced-motion` 분기 추가.

### Login

- 다크 배경 중앙에 카드(surface 토큰, radius-lg, shadow-lg).
- `<form onSubmit>` + 실제 `<label for>` 적용 (현재는 placeholder만 존재).
- 로그인 버튼은 `<div onClick>` → `<button type="submit">`으로 교체.
- 에러 메시지는 `alert()` 대신 카드 내부 `role="alert"` 텍스트로 인라인 표시.
- 하단 "회원가입하기"는 기존처럼 SignUp 모달 오픈 유지.

### SignUp

- Login과 동일한 카드 스타일 적용 (모달/독립 라우트 양쪽에서 재사용되므로 컴포넌트 자체 스타일만 교체, 로직 변경 없음).
- 입력 필드에 `<label>` 추가, 포커스 상태 시각화.

### Mypage

- 상단에 사용자 이름 + 원형 게이지 형태의 "집중도" 시각 요소 (정적/샘플 표시 — 실제 AI 데이터 연동 없음, 순수 UI).
- "최근 기록" / "최근 리포트"를 카드 그리드로 재배치 (기존 배열 상태·조건부 렌더링 로직 그대로 사용).
- 빠른 액션(AI 채팅, 학습 시작, 학습 기록, 학습 리포트, 휴지통, 로그아웃)을 아이콘+라벨 버튼 그리드로 재배치.
- "추천 서비스" 3개 항목(요금제 업그레이드/개인 설정/프로모션)은 카드 리스트로.

## 접근성

- 모든 인터랙티브 요소를 `<button>`/`<a>`로 (현재 `<div onClick>` 존재).
- 포커스 링(`:focus-visible`) 전 컴포넌트 적용, `outline: none` 단독 사용 금지.
- 이미지 alt 텍스트 정리 (기존 eslint `jsx-a11y/img-redundant-alt` 경고 해소).
- 로그인 에러를 `aria-live`/`role="alert"`로 스크린리더에 전달.

## 범위 밖 (명시적 제외)

- Save, Read, Report_a, Save_report, Trash, Trashread, Pricing, FAQ, UserGuide 페이지 재디자인
- 실제 AI 집중도 분석 로직, 백엔드/API 연동
- 신규 상태관리 라이브러리, 테스트 프레임워크 등 새 의존성 추가 (폰트 `<link>` 제외)
- 다크/라이트 토글 기능 (이번 라운드는 다크 고정)

## 검증

- `npm start` 컴파일 성공, 콘솔 에러 없음
- 4개 페이지를 320px / 768px / 1440px에서 레이아웃 깨짐 없이 확인
- Tab 키만으로 로그인 폼 전체 흐름 가능한지 확인
- 기존 라우팅/상태 로직(로그인 검증, 회원가입 모달, Mypage 영상 리스트) 동작 유지 확인
