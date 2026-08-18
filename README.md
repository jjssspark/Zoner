# Zoner

**웹캠으로 학습 집중도를 실시간으로 재고, 세션이 끝나면 근거가 붙은 리포트를 만들어 주는 웹 앱.**

공부한 시간은 어디서나 기록되지만 "그 시간에 실제로 집중했는지"는 아무도 알려주지 않는다.
Zoner는 학습 중 웹캠 영상을 **브라우저 안에서만** 분석해 5초마다 집중 여부를 판정하고,
끝나면 언제 무너졌는지·무엇이 방해했는지를 수치로 돌려준다.

![데모](output/demo.gif)

> 실제 사용 흐름 59초 — 로그인 → 측정 → 자리비움 알림 → 영상 저장 → 리포트 → PDF 저장 →
> AI 채팅 → 기록 열람(과거 리포트 다시 열기). 측정 대기 구간은 최대 12배속으로 줄였고,
> 알림이 뜨는 순간과 저장 확인 대화상자는 등속으로 뒀다.
> 원본 화질은 **[YouTube](https://youtu.be/JEL13w3MUCg)** 에서 볼 수 있다.

**▶ https://zoner-one.vercel.app**

> **신규 가입은 막아 뒀다.** 웹캠을 다루는 서비스라 불특정 다수의 계정을 받지 않았고,
> AI 기능이 개인 API 키를 쓰기 때문이다. 화면과 동작은 위 데모 영상과 아래 스크린샷으로
> 확인할 수 있다.
>
> 직접 돌려보려면 [로컬 실행](#로컬-실행)으로 3분이면 된다. 본인 Supabase 프로젝트가
> 필요하고, 웹캠은 브라우저 정책상 `https` 또는 `localhost`에서만 열린다.

---

## 핵심 기능

### 1. 실시간 집중도 측정

![학습 화면](output/screenshots/02-start-learning.png)

> 웹캠 권한을 받은 직후, 측정을 시작하기 전 화면이다.
> 미리보기의 얼굴은 공개용으로 가렸다 — 실제로는 그대로 보인다.

웹캠 프레임에서 얼굴 랜드마크를 뽑아 **5초마다** 한 번씩 판정한다. 결과는 6개 상태 중 하나다.

| 상태 | 판정 기준 | 집중으로 집계 |
|---|---|---|
| `focused` | 정면 응시 | ✅ |
| `looking_down` | 고개 숙임(pitch < −20°) 또는 시선 하향 | ✅ |
| `head_turned` | 고개 좌우 회전(yaw 절댓값 > 30°) | ❌ |
| `looking_up` | 고개 들림(pitch > 20°) | ❌ |
| `eyes_closed` | 양눈 감김이 **연속 2회** | ❌ |
| `absent` | 얼굴 미검출 | ❌ |

화면에는 누적 평균이 아니라 **최근 2분 이동 창**의 집중률을 띄운다.
누적 평균은 세션이 길어질수록 둔해져서, 30분쯤 지나면 고개를 들어도 숫자가 거의 안 움직인다.

### 2. 비집중 알림

집중이 무너지면 화면 배너와 소리로 알린다. 알림 발생 시각은 세션에 함께 저장돼 리포트의 `시간당 알림 횟수`가 된다.

### 3. 세션 리포트

![리포트](output/screenshots/03-report.png)

저장된 세션 하나만 보고 파생 지표 9종을 계산한다 — 순 집중 시간, 최장 집중 지속, 첫 이탈 시점,
전·후반 격차, 변동성(모표준편차), 최고/최저 구간, 시간당 알림, 최대 방해 원인.

여기에 **AI 조언 문단**이 붙는다. 단, 수치는 전부 앱이 계산해 넘기고 모델은 읽기만 한다.
모델에게 통계를 시키면 숫자가 틀린다.

### 4. PDF 저장

![인쇄 미리보기](output/screenshots/06-print-preview.png)

리포트를 인쇄용 문서 레이아웃으로 재구성해 저장한다. 화면용 계측 장식(격자·노치·브래킷·글로우)은
인쇄 시 일괄 해제된다.

미리보기의 **「배경 그래픽」이 켜진 상태**다. 이 옵션이 꺼지면 그래프 막대와 배지 색이 통째로
사라진다 — 인쇄 토큰을 CSS 소스 순서 문제로 놓쳤던 [TS-018·TS-019](docs/TROUBLESHOOTING.md)의
재발 여부를 이 화면 하나로 확인한다.

### 5. AI 튜터 채팅

![AI 채팅](output/screenshots/05-ai-chat.png)

대화별로 이력이 남는 학습 보조 채팅(1일 30메시지 제한).

### 6. 마이페이지 · 휴지통 복구

![마이페이지](output/screenshots/04-mypage.png)

평균 집중도와 최근 세션을 모아 보여준다. 삭제한 세션은 휴지통을 거쳐 복구할 수 있다.

> 좌상단 사용자 이름은 공개용으로 가렸다.

---

## 설계에서 신경 쓴 것

자랑을 늘어놓기보다, 판단이 갈렸던 지점만 적는다.

**얼굴 추론을 서버가 아니라 브라우저에서 돌린다.**
학습 영상은 민감한 데이터다. 프레임을 서버로 보내면 전송·보관 양쪽에서 책임이 생기고 지연도 붙는다.
MediaPipe FaceLandmarker를 WASM+GPU로 브라우저에서 실행해 **영상 프레임이 기기 밖으로 나가지 않게** 했다.
서버에 올라가는 건 5초마다 한 번씩 나오는 판정 결과(집중 여부와 사유)뿐이다.

**`looking_down`을 집중으로 집계한다.**
얼굴만 보는 모델로는 교재를 보는 것과 휴대폰을 보는 것을 구분할 수 없다.
둘 중 하나로 정해야 한다면, **공부 중인 사용자를 딴짓으로 오판하는 쪽이 반대 방향 오차보다 비용이 크다**고 봤다.
잘못 칭찬하면 넘어가지만, 잘못 혼내면 앱을 끈다.

**눈 감김은 연속 2회일 때만 졸음으로 본다.**
깜빡임은 0.1~0.4초다. 5초 샘플링으로는 깜빡임과 졸음을 한 번에 구분할 수 없다.
샘플링 주기를 줄이는 대신 연속성 조건을 붙였다 — 배터리와 발열을 덜 쓰는 쪽을 골랐다.

**리포트의 "무너짐" 판정에서 앞 2분을 뺀다.**
카메라가 얼굴을 잡고 자세를 잡는 동안이라 거의 모든 세션이 0분 구간에서 낮게 찍힌다.
그대로 세면 "집중 지속 한계 약 0분" 같은 뜻 없는 값이 나온다. 워밍업은 이탈이 아니다.

**권한을 앱 코드가 아니라 DB에서 막는다.**
모든 테이블과 스토리지 버킷에 RLS를 켜고 정책 17개를 `auth.uid() = user_id`로 걸었다.
앱 코드에서 소유자 조건을 빠뜨려도 남의 데이터가 새지 않는다.

**Anthropic API 키는 클라이언트에 없다.**
AI 기능은 전부 Supabase Edge Function을 거친다. 브라우저가 아는 건 Supabase anon 키뿐이고,
그건 RLS로 보호된다. Edge Function은 클라이언트가 보낸 본문을 신뢰하지 않는다 —
숫자는 `Number`로 강제 변환하고 라벨은 허용 목록으로만 받는다. 프롬프트 인젝션 방지다.

**다크 단일 테마로 고정했다.**
라이트 테마를 추가하면 전 화면 대비비를 다시 검증해야 한다.
두 테마를 어설프게 지원하느니 한쪽을 제대로 하는 편이 낫다고 판단했다.

---

## 기술 스택

무엇을 썼는지보다 왜 골랐는지가 중요하다.

| 기술 | 왜 |
|---|---|
| **React 19** | 화면 상태가 많고(측정 중·일시정지·경고·저장) 컴포넌트 재사용이 필요했다 |
| **Create React App** | 이미 CRA로 시작한 프로젝트다. Vite 이전은 기능 완성보다 우선순위가 낮다고 보고 미뤘다 — 대신 [알려진 한계](#알려진-한계)에 적어 둔다 |
| **MediaPipe Tasks Vision** | 브라우저에서 WASM+GPU로 도는 얼굴 랜드마크 모델. 자체 학습 없이 랜드마크·블렌드셰이프·머리 회전 행렬을 한 번에 준다 |
| **Supabase** | Auth·Postgres·Storage·Edge Functions를 한 곳에서 받는다. 개인 프로젝트에서 인증 서버를 직접 만들 이유가 없었다. RLS가 결정적이었다 |
| **Edge Functions (Deno)** | API 키를 서버 쪽에 두기 위한 최소 백엔드. 별도 서버를 띄우지 않아도 된다 |
| **Claude Haiku 4.5** | 조언 문단 생성·채팅 응답용. 응답 속도와 비용이 중요했고, 수치 계산은 어차피 앱이 하므로 상위 모델이 필요 없었다 |
| **Jest + Testing Library** | CRA 번들 그대로. 순수 로직(`src/lib/`) 위주로 덮었다 |

---

## 아키텍처

```mermaid
flowchart TB
    subgraph browser["브라우저 — 영상은 여기서 나가지 않는다"]
        cam["웹캠 getUserMedia"]
        mp["MediaPipe FaceLandmarker<br/>WASM + GPU"]
        tracker["focusTracker<br/>5초마다 판정"]
        rec["MediaRecorder<br/>세션 녹화"]
        app["React 19 SPA<br/>react-router-dom 7"]

        cam --> mp --> tracker --> app
        cam --> rec --> app
    end

    subgraph cdn["외부 CDN — 런타임 의존"]
        wasm["jsdelivr<br/>tasks-vision WASM"]
        model["Google Storage<br/>face_landmarker.task"]
    end

    subgraph supabase["Supabase"]
        auth["Auth"]
        db[("Postgres + RLS<br/>profiles · study_sessions<br/>chat_messages · conversations")]
        store[("Storage<br/>session-videos 버킷")]
        fn["Edge Functions<br/>ai-chat · report-insight"]
    end

    anthropic["Anthropic API<br/>claude-haiku-4-5"]

    wasm -. 최초 1회 로드 .-> mp
    model -. 최초 1회 로드 .-> mp

    app -->|"판정 결과만 — 프레임 아님"| db
    app --> auth
    app -->|"영상 파일"| store
    app -->|"지표 + 프로필"| fn
    fn -->|"SERVICE_ROLE 키"| db
    fn -->|"API 키는 여기에만"| anthropic
```

읽는 순서에서 중요한 두 가지다.

- **웹캠 프레임은 브라우저 경계를 넘지 않는다.** Supabase로 가는 건 판정 결과와, 사용자가 켰을 때의 녹화 파일이다.
- **MediaPipe의 WASM 런타임과 모델 가중치는 외부 CDN에서 받는다.** 오프라인에서는 측정이 시작되지 않는다.
  개인 프로젝트라 CDN을 그대로 썼지만, 실서비스라면 자가 호스팅 대상이다.

---

## 로컬 실행

```bash
git clone https://github.com/jjssspark/Zoner.git
cd Zoner
npm install

cp .env.example .env
# .env에 Supabase 프로젝트의 URL과 anon 키를 채운다
#   REACT_APP_SUPABASE_URL=https://<project-ref>.supabase.co
#   REACT_APP_SUPABASE_ANON_KEY=<anon key>

npm start        # http://localhost:3000
```

DB 스키마가 필요하면 `supabase/migrations/`의 SQL 11개를 파일명 순서대로 실행한다.
순서 의존이 있으니 [`docs/DATABASE.md`](docs/DATABASE.md)의 적용 순서 절을 먼저 읽는 편이 좋다.

AI 기능(`/ai-chat`, 리포트 조언)까지 쓰려면 Edge Function 2개를 배포하고 `ANTHROPIC_API_KEY`를 설정해야 한다.
두 함수의 요청·응답 계약은 [`docs/API.md`](docs/API.md)에 있다.

```bash
supabase functions deploy ai-chat
supabase functions deploy report-insight
supabase secrets set ANTHROPIC_API_KEY=<key>
```

**웹캠 권한이 필요하다.** 브라우저 정책상 `localhost` 또는 `https`에서만 카메라가 열린다.

### 기타 명령

```bash
CI=true npx react-scripts test --watchAll=false   # 테스트 전체
npx react-scripts build                           # 프로덕션 빌드
```

---

## 데이터 모델

| 테이블 | 용도 | RLS |
|---|---|---|
| `profiles` | 사용자 프로필 | select / insert / update — 본인만 |
| `study_sessions` | 세션 결과. 집중 점수, 분 단위 타임라인, 원인별 비율, 알림 기록, 영상 경로, 휴지통 플래그 | select / insert / update / delete — 본인만 |
| `conversations` | AI 채팅 대화방 | select / insert / update / delete — 본인만 |
| `chat_messages` | 대화 메시지 | select / insert — 본인만 |
| `session-videos` (Storage) | 세션 녹화 파일. 경로 첫 폴더가 `auth.uid()` | select / insert / update / delete — 본인만 |

정책 17개가 전부 `auth.uid() = user_id` 기준이다. 원문은 `supabase/migrations/`에 있고,
스키마·인덱스·마이그레이션 순서 의존은 [`docs/DATABASE.md`](docs/DATABASE.md)에 정리했다.

---

## 테스트

```
Test Suites: 22 passed, 22 total
Tests:       276 passed, 276 total
```

화면 컴포넌트가 아니라 **판단이 들어간 순수 로직**을 덮었다 — 집중 판정 임계값 경계,
세션 집계, 파생 지표, 알림 규칙, 학습 성향 분류, 휴지통 상태 전이, 녹화 상태 전이,
그리고 CSS 토큰 참조 정합성.

`react-router-dom`을 import 하는 파일에는 테스트를 쓰지 않는다.
CRA 번들 Jest 리졸버가 v7 exports 맵을 해석하지 못한다 (`docs/TROUBLESHOOTING.md` TS-003).
그래서 순수 함수는 `src/lib/`에, 라우터에 의존하지 않는 프레젠테이션 컴포넌트는 `src/components/ui/`에 둔다.

### 번들 크기 (gzip)

| | 크기 |
|---|---|
| JS (main) | 150.78 kB |
| CSS | 11.8 kB |

### Lighthouse

배포된 랜딩(`https://zoner-one.vercel.app`)을 Lighthouse 12.8.2로 측정한 값이다.

| | 데스크톱 | 모바일 |
|---|---|---|
| Performance | 87 | 55 |
| Accessibility | **100** | **100** |
| Best Practices | **100** | **100** |
| SEO | **100** | **100** |
| LCP · TBT · CLS | 2.4 s · 0 ms · 0 | 16.6 s · 0 ms · 0 |

```bash
npx lighthouse https://zoner-one.vercel.app --preset=desktop --view
npx lighthouse https://zoner-one.vercel.app --view   # 기본값이 모바일이다
```

**모바일 55점은 전부 렌더 블로킹이다** (예상 절감 10.9초). CRA SPA라 JS 151 kB가 실행돼야
첫 화면이 그려지는데, 모바일 프리셋의 CPU 4배 감속과 느린 4G 시뮬레이션에서 그게 그대로
지연으로 잡힌다. 데스크톱에서는 같은 항목이 240 ms다. 코드 스플리팅이나 Vite 이전이 해법이고,
[ADR-003](docs/adr/003-keep-cra.md)에 **부채로 등록해 둔** 항목이다.

측정은 랜딩까지만 가능하다 — 정작 무거운 화면(측정·리포트)은 로그인 뒤라 들어가지 못한다.

---

## 프로젝트 구조

```
src/
├── features/          기능 단위. 이 안에서 자급자족한다
│   ├── marketing/     Home · FAQ · Pricing · UserGuide
│   ├── auth/          Login · SignUp
│   ├── learning/      StartLearning (측정 화면)
│   ├── records/       Save · Read(리포트) · Trash · Trashread
│   ├── profile/       Mypage
│   └── chat/          AiChat
├── components/
│   ├── layout/        NavBar
│   └── ui/            ScoreRing · Sparkline · Skeleton · ReasonBadge · ConfirmDialog
├── lib/               순수 로직 + 단위 테스트
└── styles/tokens.css  디자인 토큰
```

의존은 **안쪽으로만** 흐른다: `features/` → `components/` → `lib/`.
`features/A`는 `features/B`를 직접 import 하지 않는다. 공유가 필요하면 위로 올린다.

---

## 문서

| 문서 | 내용 |
|---|---|
| [`docs/adr/`](docs/adr/README.md) | 기술 의사결정 5건. 결과 칸에 **틀린 예측을 그대로** 적었다 |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | TS-001~021 전문. 증상·재현 조건·**실패한 시도**·근본 원인·검증 |
| [`docs/API.md`](docs/API.md) | Edge Functions 2개의 요청·응답 계약 |
| [`docs/DATABASE.md`](docs/DATABASE.md) | 스키마·RLS 17정책·마이그레이션 순서 의존 |

트러블슈팅 21건 중 몇 가지만 꼽자면:

- **TS-010** — 로딩 해제를 보장하려고 넣은 가드가 StrictMode에서 화면을 영구히 멈춘 건. **독립 리뷰 3회를 통과했다**
- **TS-012** — 테이블에 있는 컬럼이 뷰에는 없어서, 하루 넘게 에러 없이 반쪽만 살아 있던 건
- **TS-020** — 로컬에서 되던 빌드가 배포에서만 깨진 건. 완료 기준이 CI 조건을 재현하지 않았다

구현 속도는 AI 도구로 올렸고, 판단은 내가 했다. 무엇을 왜 골랐는지는 `docs/adr/`에,
무엇이 왜 틀렸는지는 `docs/TROUBLESHOOTING.md`에 있다.

---

## 알려진 한계

아는 것과 모르는 것을 구분하는 게 더 중요하다.

- **얼굴만 본다.** 교재를 보는지 휴대폰을 보는지 구분하지 못한다. 그래서 `looking_down`을 집중으로 집계하는 쪽을 택했다.
- **1인 기준.** `numFaces: 1`이라 여러 명이 잡히는 환경은 고려하지 않았다.
- **외부 CDN 의존.** MediaPipe WASM·모델을 런타임에 받아 오므로 오프라인에서는 측정이 시작되지 않는다.
- **CRA를 유지 중.** `react-scripts` 5.0.1은 유지보수가 멈춘 상태다. 이전 비용을 알면서 남겨 둔 부채다.
- **테스트가 로직에 치우쳐 있다.** 화면 단위 E2E가 없다. 위 리졸버 제약이 이유이지만, Playwright로 우회할 수 있는 문제이기도 하다.

---

## 라이선스

[MIT](LICENSE)
