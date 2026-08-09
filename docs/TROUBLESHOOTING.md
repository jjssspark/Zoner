# Zoner 트러블슈팅 기록

> 이 프로젝트(Zoner) 전용 트러블슈팅 로그. 백엔드/DB 작업을 진행하면서 겪는 문제를 여기 누적한다.
> 전역 트러블슈팅 로그는 `~/Project/TROUBLESHOOTING.md` (다른 프로젝트 공통).

## 작성 규칙

아래 중 하나라도 해당하면 기록한다:
- 원인을 찾는 데 도구 호출 3회 이상 또는 대화 5턴 이상 걸림
- 처음 세운 가설이 틀려서 방향을 바꿈
- 에러 메시지와 실제 원인이 직관적으로 안 이어짐
- 환경·설정·인프라(DB 연결, 배포, 의존성 버전) 문제
- 간헐적으로만 재현됨
- 근본 해결이 아니라 우회로 넘어감

각 항목은 다음을 반드시 포함한다: **문제 / 원인 / 해결방안 / 추후 방안 / 왜 그렇게 했나(의사결정 근거)**.

---

## 인덱스

| ID | 날짜 | 문제 | 상태 |
|---|---|---|---|
| TS-017 | 2026-08-07 | 진입 연출 폴백이 트랜지션에 의존해, 애니메이션이 억제된 환경에서 콘텐츠가 계속 투명했다. 첫 가설(명시도)은 틀렸고 계산값 판독 자체가 거짓이었다 | 해결 |
| TS-016 | 2026-08-07 | 본문 대비비만 보고 통과시킬 뻔함. `--color-border-strong`이 UI 경계 3:1(WCAG 1.4.11)에 미달 — surface 위 2.83:1. 토큰 이름이 `strong`이라 충분해 보였다 | 부분 해결 |
| TS-015 | 2026-08-07 | 설계 문서가 요구한 `hidden` 토글과 아코디언 열림 애니메이션이 양립 불가. `hidden`은 `display: none`이라 전환이 시작조차 안 된다 | 해결 |
| TS-014 | 2026-08-07 | 브라우저 창 리사이즈가 "성공"을 보고하고도 뷰포트를 안 바꿔, 반응형 검증이 1703px에서 측정한 거짓 통과를 냄 | 해결(우회) |
| TS-013 | 2026-08-06 | 개발 서버가 시연 도중 두 번 죽음. 에이전트 백그라운드 태스크로 띄우면 턴 경계에서 회수된다. 게다가 "떠 있다"고 확인 없이 보고해 사용자가 헛걸음함 | 해결(우회) |
| TS-012 | 2026-08-06 | 테이블에 있는 컬럼이 뷰에서 `does not exist`. 컬럼을 고정 나열한 뷰를 갱신하지 않아, 저장은 되는데 화면에서는 읽을 수 없는 데이터가 하루 넘게 방치됨 | 해결 |
| TS-011 | 2026-08-06 | 320px에서 AI 채팅에 가로 스크롤. 전역 `box-sizing` 리셋이 페이지 클래스 5개만 손으로 나열해 적용돼 있어, 새로 만든 화면은 조용히 content-box로 남는다 | 해결 |
| TS-010 | 2026-08-06 | AI 채팅이 빈 화면에서 영구히 멈춤. 로딩 해제를 지키려고 넣은 `isMountedRef` 가드가 StrictMode 재마운트에서 `false`로 굳어 로딩 해제를 통째로 건너뜀. 정적 리뷰 3회를 통과한 코드였다 | 해결 |
| TS-009 | 2026-08-06 | 학습 종료 후에도 맥 카메라 표시등이 계속 켜져 있음. 원인이 세 갈래였고, 그중 하나는 StrictMode에서 매번 발생하는 경쟁 조건 | 해결 |
| TS-008 | 2026-08-06 | Mypage가 스켈레톤 상태로 영구히 멈춤. 뷰에 `HEAD`+`count=exact` 요청이 503을 내고, 그 실패가 `setIsLoading(false)`에 도달하지 못하게 막았다 | 해결 |
| TS-007 | 2026-08-05 | Home 스크롤 리빌이 `IntersectionObserver`에 콘텐츠 가시성을 걸어, 옵저버 미발화 시 랜딩 페이지가 빈 화면. 자동화 탭에서 IO가 억제돼 검증 자체가 불가능했다 | 해결 |
| TS-006 | 2026-08-05 | WCAG 대비비 손계산이 서로 다르게 나옴 — Chrome이 computed color를 `oklch()` 리터럴로 반환하는데 L/C/H를 R/G/B로 오독 | 해결 |
| TS-005 | 2026-08-05 | 학습 시간을 `setInterval` 틱 개수로 저장해 백그라운드 탭에서 과소 기록 (브라우저 타이머 스로틀링) | 해결 |
| TS-004 | 2026-08-05 | AI 채팅이 항상 502 — Edge Function 시크릿이 `ANTROPIC_API_KEY`(H 누락)로 등록돼 키가 `undefined` | 해결 |
| TS-003 | 2026-08-05 | `npm test` 전체 실행 시 `react-router-dom` 모듈을 못 찾아 App.test.js만 실패 (CRA Jest 리졸버가 v7 exports map 미지원) | 해결(우회) |
| TS-002 | 2026-08-05 | React StrictMode 이중 렌더링으로 웹캠 play()가 인터럽트되어 dev 오버레이 에러 발생 | 해결 |
| TS-001 | 2026-08-05 | Supabase SQL Editor(Monaco)에서 여러 줄 SQL 붙여넣기 시 괄호 자동완성으로 SQL이 깨짐 | 해결(우회) |

---

## 기록

<!-- 여기부터 순서대로 이어 붙인다 -->

### TS-001: Supabase SQL Editor(Monaco)에서 여러 줄 SQL 붙여넣기 시 괄호 자동완성으로 SQL이 깨짐

**날짜**: 2026-08-05
**상태**: 해결(우회)

**문제**
`study_sessions` 테이블 마이그레이션 SQL을 여러 줄로 포맷팅해서 SQL Editor에 타이핑(브라우저 자동화로 키 입력 시뮬레이션)하니, 화면상 들여쓰기가 줄마다 계속 누적되고 맨 끝에 짝이 안 맞는 `)`가 남았다.

**재현 조건**
Monaco 기반 에디터(Supabase SQL Editor)에 `create table foo (\n  ...,\n);` 처럼 여는 괄호 뒤에 줄바꿈이 들어가는 여러 줄 SQL을 시뮬레이션 키 입력으로 타이핑할 때.

**원인**
- 표면: 결과 화면에 orphan `)`와 과도한 들여쓰기가 보임
- 근본(확인함): Monaco는 `(` 입력 시 자동으로 `)`를 같이 삽입한다. 그 상태에서 Enter를 치면 자동 삽입됐던 `)`가 새 줄로 밀려 내려가며 원래 자리를 벗어난다. 이후 내가 SQL 텍스트에 명시적으로 넣은 `)`가 그 자리에 또 들어가면서 괄호가 중복/미아 상태가 된다.

**시도했지만 안 된 것**
- 원본 포맷(줄바꿈 포함 multi-line SQL)을 그대로 재시도 — 같은 문제 재발
- 클릭 좌표를 바꿔 재포커스 후 재시도 — 포커스 문제가 아니었으므로 무의미

**해결**
SQL을 괄호 안에서는 줄바꿈하지 않는 한 줄짜리 statement로 평탄화(flatten)해서 입력. Enter는 statement와 statement 사이(모든 괄호가 닫힌 지점)에서만 사용. 이후 zoom 스크린샷으로 괄호 짝을 문자 단위로 대조 후 Run.

**검증**
`select * from study_sessions;` (에러 없이 0 rows), `select policyname from pg_policies where tablename = 'study_sessions';` (정책 2개 확인)로 최종 스키마가 의도대로 생성됐음을 확인.

**추후 방안**
SQL Editor에 여러 줄 SQL을 자동화로 입력해야 할 때는 처음부터 괄호 내부 줄바꿈 없는 평탄화 포맷을 기본으로 사용한다.

**배운 점**
Monaco류 코드 에디터에 시뮬레이션 키 입력으로 텍스트를 넣을 때는 "붙여넣기"가 아니라 "타이핑"으로 처리되어 자동완성/자동괄호 기능이 그대로 개입한다는 걸 전제해야 한다.

**후속 (2026-08-06) — 평탄화보다 나은 방법: Monaco 모델에 값을 직접 주입한다**

AI 채팅 대화방 분리 마이그레이션을 적용하면서 더 나은 우회법을 찾았다. 키 입력을 시뮬레이션하는 대신, 페이지 컨텍스트에서 Monaco의 모델을 직접 잡아 값을 넣는다.

```javascript
const b64 = "...";  // 파일을 base64로 인코딩해서 넘긴다 (한글·따옴표 이스케이프 회피)
const sql = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
window.monaco.editor.getModels()[0].setValue(sql);
```

`setValue`는 편집기의 입력 처리 경로를 타지 않으므로 **자동 괄호 삽입이 아예 개입하지 않는다.** 덕분에:

- SQL을 평탄화할 필요가 없다. 파일 내용을 **원본 그대로** 넣을 수 있다.
- 실행 전 괄호 짝을 문자 단위로 대조하는 절차가 불필요하다.
- `setValue` 직후 `getValue().length`로 길이를 확인하면 주입이 온전한지 한 번에 검증된다.
- base64로 감싸면 한글·따옴표·백틱이 섞인 SQL도 JS 문자열 이스케이프 문제 없이 넘어간다.

같은 방법을 Edge Functions 코드 에디터(역시 Monaco)에도 그대로 썼다. 9KB짜리 `index.ts` 전체를 한 번에 넣고 `Deploy updates`만 눌렀다.

**단, `setValue`가 React 상태에 반영되는지는 확인이 필요하다.** Monaco의 `onDidChangeContent`를 구독하는 래퍼라면 정상 반영된다(Supabase 대시보드는 두 에디터 모두 반영됐다). 반영 여부는 저장/실행 버튼이 활성화되는지, 또는 실행 결과로 확인한다.

**후속 (2026-08-06) — SQL Editor가 빈 화면으로 뜨는 간헐적 현상**

같은 세션에서 SQL Editor가 **아무것도 렌더되지 않는 흰 화면**으로 뜨는 일이 세 번 있었다. 콘솔에 에러가 없고, `window.monaco`가 `undefined`라 값 주입도 불가능하다. `document.title`은 정상적으로 바뀌므로 앱 자체는 부팅한 상태다.

- 한 번은 **10초 이상 기다리니** 렌더됐다. 콘솔에 `Supabase Studio is running commit ... deployed at 2026-08-06 14:11:35 +09:00`가 찍혀 있었다 — 그날 스튜디오가 막 재배포돼 청크를 새로 받느라 느렸던 것으로 보인다.
- 한 번은 탭 자체가 **CDP `Runtime.evaluate` 타임아웃**(45초)까지 갈 정도로 렌더러가 멈췄다. 그 탭은 새로고침으로도 살아나지 않아 닫고 새 탭에서 열었다.
- `/sql/new` 경로가 특히 잘 실패했다. 이미 저장된 쿼리 URL(`/sql/<uuid>`)이 상대적으로 안정적이었다.

**대응**: `window.monaco`를 폴링하되 상한(20~25초)을 두고, 그래도 없으면 **탭을 닫고 새로 연다.** 같은 탭 새로고침은 효과가 없었다. 이건 우리 코드 문제가 아니라 대시보드 쪽 문제이므로, 여기서 시간을 더 쓰지 않고 다른 경로(제약 조건으로 불변식 보장 등)로 검증 목적을 달성하는 편이 낫다.

---

### TS-002: React StrictMode 이중 렌더링으로 웹캠 play()가 인터럽트되어 dev 오버레이 에러 발생

**날짜**: 2026-08-05
**상태**: 해결

**문제**
`/start-learning`에서 카메라 권한을 허용한 직후 "Uncaught runtime errors: The play() request was interrupted by a new load request." 에러 오버레이가 화면 전체를 덮었다. 오버레이 뒤로는 웹캠 미리보기·타이머·집중도 상태 텍스트가 실제로 정상 동작하고 있는 게 보였다.

**재현 조건**
CRA 개발 서버(`npm start`)에서 `getUserMedia`로 스트림을 얻은 뒤 `<video>.play()`를 호출하는 컴포넌트를 마운트할 때. 프로덕션 빌드에서는 발생하지 않음(StrictMode의 이중 effect 호출은 개발 모드 전용).

**원인**
- 표면: `play()` Promise가 reject되고, 그 reject를 catch하지 않아 unhandled rejection으로 CRA 개발 오버레이에 표시됨
- 근본(확인함): `src/index.js`가 `<React.StrictMode>`로 앱을 감싸고 있어, 개발 모드에서 `useEffect`가 mount→cleanup→mount 순으로 두 번 실행된다. 첫 mount에서 얻은 스트림으로 `play()`를 호출한 직후 StrictMode가 즉시 cleanup(스트림 정지)과 재mount(새 스트림 획득)를 실행하면서 첫 `play()` 요청이 인터럽트되어 reject된다. 두 번째 mount의 `play()`는 정상적으로 성공하므로 기능 자체는 문제없이 동작한다.

**시도했지만 안 된 것**
별도 시도 없음 — 스크린샷에서 웹캠·타이머·상태 텍스트가 정상 동작 중인 걸 보고, 에러 메시지 문구("interrupted by a new load request")만으로 StrictMode 이중 호출 패턴임을 바로 특정함.

**해결**
`await videoRef.current.play()`를 try/catch로 감싸 인터럽트 에러를 무시. StrictMode를 끄는 방식은 채택하지 않음(개발/프로덕션 동작 차이가 커지는 더 큰 변경이라 범위 최소화 원칙에 어긋남).

**검증**
같은 페이지를 재접속해 카메라 권한을 다시 허용했을 때 에러 오버레이 없이 미리보기·타이머·"집중 중" 상태 텍스트가 바로 뜨는 것을 확인. "종료" 클릭 후 Supabase에 세션 row가 정상 저장되는 것까지 확인.

**추후 방안**
카메라/미디어 스트림, WebSocket 연결처럼 부수효과가 큰 리소스를 다루는 컴포넌트를 새로 만들 때는 StrictMode의 이중 effect 호출을 염두에 두고 프로미스 기반 부수효과(`play()` 등)를 처음부터 try/catch로 감싼다.

**배운 점**
개발 모드에서만 보이는 에러 오버레이라고 해서 무시하면 안 되지만, 기능이 실제로는 정상 동작하고 있다면 "에러처럼 보이는 것"과 "실제로 깨진 것"을 화면 상태로 먼저 구분한 뒤 원인을 좁히는 게 빠르다.

---

### TS-003: `npm test` 전체 실행 시 `react-router-dom` 모듈을 못 찾아 App.test.js만 실패

**날짜**: 2026-08-05
**상태**: 해결(우회)

**문제**
`CI=true npx react-scripts test --watchAll=false`(전체 스위트)를 돌리면 `src/App.test.js`가 "Cannot find module 'react-router-dom' from 'src/App.js'"로 스위트 자체를 실행하지 못하고 실패한다. 정작 `npm run build`와 `npm start`는 같은 import(`import { BrowserRouter as Router, ... } from 'react-router-dom'`)로 문제없이 동작하고, 다른 두 테스트 파일(`src/lib/trash.test.js`, `src/lib/focusTracker.test.js`)은 같은 실행에서 정상 통과한다.

**재현 조건**
`react-router-dom@^7`(현재 설치 버전 7.8.0)이 설치된 CRA(`react-scripts@^5.0.1`) 프로젝트에서, `react-router-dom`을 import하는 파일을 대상으로 `react-scripts test`(Jest)를 실행할 때. 빌드/런타임에는 영향 없음 — Jest 리졸버 경로에서만 재현된다.

**원인**
- 표면: Jest가 `node_modules`에 실제로 존재하는 `react-router-dom`을 못 찾는다고 보고함
- 근본(확인함): `node_modules/react-router-dom/package.json`의 `exports` 필드를 직접 읽어보면 `"."` 항목이 `node`/`import`/`default` 조건만 정의하고 있고(`"default": { "default": "./dist/index.js" }`), 이는 최신 Node의 exports-map 조건부 해석을 전제로 한다. `react-scripts 5.0.1`이 내부적으로 고정한 Jest/`jest-resolve` 버전은 이 최신 exports map 해석을 완전히 지원하지 않아, 패키지가 물리적으로 존재해도 조건 매칭에 실패하며 "모듈 없음"으로 보고한다. `react-router-dom` v6까지는 `main` 필드 기반 CJS 진입점이라 문제가 없었고, v7에서 exports map 중심으로 바뀌면서 CRA의 오래된 Jest 설정과 어긋난 것으로 파악.

**시도했지만 안 된 것**
별도 시도 없음 — `npm run build`/`npm start`가 동일 import로 정상 동작하는 것을 먼저 확인해 "패키지 자체가 깨진 게 아니라 Jest 리졸버 전용 문제"로 원인을 바로 좁혔고, `package.json`의 `exports` 필드를 직접 읽어 근본 원인을 확인함.

**해결**
전체 스위트(`npm test`) 대신, 변경한 파일 경로로 좁혀서 테스트를 실행한다:
```bash
CI=true npx react-scripts test src/lib/trash --watchAll=false
CI=true npx react-scripts test src/lib/focusTracker --watchAll=false
```
`App.test.js`를 건드리지 않는 경로 지정이면 정상 동작한다. `react-scripts`를 eject하거나 Jest 설정(`moduleNameMapper` 등)을 커스터마이징하는 근본 수정은 이번 범위에서 채택하지 않음 — CRA eject는 되돌릴 수 없는 더 큰 변경이라 범위 최소화 원칙에 어긋남.

**검증**
`CI=true npx react-scripts test --watchAll=false`(전체) 실행 결과: `App.test.js`만 "Test suite failed to run"으로 실패, `src/lib/trash.test.js`(3개)와 `src/lib/focusTracker.test.js`(6개) 9개 테스트는 전부 PASS. 경로를 좁혀 재실행하면 두 스위트 모두 정상 종료 확인.

**추후 방안**
`react-router-dom`을 import하는 파일에 대한 자동 테스트가 필요해지면(예: `App.test.js` 자체를 살리려면) `react-scripts`를 eject하거나 `jest.config`를 커스터마이징해 `moduleNameMapper`로 `react-router-dom`을 CJS 진입점(`./dist/index.js`)에 직접 매핑하는 방안을 검토한다. 그 전까지는 새 테스트 파일을 추가할 때 이 이슈를 피하려면 `react-router-dom`을 직접 import하지 않는 모듈 단위로 로직을 분리해 테스트 대상으로 삼는다(이번 프로젝트의 `focusTracker.js`/`trash.js`처럼 순수 로직을 컴포넌트에서 분리하는 패턴이 이 문제도 자연히 피해간다).

**후속 조치 (2026-08-06) — `App.test.js` 삭제**

우회책(경로를 좁혀 실행)으로 버틸 수는 있어도, **전체 스위트가 영구히 빨간색이라는 상태 자체가 비용**이었다. 디자인 시스템 브랜치 작업 내내 "63/63 통과 + `App.test.js`만 실패가 정상"이라는 구전 지식을 매 리뷰 디스패치마다 서브에이전트에게 주입해야 했고, 그 문장을 빠뜨리면 리뷰어가 이걸 결함으로 보고했다. 더 나쁜 건 진짜 회귀가 생겨도 빨간 신호에 묻힌다는 점이다.

사용자 결정으로 `src/App.test.js`를 삭제했다. 근거:

- CRA가 자동 생성한 기본 파일이고, 내용은 `render(<App />)` 후 "learn react" 링크를 찾는 스모크 테스트였다. **이 앱에는 그런 링크가 없으므로 리졸버 문제가 해결됐어도 통과하지 못했을 테스트다.**
- 이 파일을 참조하는 코드는 0건이었다.
- 실질 검증 가치가 0인데 스위트 전체의 신호를 가리는 비용만 있었다.

`moduleNameMapper`로 되살리는 안도 검토했으나, 살려봐야 검증하는 게 없어서 채택하지 않았다. **컴포넌트 렌더 테스트가 실제로 필요해지면** 아래 "추후 방안"의 매핑을 그때 도입한다.

**배운 점**
"모듈을 못 찾는다"는 에러가 항상 설치 문제인 것은 아니다. 빌드는 되는데 테스트 러너에서만 못 찾는다면, 두 도구가 모듈을 해석하는 방식(esbuild/webpack의 최신 exports map 해석 vs. 구버전 Jest 리졸버)이 다르다는 신호다. `package.json`의 `exports` 필드를 직접 열어보면 원인을 빠르게 좁힐 수 있다.

**그리고 항상 실패하는 테스트는 "알려진 이슈"가 아니라 부채다.** 우회책을 문서화하면 해결한 기분이 들지만, 실제로는 그 지식을 아는 사람에게만 스위트가 읽히는 상태가 된다. 검증 가치가 없는 테스트라면 남겨두는 것보다 지우는 편이 신호를 되찾는 길이다.

---

### TS-004: AI 채팅이 항상 "답변을 받지 못했어요"(502) — Edge Function 시크릿 이름 오타

**날짜**: 2026-08-05
**상태**: 해결

**문제**
AI 채팅 기능을 배포한 뒤 메시지를 보내면 스트리밍이 시작되지 않고 매번 실패했다. 프론트엔드에는 아래 메시지만 떴다.

```
답변을 받지 못했어요. 잠시 후 다시 시도해주세요.
```

Supabase Edge Function 로그에서는 요청이 도달했고 함수가 실행됐으며, Anthropic 호출 응답이 비정상이라 `!anthropicResponse.ok` 분기를 타고 502로 반환하는 것까지만 확인됐다.

**재현 조건**
`ai-chat` Edge Function 배포 직후, 시크릿을 Supabase Dashboard → Edge Functions → Secrets에서 수동 등록한 상태. 100% 재현 — 모든 메시지가 실패했다.

**원인**
- 표면: Anthropic API가 요청을 거부해 Edge Function이 502를 반환
- 근본(확인함): Supabase Dashboard의 Secrets 목록을 직접 열어보니 시크릿이 **`ANTROPIC_API_KEY`**(H 누락)로 저장돼 있었다. 코드는 `Deno.env.get('ANTHROPIC_API_KEY')`를 읽으므로 `undefined`가 반환되고, 인증 헤더가 빈 값인 채로 Anthropic에 요청이 나가 거부당했다. 함수 코드에는 문제가 없었다.

**시도했지만 안 된 것**
- Edge Function 코드(요청 바디 구성, 스트리밍 릴레이 포맷, CORS 헤더)를 먼저 의심하고 훑어봤으나 이상 없었다 — 코드 쪽에서 원인을 찾느라 시간을 썼다
- Invocations 탭의 요청/응답 로그만으로는 원인이 드러나지 않았다. Anthropic이 반환한 상세 에러 본문이 함수 로그에 남지 않아 "왜 ok가 아닌지"를 알 수 없었다

**해결**
Supabase Dashboard에서 오타난 `ANTROPIC_API_KEY` 시크릿을 삭제하고 `ANTHROPIC_API_KEY`로 다시 등록했다(시크릿 값 자체는 사용자가 직접 입력 — 에이전트는 키 값을 다루지 않는다). 재배포 없이 다음 호출부터 정상 동작했다.

**검증**
`/ai-chat`에서 질문을 보내 마크다운 형식의 실제 LLM 답변이 토큰 단위로 스트리밍되는 것을 브라우저에서 확인했다.

**추후 방안**
Edge Function 시작 지점에서 필수 환경변수의 **존재 여부를 먼저 검사**하고, 없으면 "설정 누락"임이 드러나는 별도 에러를 반환하도록 한다. 지금 구조는 키가 없을 때와 Anthropic이 실제로 거부했을 때가 똑같은 502로 뭉뚱그려져 구분이 안 된다. 예:

```ts
const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
if (!apiKey) {
  return new Response(
    JSON.stringify({ error: 'ANTHROPIC_API_KEY 미설정' }),
    { status: 500, headers: corsHeaders }
  );
}
```

또한 `!anthropicResponse.ok` 분기에서 Anthropic의 응답 본문을 로그에 남기면 다음번엔 로그만 보고 원인을 특정할 수 있다.

**배운 점**
환경변수 이름은 **오타가 나도 아무도 알려주지 않는다.** `Deno.env.get()`은 없는 키에 대해 조용히 `undefined`를 돌려주고, 그 결과는 한참 뒤 외부 API 호출 실패로만 나타난다. 설정값을 읽는 지점과 실패가 드러나는 지점이 멀수록 디버깅이 어려워지므로 **읽는 즉시 검증**하는 것이 비용 대비 효과가 가장 크다. 코드를 의심하기 전에 설정 화면을 눈으로 먼저 확인하는 것도 순서상 유리하다.

---

### TS-005: 학습 시간을 `setInterval` 틱 개수로 저장하면 백그라운드 탭에서 과소 기록

**날짜**: 2026-08-05
**상태**: 해결

**문제**
학습 세션에 시작/중지/재개/종료 제어를 넣으면서, 저장할 `duration_seconds`를 화면 타이머용 카운터(`elapsedSeconds`)로 바꿨다. 일시정지 구간을 자연스럽게 제외할 수 있어서였다. 코드 리뷰에서 이 방식이 **다른 탭을 보며 공부하면 학습 시간이 실제보다 적게 기록되는** 문제로 지적됐다.

```js
// 문제가 된 코드
elapsedTimerIdRef.current = window.setInterval(() => {
  setElapsedSeconds((prev) => prev + 1);
}, 1000);
...
duration_seconds: elapsedSeconds,   // ← 시간이 아니라 "틱이 돈 횟수"
```

**재현 조건**
학습 세션을 시작한 뒤 브라우저 탭을 백그라운드로 전환하고 5분 이상 두었다가 종료할 때. 포그라운드 단시간 테스트(수 초~수십 초)로는 재현되지 않는다 — 그래서 브라우저 수동 검증을 전부 통과했는데도 남아 있었다.

**원인**
- 표면: 저장된 학습 시간이 실제 학습 시간보다 짧다
- 근본(확인함): `elapsedSeconds`는 시간이 아니라 **인터벌 콜백이 실행된 횟수**다. 브라우저는 숨겨진 탭의 타이머를 최소 1000ms로 클램프하고, Chrome은 탭이 5분 이상 숨겨지면 intensive throttling으로 **분당 1회**까지 낮춘다. 게다가 `setInterval`은 메인 스레드가 바빠 놓친 틱을 나중에 보충하지 않는다 — 이 앱은 5초마다 MediaPipe 추론을 돌리므로 장시간 세션에서 누락이 단조 누적된다.
- 웹캠 스트림이 활성이면 스로틀링 예외에 해당할 가능성도 있으나(미확인), 문서로 보장되지 않는 브라우저 구현 세부사항에 데이터 정확성을 의존시킬 수는 없다고 판단했다.

**시도했지만 안 된 것**
- 브라우저 수동 검증(시작→중지→재개→종료, 중지↔재개 2회 반복)에서 타이머가 36→44로 정확히 이어지고 중지 4초가 정확히 제외되는 것까지 확인했으나, **전부 포그라운드였기 때문에** 이 문제를 전혀 건드리지 못했다. 실측만으로는 못 잡는 종류의 결함이었다.
- 변경 이전 코드(`aggregateSession`의 `endedAt - startedAt` 벽시계 차이)에는 이 문제가 없었다 — 즉 이번 변경이 만든 회귀였다.

**해결**
표시와 저장의 책임을 분리했다. 화면 타이머는 인터벌 카운터를 그대로 쓰되, **저장값은 활동 구간별 벽시계 시간을 누적**해 계산한다.

```js
const accumulatedMsRef = useRef(0);
const segmentStartedAtRef = useRef(null);

// beginTicking(): 구간 시작
segmentStartedAtRef.current = Date.now();

// stopTicking(): 구간 종료 — null 가드로 중복 호출 시 이중 계상 방지
if (segmentStartedAtRef.current !== null) {
  accumulatedMsRef.current += Date.now() - segmentStartedAtRef.current;
  segmentStartedAtRef.current = null;
}

// handleStop(): stopTicking()이 먼저 호출되므로 마지막 구간까지 포함됨
duration_seconds: Math.round(accumulatedMsRef.current / 1000),
```

`stopTicking()`의 null 가드가 중요하다 — 저장 실패 후 "다시 저장"을 누르면 `handleStop`이 다시 실행되는데, 가드가 없으면 마지막 구간이 두 번 더해진다.

**검증**
`npm run build` 컴파일 성공, 기존 테스트 23/23 통과. 재개 후 타이머 연속성과 중지 구간 제외를 브라우저에서 재확인(36→44, 중지 4초 제외 후 44→49). 저장 로직이 벽시계 기반이라 포그라운드 결과는 기존과 동일하게 유지되는 것으로 회귀 없음을 확인했다.

**추후 방안**
`timeline`(1분 단위 집중도 그래프)의 버킷 인덱스는 여전히 `started_at` 기준 **벽시계 분**이라, 1분 이상 일시정지하면 리포트 그래프에서 막대는 붙어 그려지고 라벨만 건너뛴다(예: `0`, `11`). 즉 저장 시간과 그래프 x축의 기준이 서로 다르다. 후속 작업으로 `Read.js`에서 빠진 minute을 빈 막대로 채워 실제 갭을 그리거나, `aggregateSession`에서 활동 시간 기준으로 재인덱싱하는 방안을 검토한다. 이번 브랜치에서는 수정 범위가 다른 파일로 번져 문서화만 하고 미뤘다.

**배운 점**
**타이머 카운터는 시간이 아니다.** UI에 초를 보여주려고 만든 `setInterval` 카운터를 그대로 데이터로 저장하는 것은, 표시용 근사값을 진실로 승격시키는 일이다. 브라우저 타이머는 스로틀링·드리프트·틱 누락이 전제된 물건이므로, 저장이 필요한 값은 반드시 `Date.now()` 같은 **실제 시각을 빼서** 구해야 한다.

또 하나 — 이 결함은 브라우저 실측을 전부 통과했다. 실측은 "내가 테스트한 조건"만 검증한다. 백그라운드 탭, 장시간 실행, 저사양 기기처럼 **재현 비용이 높은 조건**은 코드를 읽어서 추론해야 하며, 이것이 수동 검증이 끝난 뒤에도 코드 리뷰를 거쳐야 하는 이유다.

---

### TS-006: WCAG 대비비 손계산이 서로 다르게 나옴 — Chrome이 computed color를 `oklch()` 리터럴로 반환

**날짜**: 2026-08-05
**상태**: 해결

**문제**
휴지통 목록에서 삭제된 항목을 `opacity`로 흐리게 처리하면서, 그 값이 본문 대비비 4.5:1을 깨뜨리지 않는지 확인해야 했다. 구현자는 `opacity: 0.8`에서 4.568:1, `0.85`에서 4.779:1로 계산해 "0.85면 여유 있게 통과"라고 보고했다. 리뷰어는 같은 조건을 4.12~4.4:1로 계산해 "0.85도 미달"이라고 반박했다. **둘 다 손으로 OKLCH→sRGB 변환을 했고 결론이 정반대였다.**

**재현 조건**
`oklch()`로 정의된 CSS 커스텀 프로퍼티의 대비비를 브라우저에서 재려고 `getComputedStyle`로 색을 읽을 때. Chrome은 `rgb(...)`로 변환해주지 않고 `oklch(0.66 0.2 25)` 형태의 리터럴을 그대로 돌려준다.

**원인**
- 표면: 두 에이전트의 계산 결과가 0.4~0.8 대비비 포인트나 벌어졌다
- 근본(확인함): 계산에 쓴 색 값 자체가 틀렸다. 문자열에서 정규식으로 숫자 3개를 뽑는 흔한 방식(`s.match(/[\d.]+/g).slice(0,3)`)을 `oklch()` 리터럴에 적용하면 **L=0.66, C=0.2, H=25를 R=0.66, G=0.2, B=25로 읽는다.** 0~255 스케일에 0~1 값과 색상각(0~360)이 섞여 들어가 완전히 무의미한 휘도가 나온다
- 실제로 이 오독 상태에서 계산했을 때 `poor` 대비비가 2.35:1로 나왔는데, 이는 실측값 4.15:1과도 구현자 보고 4.78:1과도 무관한 세 번째 숫자였다

**시도했지만 안 된 것**
- `getComputedStyle(el).color`를 그대로 파싱 → 위 오독 발생
- 임시 probe 엘리먼트에 색을 세팅하고 computed 값을 읽는 방식 → 역시 `oklch()` 리터럴이 반환됨. 게다가 `probe.remove()`를 한 뒤에 다시 읽어 빈 문자열이 나오는 실수까지 겹쳐 결과가 전부 `""`가 됐다
- 실제 클래스(`.trash-card__expiry--poor`)로 probe를 만들어 재기를 시도했으나 그 클래스가 실존하지 않아(실제 이름은 `.trash-card__score--poor`) 엉뚱한 색을 읽었다. **추측한 클래스 이름으로 측정하면 안 된다**

**해결**
변환을 브라우저에 시킨다. 캔버스에 색을 칠하고 픽셀을 읽으면 Chrome 자신의 색 변환 엔진을 거친 정확한 sRGB가 나온다.

```js
const cv = document.createElement('canvas'); cv.width = cv.height = 1;
const ctx = cv.getContext('2d', { willReadFrequently: true });
const toRGB = (cssColor) => {
  ctx.fillStyle = '#000';        // 미지원 값이면 이게 남아 실패를 감지할 수 있다
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
};
```

`opacity`가 걸린 요소는 **그룹 합성**으로 계산한다. 요소의 배경과 그 안의 텍스트가 **둘 다** 배후색과 섞이므로, 합성 후의 두 색 사이에서 비를 낸다.

```js
const comp = (fg, backdrop, a) => fg.map((c, i) => c * a + backdrop[i] * (1 - a));
const ratio = (text, cardBg) => { /* WCAG 상대휘도 */ };
ratio(comp(poorColor, bg, 0.92), comp(surface, bg, 0.92));
```

**검증**
실측 결과 `--color-focus-poor`(rgb(244,81,79)) 대비비: `opacity` 0.80 → 3.79:1, **0.85 → 4.15:1(미달)**, 0.90 → 4.54:1, 0.92 → 4.70:1, 0.95 → 4.95:1. 리뷰어의 추정(4.12~4.4)이 실측 4.15에 근접했고 구현자 보고(4.78)는 틀렸음이 확정됐다. `0.92`로 상향해 4.70:1 확보(커밋 `b53d522`). 같은 조건에서 `low`·`high`는 8:1 이상, `mid` 7:1 이상, `--color-text-muted` 5.59:1로 전부 여유가 있어 `poor` 계열만 임계였음도 확인했다.

**추후 관리**
디자인 토큰이 `oklch` 기반인 한 이 함정은 계속 재발한다. 대비비를 재는 코드를 매번 새로 쓰지 말고 위 캔버스 스니펫을 쓴다. 자동 접근성 검사(axe 등)를 도입하면 `opacity` 그룹 합성까지 실제 렌더 기준으로 잡아주므로 손계산 자체를 없앨 수 있다.

**배운 점**
**두 에이전트의 손계산이 충돌하면 어느 쪽을 믿을지 고르지 말고 측정한다.** 중재하려 들면 더 그럴듯하게 쓴 쪽을 고르게 되는데, 이번엔 더 구체적인 숫자를 제시한 쪽(구현자)이 틀렸다.

그리고 **색 문자열을 직접 파싱하지 않는다.** CSS 색 표기는 `rgb()`, `oklch()`, `color(display-p3 ...)` 등으로 계속 늘어나고, 브라우저가 어떤 형식으로 돌려줄지는 보장되지 않는다. 숫자를 뽑는 정규식은 형식이 바뀌는 순간 **에러 없이 조용히 틀린 값**을 만든다.

---

### TS-007: 스크롤 리빌이 `IntersectionObserver`에 콘텐츠 가시성을 걸어 랜딩 페이지가 빈 화면이 될 수 있었음

**날짜**: 2026-08-05
**상태**: 해결

**문제**
Home 랜딩 페이지에 스크롤 진입 모션을 넣었다. 표준적인 패턴대로 CSS가 `[data-reveal] { opacity: 0 }`로 시작하고, `IntersectionObserver` 콜백이 `is-revealed` 클래스를 붙여 `opacity: 1`로 만든다.

브라우저에서 확인해보니 `[data-reveal]` 요소 **7개가 전부 `opacity: 0`이고 `is-revealed`가 하나도 붙지 않았다.** 즉 랜딩 페이지의 히어로 아래 콘텐츠가 통째로 보이지 않는 상태였다.

**재현 조건**
Claude in Chrome 자동화 탭에서 `http://localhost:3000/`을 열었을 때. 일반 브라우저에서는 재현되지 않는 것으로 보이나 **확인하지 못했다**(아래 참조).

**원인**
- 표면: `IntersectionObserver` 콜백이 한 번도 호출되지 않는다
- 근본(확인함): 이 자동화 탭에서는 `IntersectionObserver`가 **전역적으로 억제된다.** 앱 코드와 무관하게, 뷰포트 안에 이미 들어 있는 엘리먼트에 새 옵저버를 직접 만들어 붙이는 대조 실험을 했는데 1.2초를 기다려도 발화하지 않았다. CDP/자동화 탭의 스로틀링 아티팩트로 판단된다
- **따라서 "앱 버그"인지 "환경 아티팩트"인지 구분할 방법이 없었다.** 리뷰 서브에이전트도 독립적으로 같은 벽에 막혀 검증 불가로 보고했다

**시도했지만 안 된 것**
- 페이지를 다시 열고 1.5초 대기 후 재측정 → 동일하게 7개 전부 `opacity: 0`
- 대조용 옵저버 실험 → 이것도 미발화. 앱 코드 결백은 확인됐지만 **동작한다는 증명은 못 됐다**
- 서브에이전트에게 재검증을 맡김 → 같은 환경이라 같은 결과

**해결**
검증 불가 상태로 넘기지 않고 **설계를 바꿨다.** 문제의 본질은 옵저버가 발화하지 않는다는 게 아니라, **콘텐츠 가시성이 JS 성공에 걸려 있다**는 것이었다. 구형 브라우저, 확장 프로그램, 번들 앞쪽의 JS 에러, 향후 리팩토링으로 ref 배선이 깨지는 것 — 어느 하나만으로도 공개 랜딩 페이지가 빈 화면이 된다. 단일 실패 지점이다.

점진적 향상으로 반전했다. 숨김 상태를 **JS가 실행됐음이 증명된 뒤에만** 적용한다.

```css
/* 이전: JS가 실패하면 영구히 안 보임 */
[data-reveal] { opacity: 0; }

/* 이후: 마커 클래스가 붙어야만 숨는다 */
.reveal-enabled [data-reveal] { opacity: 0; transform: translateY(16px); }
[data-reveal].is-revealed     { opacity: 1; transform: none; }
```

훅이 관찰을 시작하기 직전에 `reveal-enabled`를 붙이고, `querySelectorAll('[data-reveal]')`가 비면 아예 붙이지 않는다. 결과: JS 미실행 → 전부 보임(모션 없음), JS 실행 → 기존대로 동작, reduced-motion → 즉시 전부 보임.

**검증**
세 규칙의 명시도가 모두 `(0,2,0)`으로 동일해 **선언 순서가 승부를 가른다**는 점을 파일 순서로 확인했다. 마커가 없으면 `.reveal-enabled [data-reveal]`이 아무것도 매치하지 않아 7개 요소가 브라우저 기본값 `opacity: 1`이 되고, `prefers-reduced-motion` 블록은 같은 선택자·같은 명시도로 나중에 선언돼 마커가 있어도 숨김 규칙을 이긴다. `npm run build` 성공, 테스트 63/63 통과(커밋 `96b1c12`).

**후속 검증 (2026-08-06) — 위 "근본 원인"을 정정한다**

위에서 근본 원인을 "이 자동화 탭에서는 `IntersectionObserver`가 **전역적으로 억제된다**"고 `확인함`으로 단정했다. **이 단정은 틀렸다.** 다음 날 재검증에서 반례가 나왔다.

| 상황 | 앱의 IO | 자동화 브리지로 만든 대조 옵저버 |
|---|---|---|
| `navigate`로 페이지 최초 진입 | 발화 안 함 (7개 전부 `opacity: 0`, 1.2초 대기해도 동일) | 발화 안 함 |
| 그 뒤 `location.reload()` | **발화함** — 뷰포트 안 2개가 `is-revealed` | 여전히 발화 안 함 |
| 스크롤 진행 | **7/7 전부 `is-revealed`, `opacity: 1`** | — |

즉 리빌은 **실제로 동작한다.** 억제되는 것은 IO 전반이 아니라 (a) 자동화 탭의 **최초 내비게이션 직후** 프레임과 (b) `javascript_tool` 브리지 컨텍스트에서 **새로 생성한** 옵저버다.

어제의 대조 실험이 오도한 이유가 여기 있다 — 대조군으로 삼은 옵저버 자체가 발화하지 않는 종류였다. "대조군도 안 뜨니 환경 탓"이라는 추론은 성립하지 않았다. **망가진 계측기로 계측기를 검증한 셈이다.**

**실무 지침**: 자동화 탭에서 IO 의존 동작을 판단하기 전에 `location.reload()`를 한 번 실행하고 측정하라. 브리지에서 만든 옵저버는 대조군으로 쓸 수 없다.

이 정정에도 불구하고 **해결책(점진적 향상 전환)은 유효하다.** 애초 근거가 "IO가 억제된다"가 아니라 "콘텐츠 가시성을 JS 성공에 걸지 않는다"였기 때문이다. 2026-08-06 실측으로 두 보증을 모두 확인했다 — 마커 클래스 제거 시 7/7이 `opacity: 1`, `prefers-reduced-motion` 규칙을 소스 위치 그대로 강제 발동시켰을 때도 7/7이 `opacity: 1`.

**추후 관리**
명시도가 같아 순서에 의존하므로, 누군가 `Home.css`의 블록을 재배치하면 **에러 없이 조용히** 깨진다.

`tokens.css`의 전역 `prefers-reduced-motion` 블록은 `animation-duration`/`transition-duration`만 줄인다. **초기 상태가 `opacity: 0`인 패턴은 그 블록으로 커버되지 않는다.** 앞으로 유사한 리빌을 추가할 때마다 로컬 오버라이드가 별도로 필요하다.

**배운 점**
**"검증할 수 없다"는 결과는 통과가 아니다.** 환경 때문에 확인이 불가능하다는 걸 알았을 때, 코드가 아마 맞을 거라고 넘기는 대신 *확인 불가능하다는 사실 자체*를 설계 결함의 신호로 읽었다. 관측할 수 없는 실패 모드를 가진 구조는 그 자체가 문제다.

**그리고 콘텐츠 가시성을 JS에 걸지 않는다.** 애니메이션은 향상이지 전제가 아니다. `opacity: 0`을 기본값으로 두는 모든 리빌 패턴은 "이 JS가 반드시 성공한다"에 페이지를 거는 것이고, 그 베팅은 공개 페이지에서 특히 비싸다. 숨김은 항상 JS가 살아 있음을 증명한 뒤에 적용한다.

---

### TS-008: 뷰에 `HEAD` + `count=exact`를 걸면 503, 그리고 그 실패가 페이지를 영구 로딩에 가둠

**날짜**: 2026-08-06
**상태**: 해결

**문제**
Mypage "빠른 실행" 타일에 총 세션 수를 붙이려고 count 전용 쿼리를 추가했다. 코드 리뷰 세 번(태스크 리뷰 3건)을 전부 통과했고 테스트 80개도 전부 초록이었다.

브라우저에서 열어보니 **페이지가 스켈레톤 상태로 영구히 멈춰 있었다.** 콘솔에는 에러가 하나도 없었다. React DevTools 안내 메시지 한 줄이 전부였다.

**재현 조건**
`/mypage` 진입 시 항상. 로그인 상태·데이터 유무와 무관.

**원인**

*표면*: 두 쿼리 중 count 쿼리만 503을 반환한다. 네트워크 로그 실측:

```
GET  /rest/v1/active_study_sessions?select=id%2Cstarted_at%2Cfocus_score&user_id=eq.<REDACTED>&order=started_at.desc&limit=3   → 200
HEAD /rest/v1/active_study_sessions?select=id&user_id=eq.<REDACTED>                                                             → 503
```

*근본 1 (확인함)*: `active_study_sessions`는 테이블이 아니라 **뷰**다. `supabase/migrations/20260805110000_pin_active_study_sessions_columns.sql`:

```sql
create or replace view active_study_sessions with (security_invoker = true) as
  select id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at
  from study_sessions where deleted_at is null;
```

이 뷰에 `head: true` + `count: 'exact'`(HTTP `HEAD` + `Prefer: count=exact`)를 걸면 503이 난다. 같은 뷰에 대한 일반 `GET`은 200으로 정상이므로 권한·RLS 문제가 아니다.

*근본 2 (확인함, 이쪽이 더 중요하다)*: 503 자체보다 **그 실패가 페이지를 죽이는 방식**이 진짜 문제였다. `loadUser` 내부가 이런 구조였다:

```javascript
const [{ data: sessions }, { count }] = await Promise.all([...]);
if (isMounted) {
  setUserName(...);
  setRecentSessions(...);
  setIsLoading(false);   // ← await가 던지면 여기까지 못 온다
}
```

`await`가 던지면 `if (isMounted)` 블록에 아예 도달하지 못한다. `setIsLoading(false)`가 실행되지 않으니 스켈레톤이 영원히 남고, `catch`가 없으니 콘솔에도 아무것도 안 남는다. **조용히 죽는다.**

이 결함은 이번 변경이 만든 게 아니라 **드러낸** 것이다. 기존에도 세션 쿼리가 실패하면 똑같이 멈췄겠지만, 실패할 일이 없어서 보이지 않았을 뿐이다.

**시도했지만 안 된 것**
- 콘솔 확인 → 에러 0건. 여기서 "네트워크는 정상인데 렌더링 문제"로 잘못 짚을 뻔했다
- 페이지 컨텍스트에서 `fetch`로 count 요청을 직접 재현하려 함 → 자동화 도구가 `localStorage`의 auth 토큰 판독을 차단(`[BLOCKED: Sensitive key]`)해서 실패. **네트워크 로그를 읽는 쪽이 훨씬 빨랐다**
- 503의 정확한 서버측 원인(PostgREST 설정인지 커넥션 풀러인지)은 **끝까지 규명하지 못했다.** 서버 설정 접근 권한이 없고, 아래 해결책이 요청 자체를 없애 버려서 더 파고들 이유가 사라졌다

**해결**

*1) count 쿼리를 없앴다.* PostgREST는 `count=exact`를 요청하면 **`limit`이 걸려 있어도 `Content-Range`에 전체 개수**를 돌려준다. 즉 별도 요청이 처음부터 불필요했다. 기존 쿼리에 인자 하나만 얹었다:

```javascript
const { data: sessions, count: sessionCount } = await supabase
  .from('active_study_sessions')
  .select('id, started_at, focus_score', { count: 'exact' })   // ← 두 번째 인자만 추가
  .eq('user_id', user.id)
  .order('started_at', { ascending: false })
  .limit(3);
```

요청이 2개에서 1개로 줄었고, `Promise.all`도 사라졌다. 503의 원인이 된 HEAD 요청 자체가 없어졌다.

*2) 로딩이 반드시 끝나게 했다.* `loadUser` 전체를 `try/catch/finally`로 감싸고, `finally`에서 `isMounted` 가드를 유지한 채 `setIsLoading(false)`를 호출한다. 실패 시 `console.error`로 원인을 남긴다. 로그인 안 된 사용자의 조기 `return` 경로도 `finally`를 통과하므로 함께 해소됐다.

**검증**
- 네트워크 로그에서 `HEAD` 요청 소멸, `GET` 1건만 남고 200
- 화면에 **"총 5세션"과 "최근 기록 3개"가 동시에 표시됨** — `limit(3)`과 무관하게 전체가 집계된다는 직접 증거
- 테스트 8 스위트 / 80건 전부 통과, `npx react-scripts build` 성공
- 타일 4개 대비비 캔버스 픽셀 판독: high 10.42 / low 9.78 / mid 8.95 / muted 6.42 / poor 5.39 — 전부 AA(4.5:1) 통과

**추후 관리**
`active_study_sessions` 뷰에 대한 `head: true` count 요청은 앞으로도 503이 날 것으로 보인다. 다른 화면에서 총계가 필요하면 이번처럼 **기존 조회 쿼리에 `{ count: 'exact' }`를 얹는 방식**을 쓴다. 별도 count 요청을 새로 만들지 않는다.

**배운 점**

**"정적 리뷰 통과"와 "동작한다"는 다른 말이다.** 이 결함은 태스크 리뷰 3건과 테스트 80개를 전부 통과했다. 리뷰어들이 게을렀던 게 아니라, 뷰에 대한 HEAD count가 503을 낸다는 건 코드를 아무리 읽어도 알 수 없는 사실이기 때문이다. **실행해 봐야만 알 수 있는 종류의 결함이 있고, 그래서 브라우저 검증이 리뷰의 대체재가 아니라 별도 관문이다.**

**그리고 조용히 죽는 코드가 가장 비싸다.** 503은 그 자체로는 사소한 문제였다 — 총 세션 수 하나 못 보여주는 정도. 그걸 페이지 전체 마비로 키운 건 `await` 실패가 `setIsLoading(false)`를 건너뛰는 구조였다. 콘솔에 에러 한 줄만 있었어도 진단이 1분이었을 텐데, `catch`가 없어서 네트워크 로그를 뒤져야 했다. **로딩 상태를 푸는 코드는 항상 `finally`에 둔다.**

---

### TS-009: 학습을 종료해도 카메라가 꺼지지 않음 — 원인 세 갈래

**날짜**: 2026-08-06
**상태**: 해결

**문제**
학습 세션을 종료했는데 맥 메뉴바의 카메라 사용 표시등이 계속 켜져 있었다. 사용자가 직접 발견해 신고했다.

**재현 조건**
`/start-learning`에서 시작 → 종료. 개발 환경(StrictMode)에서는 페이지에 들어갔다 나오기만 해도 스트림이 샜다.

**원인**

코드를 보면 cleanup에서 스트림을 끄고 있어서 **문제가 없어 보인다.** 실제로는 세 갈래로 새고 있었다.

```javascript
useEffect(() => {
  let stream;                                   // ← (c)의 원인
  const start = async () => {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    ...
  };
  start();
  return () => {
    if (stream) stream.getTracks().forEach(t => t.stop());   // 유일한 해제 지점
  };
}, []);
```

*(a) `stopTicking()`이 스트림을 건드리지 않는다.* 이 함수는 트래커와 `setInterval`만 정리한다. 스트림을 끄는 코드는 위 cleanup 한 곳뿐이라, **언마운트돼야만 카메라가 꺼진다.**

*(b) 저장 실패 경로에서 컴포넌트가 살아남는다.* `handleStop`은 Supabase insert를 `await`하고, 실패하면 `STATUS.SAVE_ERROR`를 세팅한 뒤 `return`한다. 화면에 그대로 머무르므로 언마운트가 없고 → 카메라가 영원히 켜져 있다.

*(c) 경쟁 조건으로 스트림 참조를 잃는다 (이게 가장 고약하다).* `stream`은 effect 클로저의 지역 변수다. cleanup이 `await getUserMedia(...)`가 **아직 대기 중일 때** 실행되면 `stream`은 `undefined`라서 아무것도 끄지 못한다. 그 뒤 늦게 도착한 스트림은 어디서도 참조되지 않고 **영원히 살아 있다.** React StrictMode가 개발 환경에서 effect를 두 번 호출하므로 이건 사실상 매번 발생했다.

**시도했지만 안 된 것**
- 처음엔 (a)만 원인으로 보고 "종료 시 스트림 정지를 추가하면 되겠다"고 판단했다. **틀렸다.** (b)와 (c)를 그대로 두면 저장 실패와 StrictMode 경로에서 계속 샌다. 세 갈래를 모두 막아야 했다
- cleanup 코드가 멀쩡해 보여서 처음엔 "브라우저/OS가 표시등을 늦게 끄는 것 아닌가"를 의심했다. 코드 문제였다

**해결**

`releaseCamera()` 함수를 만들고 스트림을 `useRef`에 보관해 async 경계를 넘겨 살렸다.

- **(a)** `handleStop`에서 `releaseCamera()`를 명시적으로 호출
- **(b)** 호출 위치를 **Supabase 왕복 이전**으로 두었다. 저장이 성공하든 실패하든 카메라는 이미 꺼져 있다. 사용자가 종료를 눌렀으면 촬영은 끝난 것이다
- **(c)** `isCancelled` 플래그를 두어, 늦게 도착한 스트림이 자기 자신을 즉시 정지시키게 했다. `streamRef`에는 취소되지 않은 effect의 스트림만 등록된다
- 해제 후 `srcObject`를 `null`로 비워 마지막 프레임이 얼어붙지 않게 했다
- `releaseCamera()`는 멱등이다. 종료 → 언마운트처럼 두 번 불려도 안전하다

**일시정지에서는 끄지 않는다.** 사용자 결정이다. 재개할 때 카메라 재시작 지연이 없고, 저장 실패로 화면에 남는 경우는 종료 경로에서 이미 해제되므로 프라이버시 문제도 없다.

**검증**
브라우저에서 트랙 참조를 전역에 잡아두고 각 경로의 `readyState`를 실측했다(언마운트 후에는 DOM에서 읽을 수 없으므로).

| 동작 | `readyState` | 판정 |
|---|---|---|
| 시작 직후 | `live` | 정상 |
| 중지(일시정지) | `live` | 의도대로 유지 |
| 종료 직후, **저장 왕복 이전** | `ended` | (b) 해소 확인 |
| 저장 완료 후 | `ended` | — |

리뷰어가 6개 경로(저장 성공/실패, 일시정지, 언마운트, StrictMode 조기 언마운트, 종료 연타)를 추적해 모든 경로에서 트랙이 **정확히 1회** `stop()`됨을 확인했다.

**추후 관리**
`getUserMedia`를 쓰는 화면을 새로 만들면 같은 함정이 그대로 재현된다. 지역 변수가 아니라 **ref에 담고, 취소 플래그로 늦게 도착한 스트림을 자가 정지시키는** 패턴을 그대로 가져다 쓴다.

**배운 점**

**cleanup 함수가 있다고 정리되는 게 아니다.** `return () => stream?.getTracks()...`는 읽으면 완벽해 보이지만, `stream`이 채워지기 전에 cleanup이 돌면 아무 일도 하지 않는다. **async 작업의 결과를 클로저 지역 변수에 담으면 cleanup이 그걸 못 볼 수 있다.** 정리 대상은 ref처럼 렌더 사이클을 넘어 사는 곳에 둔다.

**그리고 리소스 해제는 성공 경로가 아니라 사용자 의도에 붙인다.** 원래 코드는 "저장이 끝나고 화면을 떠날 때" 카메라를 껐다. 하지만 사용자가 종료를 누른 순간 촬영 의사는 이미 끝났다. 저장 성공 여부는 카메라와 아무 상관이 없는데 거기에 묶여 있었던 것이다.

---

### TS-010: 로딩 해제를 지키려고 넣은 `isMountedRef` 가드가 StrictMode에서 화면을 영구히 멈춤

**날짜**: 2026-08-06
**상태**: 해결

**증상**
AI 채팅 대화방 분리 기능을 배포한 뒤 `/ai-chat`에 들어가면 아무것도 없는 어두운 화면만 나온다. 헤더도, 대화 목록도, 입력창도, 에러 메시지도 없다. 콘솔에 에러가 하나도 찍히지 않고, 네트워크 요청도 정상적으로 200을 받는다.

**재현 조건**
- `npx react-scripts start` (개발 모드, `src/index.js`가 `<React.StrictMode>`로 감싸고 있음)
- `/ai-chat` 진입
- 100% 재현. 프로덕션 빌드에서는 StrictMode 이중 마운트가 없으므로 재현되지 않는다 — **개발 모드에서만 터진다.**

**원인**

- 표면: `AiChat`이 `isLoading === true` 분기에서 반환하는 `<div className="ai-chat-page" />`가 화면 전체를 차지하는 빈 div다. 즉 "로딩이 끝나지 않은" 상태로 굳어 있었다.
- 근본(확인함): 마운트 해제 후 state를 건드리지 않으려고 둔 가드가 StrictMode 재마운트에서 복구되지 않았다.

```javascript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;   // 언마운트에서 false로만 간다
  };
}, []);
```

React 18/19의 StrictMode는 개발 모드에서 **마운트 → 언마운트 → 재마운트**를 한 번 수행한다. 첫 언마운트의 cleanup이 `isMountedRef.current = false`로 만드는데, ref 객체는 이 시뮬레이션된 재마운트를 넘어 그대로 유지된다. 그리고 어디에서도 `true`로 되돌리지 않는다.

그 결과 두 번째(실제로 화면에 남는) 마운트에서는 처음부터 `isMountedRef.current === false`이고, 초기 로드의 `finally`가 이렇게 생겼다:

```javascript
} finally {
  if (isMountedRef.current) {
    setIsLoading(false);      // 영원히 실행되지 않는다
  }
}
```

**로딩 해제를 보장하려고 넣은 `finally`가, 같은 커밋에서 함께 넣은 가드 때문에 무력화됐다.**

**시도했지만 안 된 것**
- 콘솔 에러 확인 — 에러가 없다. 예외로 죽은 게 아니라 조건문이 조용히 건너뛴 것이라 아무 흔적이 없었다.
- `get_page_text` — "No text content found"만 나와서 어떤 상태에 멈춘 건지 알 수 없었다. DOM에 진짜로 빈 div 하나뿐이었다.
- 로그인 세션 문제로 의심 — `!user` 분기라면 `navigate('/login')`으로 URL이 바뀌어야 하는데 `/ai-chat` 그대로였다. 이 지점에서 가설을 버리고 코드를 직접 읽었다.

**해결**
수명주기 이펙트의 **본문**에서 `true`로 되돌린다. 이 이펙트가 초기 로드 이펙트보다 먼저 선언돼 있어 재마운트 시 실행 순서도 맞다.

```javascript
useEffect(() => {
  // StrictMode는 dev에서 마운트 → 언마운트 → 재마운트를 한다. ref는 그 사이 유지되므로
  // 여기서 true로 되돌리지 않으면 두 번째 마운트에서 계속 false로 남고,
  // 로딩 해제가 통째로 건너뛰어져 화면이 영구히 멈춘다 (TS-010).
  isMountedRef.current = true;
  return () => {
    isMountedRef.current = false;
  };
}, []);
```

**검증**
`/ai-chat` 재진입 → 헤더·대화 목록(`이전 대화`)·기존 메시지 9건·입력창이 모두 정상 렌더. 백필된 대화의 옛 메시지가 전부 그대로 보인다.

**추후 관리**
- **이 저장소에서 `useRef` 기반 마운트 가드를 쓸 때는 반드시 이펙트 본문에서 `true`로 되돌린다.** `let isMounted = true`처럼 이펙트 **안에** 선언하는 지역 변수 패턴은 이 문제가 없다(매 마운트마다 새로 만들어지므로). ref로 올릴 때만 위험하다.
- StrictMode 관련 사고가 이 저장소에서 세 번째다(TS-002 웹캠 play 인터럽트, TS-009 카메라 미해제의 세 번째 원인, 그리고 이번 건). 렌더 사이클을 넘어 사는 값(ref, 모듈 스코프)을 건드리는 코드는 **개발 모드에서 반드시 직접 열어보고 넘어간다.**

**배운 점**

**정적 리뷰는 실행을 대체하지 못한다 — 이번에는 그게 실측으로 증명됐다.** 이 코드는 태스크 리뷰, opus의 브랜치 전체 리뷰, 그리고 수정 웨이브 뒤의 스코프드 재리뷰까지 **세 번의 독립 리뷰를 통과**했다. 세 리뷰 모두 "초기 로드의 모든 이탈 경로가 `setIsLoading(false)`에 도달하는가"를 명시적으로 지시받고 경로를 하나씩 열거해 "도달한다"고 답했다. **그 답은 종이 위에서 옳았다.** 리뷰어들은 `finally`가 무조건 실행되는지를 봤고 실제로 무조건 실행된다. 아무도 `isMountedRef.current`가 그 시점에 무슨 값인지를 묻지 않았다.

**가드는 그 자체가 실패 지점이다.** 실패 경로를 막으려고 넣은 조건문이 새로운 실패 경로가 된다. `finally { if (조건) { 해제 } }`는 `finally`의 보장을 조건문의 보장으로 낮춘 것이다. 해제를 정말 보장하려면 조건 없이 해제하고, 마운트 해제 후 state 갱신이 걱정되면 다른 방법(요청 ID 비교 같은)으로 푼다.

**"에러가 없다"는 정상이라는 뜻이 아니다.** TS-008은 실패가 로딩 해제를 건너뛰어 화면을 멈춘 건이었고, 이번엔 성공했는데도 건너뛰었다. 두 경우 모두 콘솔은 깨끗했다. 로딩 상태를 세우는 코드를 볼 때는 "무엇이 이걸 내리는가"를 코드가 아니라 **실행으로** 확인해야 한다.

---

### TS-011: 전역 `box-sizing` 리셋이 페이지 클래스를 손으로 나열해서, 새 화면은 조용히 빠진다

**날짜**: 2026-08-06
**상태**: 해결

**증상**
AI 채팅 대화방 분리 작업의 마지막 검증(스펙: "320px에서 가로 스크롤 없음")에서 320px 폭 실측 시 가로 스크롤이 발생했다. 눈으로는 레이아웃이 멀쩡해 보였고, 넓은 화면에서는 전혀 드러나지 않았다.

```
{ innerWidth: 320, scrollWidth: 368, clientWidth: 320, horizontalOverflow: true }
```

**재현 조건**
- `/ai-chat`을 CSS 뷰포트 폭 320px에서 렌더
- 넓은 화면(≥900px)에서는 `max-width: 1080px`에 걸려 드러나지 않는다. **좁은 화면에서만 보인다.**

**원인**

- 표면: `.ai-chat-page__main`의 실제 폭이 368px. 뷰포트보다 48px 넓다.
- 근본(확인함): `.ai-chat-page__main`이 `width: 100%` + `padding: var(--space-6)`(좌우 24px씩)인데 **`box-sizing`이 `content-box`**다. 320(내용) + 48(패딩) = 368.

왜 content-box인가. `src/index.css`의 전역 리셋이 이렇게 생겼다:

```css
.home, .home *,
.login, .login *,
.mypage, .mypage *,
.signup-overlay, .signup-overlay *,
.navbar, .navbar * {
  box-sizing: border-box;
}
```

**`*` 전체가 아니라 페이지 클래스를 손으로 나열한 형태다.** `.ai-chat-page`는 이 목록에 없다. 즉 이 저장소에서 **새로 만드는 화면은 전부 기본값으로 이 리셋에서 빠진다.** 화면을 추가한 사람이 목록에 자기 클래스를 넣는 걸 기억해야만 적용된다.

이 문제 자체는 이번 브랜치가 만든 게 아니다. 기존 `.ai-chat-page__main`도 `width: 100%` + 같은 패딩이었으므로 **이전부터 320px에서 넘치고 있었다.** 이번에 스펙이 320px 무스크롤을 명시적 검증 항목으로 요구해서 처음 측정됐을 뿐이다.

**시도했지만 안 된 것**
- `resize_window`로 창을 320×720으로 줄여서 측정 — `window.innerWidth`가 계속 1701로 나왔다. 브라우저 페이지 줌이 0.46이라 OS 창 크기(`outerWidth` 783)와 CSS 뷰포트가 따로 놀았다. 창 크기만 믿고 "320px에서 확인했다"고 넘어갔으면 오버플로를 못 봤을 것이다.
- 해결: **320px 폭 `<iframe>`을 띄워 그 안에서 측정.** iframe은 자체 뷰포트를 가지므로 미디어 쿼리와 레이아웃이 실제 320px 기준으로 계산된다. 페이지 줌의 영향을 받지 않는다.

**해결**
넘치는 요소에 직접 `box-sizing: border-box`를 준다. 전역 리셋 목록에 `.ai-chat-page`를 추가하는 안도 있었으나, 그러면 이 화면의 모든 하위 요소 박스 모델이 한꺼번에 바뀌어 이미 검증을 마친 레이아웃에 예상 못 한 영향이 갈 수 있어 채택하지 않았다. 범위를 넘치는 요소 하나로 좁혔다.

```css
.ai-chat-page__main {
  /* src/index.css의 전역 box-sizing 리셋은 .home/.login/.mypage/.signup-overlay/.navbar
     로만 한정돼 있어 이 화면은 빠져 있다. width:100% + 좌우 패딩이 content-box로 더해져
     320px에서 가로 스크롤이 생긴다 (TS-011). */
  box-sizing: border-box;
  ...
}
```

**검증**
320px iframe 재측정: `scrollWidth: 320, clientWidth: 320, horizontalOverflow: false`. 뷰포트를 넘는 요소 0건. 목록 토글을 연 상태에서도 오버플로 없음.

**추후 관리**
- **전역 리셋을 `*`로 바꾸는 것을 검토한다.** 현재 구조는 화면을 추가할 때마다 사람이 기억해야 하는 항목이고, 안 넣어도 넓은 화면에서는 멀쩡해 보여서 눈치채기 어렵다. 다만 기존 5개 화면의 레이아웃이 이미 그 전제로 굳어 있어, 바꾸려면 전 화면 시각 회귀 확인이 필요하다. 별건으로 다룬다.
- 새 화면을 만들 때는 **좁은 화면 폭에서 오버플로를 실측**하는 것을 검증 항목에 넣는다.

**배운 점**

**"전역 리셋"이라는 이름을 믿지 말고 선택자를 읽어라.** `src/index.css`에 `box-sizing: border-box`가 있다는 사실만 확인하고 넘어갔다면 원인을 한참 헤맸을 것이다. 적용 범위가 클래스 5개로 한정돼 있었고, 그건 파일을 열어봐야만 보인다.

**반응형은 창 크기가 아니라 CSS 뷰포트로 검증해야 한다.** 브라우저 창을 줄이는 것과 CSS 뷰포트가 좁아지는 것은 페이지 줌이 걸려 있으면 별개다. 자동화로 반응형을 확인할 때는 `window.innerWidth`를 반드시 같이 찍어보고, 값이 의도대로 나오지 않으면 고정 폭 iframe으로 측정한다.

**눈으로 멀쩡한 것과 측정해서 멀쩡한 것은 다르다.** 스크린샷으로는 레이아웃이 정상으로 보였다. `scrollWidth > clientWidth` 한 줄이 아니었으면 그냥 통과시켰을 것이다.

---

### TS-012: 테이블에 분명히 있는 컬럼이 뷰에서는 "does not exist" — 컬럼을 고정 나열한 뷰를 갱신하지 않음

**날짜**: 2026-08-06
**상태**: 해결

**증상**
실시간 비집중 알림 기능을 만들면서 리포트에 `focus_breakdown`(원인별 비율)을 표시하려 했다. 이 컬럼은 2026-08-05에 `study_sessions` 테이블에 추가했고, 그때부터 모든 세션이 값을 정상적으로 저장하고 있었다. 그런데 조회하면 이렇게 나온다.

```
Failed to run sql query: ERROR:  42703: column "focus_breakdown" does not exist
LINE 1: select count(*) as sessions_before, count(focus_breakdown) as with_breakdown from active_study_sessions limit 100
```

`select * from study_sessions`에는 그 컬럼이 멀쩡히 있다. **테이블에는 있는데 뷰에는 없다.**

**재현 조건**
- 컬럼을 명시적으로 나열하는 뷰(`select a, b, c from t`)가 있고
- 그 뒤 테이블에 컬럼을 추가하면서 뷰를 갱신하지 않은 상태에서
- 뷰를 통해 그 컬럼을 조회할 때

**원인**

- 표면: `column "focus_breakdown" does not exist`
- 근본(확인함): `active_study_sessions` 뷰가 `20260805110000_pin_active_study_sessions_columns.sql`에서 **컬럼을 하나씩 나열하는 형태로 고정**돼 있었다.

```sql
create or replace view active_study_sessions with (security_invoker = true) as
select id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at
from study_sessions where deleted_at is null;
```

`focus_breakdown`은 그 다음 마이그레이션(`20260805150000`)에서 테이블에 추가됐지만 **뷰는 건드리지 않았다.** 뷰는 생성 시점의 컬럼 목록으로 고정되므로, 테이블에 컬럼이 늘어도 뷰는 모른다.

그리고 화면(`Read.js`)은 테이블이 아니라 **뷰**에서 읽는다. 결과적으로 하루가 넘도록 **저장은 되는데 화면에서는 읽을 방법이 없는 데이터**가 쌓이고 있었다.

**아무도 눈치채지 못한 이유가 핵심이다.** 에러가 난 적이 없다. `Read.js`가 `focus_breakdown`을 `select`에 넣은 적이 없으니 조회 실패가 발생하지 않았고, 저장 쪽은 테이블에 직접 insert 하므로 정상 동작했다. **기능이 조용히 반쪽만 살아 있었다.**

**시도했지만 안 된 것**
- 없다. 이번엔 디버깅이 아니라 **계획 단계의 코드 읽기**로 먼저 잡았다. 스펙에 "`focus_breakdown`은 이미 저장되고 있으니 `select`에 추가만 하면 된다"고 적혀 있었는데, `Read.js:48`이 테이블이 아니라 뷰에서 읽는 것을 확인하고 뷰 정의를 열어보니 컬럼이 없었다. 그 뒤 실제 DB에 쿼리를 날려 위 에러로 확증했다.

**해결**
`alerts` 컬럼을 추가하는 마이그레이션에서 뷰도 함께 갱신했다.

```sql
create or replace view active_study_sessions with (security_invoker = true) as
select id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline,
       created_at, deleted_at, focus_breakdown, alerts
from study_sessions where deleted_at is null;
```

**`create or replace view`는 기존 컬럼의 이름과 순서를 바꿀 수 없다.** 새 컬럼은 반드시 기존 목록 **뒤에** 붙여야 한다. `focus_breakdown`을 의미상 어울리는 `timeline` 옆에 끼워 넣으면 `cannot change name of view column`으로 실패한다. 그래서 읽기에는 어색해도 `deleted_at` 뒤에 두 개를 붙였다.

**검증**
적용 전 → 후: 뷰 행 6 → 6(변동 없음), 테이블 행 7 → 7, 뷰 컬럼 9 → 11.

```
id,user_id,started_at,ended_at,duration_seconds,focus_score,timeline,created_at,deleted_at,focus_breakdown,alerts
```

그리고 **어제 저장된 08-05 세션의 리포트에 원인별 비율이 처음으로 표시됐다** — 집중 33% / 아래 보기 33% / 자리 비움 17% / 눈 감김 17%. 데이터는 내내 있었고 뷰가 가리고 있었을 뿐이다.

**추후 관리**
- **컬럼을 고정 나열한 뷰가 있는 테이블에 컬럼을 추가할 때는 같은 마이그레이션에서 뷰도 갱신한다.** 현재 이 저장소에서 그런 뷰는 `active_study_sessions` 하나다.
- 그 뷰가 왜 `select *`가 아니라 고정 나열인지는 `20260805110000`의 이름(`pin_active_study_sessions_columns`)에 드러나 있다 — 의도적으로 고정한 것이므로 `select *`로 되돌리지 않는다. 대신 **컬럼 추가 마이그레이션의 체크리스트에 "뷰 갱신"을 넣는다.**
- 새 컬럼은 뷰 목록 맨 뒤에만 붙일 수 있다는 제약을 마이그레이션 파일 주석에 남겼다.

**배운 점**

**"컬럼이 없다"는 에러가 컬럼이 없다는 뜻은 아니다.** 어느 관계(relation)에 없다는 뜻이다. 테이블과 뷰는 다른 관계이고, 애플리케이션이 둘 중 무엇을 읽는지 확인하지 않으면 엉뚱한 곳을 계속 들여다보게 된다. 에러 메시지의 `from` 절을 먼저 읽어야 한다.

**에러가 없다고 기능이 살아 있는 건 아니다.** 이 건은 하루 넘게 아무 에러도 내지 않았다. 쓰기 경로는 테이블로, 읽기 경로는 뷰로 갈라져 있었고 읽기 쪽이 그 컬럼을 요청한 적이 없어서 아무도 부딪히지 않았다. **컬럼을 추가했으면 저장뿐 아니라 조회까지 한 번은 실제로 해봐야 한다.**

**스펙도 틀릴 수 있다.** 승인된 스펙에 "이미 저장되고 있으니 select에 추가만 하면 된다"고 적혀 있었다. 그 문장은 테이블 기준으로는 맞고 뷰 기준으로는 틀렸다. 계획 단계에서 소비자 코드(`Read.js`)가 실제로 무엇을 읽는지 확인하지 않았다면 Task 5에서 "왜 안 나오지"로 시간을 썼을 것이다.

---

### TS-013: 개발 서버가 시연 도중 두 번 죽음 — 에이전트 백그라운드 태스크는 턴 경계에서 회수된다

**날짜**: 2026-08-06
**상태**: 해결(우회)

**증상**
기능 구현을 마치고 사용자에게 "개발 서버는 3000번에 그대로 떠 있습니다"라고 보고했다. 곧바로 시스템 알림이 왔다.

```
Background command "npm start" was stopped
<status>killed</status>
```

재시작하고 HTTP 200을 확인한 뒤 "복구했습니다. 시연 준비 완료입니다"라고 다시 보고했다. 그리고 또:

```
Background command "Restart CRA dev server" was stopped
<status>killed</status>
```

사용자가 브라우저를 열었을 때는 이미 죽어 있었다. 확인 명령의 결과는 매번 이랬다.

```
000DOWN
```

**재현 조건**
- 에이전트가 `run_in_background`로 장기 실행 프로세스(CRA dev server)를 띄우고
- 그 뒤로 여러 턴이 지나가면
- 프로세스가 예고 없이 종료된다. 몇 턴 뒤에 죽는지는 일정하지 않았다.

**원인**

- 표면: 개발 서버가 임의로 죽는다.
- 근본(확인함): 에이전트 하네스의 백그라운드 태스크는 세션에 매여 있고, 작업이 끝났다고 판단되면 회수된다. 개발 서버처럼 "끝나지 않는 것이 정상"인 프로세스는 이 회수 대상과 구분되지 않는다. `npm start`가 스스로 종료된 것이 아니라 **바깥에서 종료당했다** — 그래서 로그에 아무 단서도 남지 않았다.

**진짜 문제는 따로 있었다.** 서버가 죽은 것보다, 죽은 줄 모르고 "떠 있습니다"라고 보고한 쪽이 사용자에게 더 큰 손해였다. 첫 보고 시점에 실제로는 이미 종료된 상태였는데, 마지막으로 성공했던 기동 기억에 의존해 확인 없이 단언했다. 사용자는 그 말을 믿고 브라우저를 열었다가 헛걸음했다.

**시도했지만 안 된 것**
- 같은 방식(`run_in_background`)으로 재시작 — 두 번째도 똑같이 회수됐다. 원인을 바꾸지 않고 같은 동작을 반복한 것이라 실패는 예정돼 있었다.
- 세 번째로 같은 방식을 또 시도하려다 멈췄다. 두 번 같은 결과가 나왔으면 방법을 바꿔야 한다.

**해결**
세션의 프로세스 그룹에서 떼어내 띄운다. 하네스가 추적하지 않으므로 회수 대상에서 벗어난다.

```bash
nohup env BROWSER=none PORT=3000 npx react-scripts start > <로그경로>/cra.log 2>&1 &
disown
```

기동 대기는 포그라운드 `sleep`이 막혀 있으므로 조건 루프를 백그라운드로 돌린다.

```bash
until curl -s -o /dev/null http://localhost:3000; do sleep 1; done
```

확인:

```
HTTP 200
58054 SN   npm exec react-scripts start
```

이 PID는 이후 여러 턴에 걸쳐 살아남았다.

사용자가 직접 띄우는 방법도 유효하다. 프롬프트에 `! BROWSER=none npx react-scripts start`를 입력하면 사용자 세션에서 실행되어 회수되지 않는다.

**검증**
- `curl -s -o /dev/null -w "%{http_code}"` → `200`
- `ps -p 58054` → 프로세스 생존 확인
- 이후 턴들에서 재확인 — 죽지 않음

**추후 관리**
- 장기 실행 프로세스(dev server, watch 모드, 터널)는 `run_in_background`로 띄우지 않는다. `nohup` + `disown`으로 분리하거나 사용자에게 넘긴다.
- **서버 상태를 보고하기 전에 반드시 그 순간 확인한다.** "아까 띄웠으니 떠 있을 것"은 근거가 아니다. `curl`로 코드를 받아보고 말한다.
- 로그를 스크래치패드에 남겨두면(`cra.log`) 죽었을 때 원인을 구분할 수 있다 — 로그가 정상 종료 없이 끊겨 있으면 외부 종료다.

**배운 점**
- 같은 실패가 두 번 나오면 세 번째 시도는 방법을 바꾼 뒤에 한다. 두 번째 재시작은 첫 번째와 아무것도 다르지 않았고, 결과도 같았다.
- 확인하지 않은 상태를 단언하지 않는다. 이번 건에서 실제 피해는 프로세스가 죽은 것이 아니라 **틀린 보고**에서 나왔다. 사용자는 잘못된 정보를 근거로 행동했다.
- 하네스가 관리하는 리소스와 OS가 관리하는 리소스는 수명이 다르다. "끝나지 않는 것이 정상"인 프로세스는 후자에 맡겨야 한다.

---

### TS-014: 브라우저 창 리사이즈가 "성공"을 보고하고도 뷰포트를 바꾸지 않아 반응형 검증이 불가능했다

**날짜**: 2026-08-07
**상태**: 해결(우회)

**증상**
마케팅 3화면을 320 / 768 / 1024 / 1440에서 가로 스크롤 여부로 검증해야 했다. 창을 320px로 줄이고 측정했더니 뷰포트가 그대로였다.

```
[resize_window] Successfully resized window containing tab 957955505 to 320x800 pixels
[javascript_tool] {"w":1703,"scrollW":1703,"clientW":1703,"overflow":false}
```

`overflow:false`가 나왔지만 이건 1703px에서 측정한 값이라 아무것도 검증하지 못한다. **도구는 성공을 보고했고, 결과는 거짓 통과였다.**

**재현 조건**
- macOS Chrome 창이 전체화면(또는 최대화) 상태
- `resize_window`로 창 크기 변경 요청
- 반환값은 성공, `window.innerWidth`는 변하지 않음

**원인**
- 표면: 리사이즈가 안 먹는다.
- 근본(확인함): 도구의 성공 응답은 "요청을 보냈다"는 뜻이지 "창이 그 크기가 됐다"는 뜻이 아니다. 500px으로 다시 시도하고 600ms 대기 후 재측정해도 `innerWidth`는 1703 그대로였다.
- 전체화면 상태의 창이 크기 변경을 무시하는 것이 macOS 쪽 동작인지는 **확인하지 않았다.** 확인한 사실은 "성공 응답과 실제 뷰포트가 어긋난다"까지다.

**시도했지만 안 된 것**
- 320px 리사이즈 후 즉시 측정 → 1703
- 500px으로 폭을 키워 재시도 + 600ms 대기 → 1703. 두 번째도 같은 결과가 나온 시점에 방법을 바꿨다.

**해결**
같은 오리진(`localhost:3111`) iframe에 고정 폭을 주고, 그 안의 `documentElement`를 측정한다. 미디어쿼리는 iframe 자신의 뷰포트를 기준으로 평가되므로 반응형 분기가 실제로 탄다.

```js
const f = document.createElement('iframe');
f.style.cssText = `width:${w}px;height:900px`;
f.src = 'http://localhost:3111' + route;
document.body.appendChild(f);
await new Promise(res => { f.onload = res; setTimeout(res, 4000); });
const d = f.contentDocument.documentElement;
// d.scrollWidth > d.clientWidth 이면 가로 스크롤
```

**검증**
`inner`가 요청한 폭과 정확히 일치하는지 함께 기록해, 이번에도 폭이 안 먹었으면 바로 드러나게 했다.

```
{"w":320,"r":"/faq","inner":320,"scrollW":320,"clientW":320,"overflow":false}
{"w":768,"r":"/pricing","inner":768,"scrollW":768,"clientW":768,"overflow":false}
{"w":1024,"r":"/guide","inner":1024,"scrollW":1024,"clientW":1024,"overflow":false}
{"w":1440,"r":"/faq","inner":1440,"scrollW":1440,"clientW":1440,"overflow":false}
```

시각 확인은 320px iframe 3개를 나란히 띄워 한 장으로 찍었다.

**추후 관리**
- 반응형 검증은 창 리사이즈에 기대지 않는다. iframe 프로브가 창 상태와 무관하게 동작한다.
- 측정값에 **측정 조건 자체를 같이 담는다.** `inner`를 함께 찍지 않았으면 이번 거짓 통과를 못 잡았다.

**배운 점**
- 도구의 성공 응답은 결과 확인이 아니다. TS-013이 "떠 있을 것"을 단언해서 생긴 문제라면, 이건 "성공했다니까 됐겠지"로 생긴 같은 종류의 문제다.
- 검증 코드가 통과를 보고할 때, 그 통과가 의미 있는 조건에서 나온 것인지 먼저 의심한다. `overflow:false`는 사실이었지만 쓸모없는 사실이었다.

---

### TS-015: 설계 문서가 요구한 `hidden` 토글과 아코디언 열림 애니메이션은 같이 쓸 수 없다

**날짜**: 2026-08-07
**상태**: 해결

**증상**
FAQ 아코디언 설계에 두 요구가 나란히 적혀 있었다.

```
- 답변 영역은 `id`로 연결하고 `hidden` 토글
- 열림/닫힘 전환은 `grid-template-rows: 0fr → 1fr` 또는 `max-height`.
  `height: auto` 애니메이션은 동작하지 않는다
```

둘을 그대로 구현하면 전환이 아예 재생되지 않는다.

**원인**
- 표면: 아코디언이 툭 열리고 툭 닫힌다.
- 근본(확인함): `hidden` 속성은 UA 스타일시트의 `display: none`이다. `display: none`인 요소는 전환이 시작되지도 않는다. `grid-template-rows`를 아무리 잘 잡아도 화면에 나타날 기회가 없다.

두 요구가 서로를 무효화하는 구조라, **설계 문서를 그대로 따르는 것이 불가능한 경우**였다.

**시도했지만 안 된 것**
- `.faq__answer { display: grid }`로 `[hidden]`의 UA 규칙을 특정도로 덮기 — 전환은 살아난다. 하지만 `hidden`이 하던 일(접근성 트리에서 제외)이 사라져 닫힌 답변 3개를 스크린리더가 전부 읽는다. 애니메이션을 얻고 접근성을 잃는 교환이라 기각했다.
- `hidden="until-found"` — 브라우저 지원 폭이 좁아 이 프로젝트 browserslist(`>0.2%, not dead`)에 맞지 않는다.

**해결**
`visibility`로 바꿨다. 접근성 트리 제외 효과는 `hidden`과 같고, 전환 가능한 속성이다.

```css
.faq__answer {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition: grid-template-rows var(--duration-normal) var(--ease-out-expo),
    visibility var(--duration-normal) var(--ease-out-expo);
}
.faq__answer--open { grid-template-rows: 1fr; visibility: visible; }
.faq__answer-inner { overflow: hidden; }
```

`visibility`는 양 끝 중 하나가 `visible`이면 전환 구간 내내 `visible`로 유지된다. 그래서 **닫히는 모션이 끝까지 재생된 뒤에** 트리에서 빠진다.

**검증**
두 번째 질문을 클릭한 뒤 세 항목의 상태:

```
[{"q":"웹캠을 계속 켜야 집중도 ","expanded":"false","vis":"hidden","h":"0"},
 {"q":"AI 분석 결과는 어떻게 ","expanded":"true","vis":"visible","h":"126"},
 {"q":"집중도 분석이 실제로 내 ","expanded":"false","vis":"hidden","h":"0"}]
```

하나만 열리고, 닫힌 것은 높이 0 + `visibility: hidden`. `prefers-reduced-motion` 대응은 `tokens.css` 전역 블록이 전환 시간을 0.01ms로 죽여 그대로 처리된다.

**추후 관리**
- 설계 문서에 `hidden`과 열림 애니메이션을 같이 적지 않는다. 둘 중 하나를 고르거나 `visibility`를 명시한다.
- 이 파일의 CSS 주석에 왜 `hidden`을 안 썼는지 남겨뒀다. 나중에 "설계와 다르다"고 되돌리는 것을 막기 위해서다.

**배운 점**
- 설계 문서의 두 요구가 충돌하면 하나를 조용히 버리지 않는다. 등가 대체를 찾고, 왜 문서와 달라졌는지 코드와 보고 양쪽에 남긴다.
- 접근성 요구를 애니메이션과 맞바꾸는 선택지가 보이면 그건 대개 잘못된 축이다. 둘 다 되는 속성이 있는지 먼저 찾는다.

---

### TS-016: 본문 대비비만 보고 통과시킬 뻔했다 — `--color-border-strong`이 UI 경계 3:1에 미달

**날짜**: 2026-08-07
**상태**: 부분 해결 (이번 범위만)

**증상**
검증 항목은 "본문 대비비 4.5:1 이상"이었다. 텍스트 조합은 전부 통과했다.

```
 18.04:1  AA   본문 text on bg
  6.41:1  AA   muted on surface
  9.49:1  AA   on-accent on accent (CTA/badge)
```

같은 스크립트에 UI 경계(WCAG 1.4.11, 3:1)를 같이 넣어봤더니 하나가 걸렸다.

```
  2.83:1  FAIL  border-strong on surface (UI 3:1)
```

**재현 조건**
`--color-border-strong`(= `--navy-550`, `oklch(48% 0.02 260)`)을 `--color-surface`(`navy-900`) 또는 `--color-surface-alt`(`navy-800`) 위에 테두리로 쓰는 모든 경우.

| 조합 | 대비비 | 3:1 |
|---|---|---|
| border-strong on surface (navy-900) | 2.83:1 | 미달 |
| border-strong on surface-alt (navy-800) | 2.52:1 | 미달 |

**원인**
- 표면: 윤곽선 버튼의 테두리가 흐리다.
- 근본(확인함): 디자인 시스템 도입 당시 대비비 검토가 **텍스트 기준(4.5:1)에서 멈췄다.** 비텍스트 대비(1.4.11)는 검증 대상이 아니었고, `--color-border-strong`은 그 기준을 만족하도록 정해진 값이 아니다. 이름이 `strong`이라 충분해 보이는 것도 한몫했다.

윤곽선 버튼은 테두리가 사라지면 "누를 수 있다"는 신호 자체가 없어진다. 카드 테두리(`--color-border`)와 달리 장식이 아니다.

**시도했지만 안 된 것**
- 토큰 값을 올려 전역 해결하는 방안을 검토했다가 접었다. `--color-border-strong`은 Login·SignUp의 입력 필드 테두리와 AiChat의 선택된 대화 표시에도 쓰인다. 이번 작업 범위는 마케팅 3화면이고, 설계 문서가 "이미 이전이 끝난 9개 화면"을 명시적으로 범위 밖에 뒀다. 검증 없이 4개 화면의 배색을 건드리는 쪽이 위험이 크다.

**해결**
이번에 새로 쓴 곳만 `--color-text-muted`(navy-400, surface 위 6.41:1)로 바꿨다. 테두리에 전경색 토큰을 쓰는 것이 어색해 보일 수 있어 CSS에 이유를 주석으로 남겼다.

```css
/* --color-border-strong 는 surface 위에서 2.83:1 로 WCAG 1.4.11(UI 경계
   3:1)에 미달한다. 버튼 윤곽은 그 테두리만으로 식별되므로 6.4:1 인
   --color-text-muted 를 쓴다. */
border: 1px solid var(--color-text-muted);
```

**남겨둔 것 (미해결)**
같은 토큰을 쓰는 아래 세 곳은 손대지 않았다. 전부 인터랙티브 요소의 경계라 같은 기준에 걸린다.

| 위치 | 용도 | 배경 | 대비비 |
|---|---|---|---|
| `Login.css:46` | 입력 필드 테두리 | surface-alt | 2.52:1 |
| `SignUp.css:84` | 입력 필드 테두리 | surface-alt | 2.52:1 |
| `AiChat.css:370` | 선택된 대화 테두리 | surface-alt | 2.52:1 |

AiChat은 왼쪽에 `--color-accent` 3px 막대를 따로 두고 있어 테두리만으로 상태를 전달하지는 않는다. 입력 필드 두 곳이 더 시급하다.

**검증**
oklch → sRGB → WCAG 상대휘도 순으로 직접 계산했다. TS-006에서 Chrome의 `oklch()` 리터럴을 R/G/B로 오독한 전례가 있어, 이번에는 변환을 코드로 명시했다.

**추후 관리**
- `--color-border-strong`의 명도를 올리거나, UI 경계 전용 토큰(`--color-border-interactive` 같은)을 따로 두고 3:1을 보장한다. 위 3개 파일과 함께 별도 작업으로 뺀다.
- 대비비 점검 스크립트에 **텍스트 조합과 UI 경계 조합을 같이 넣는다.** 텍스트만 돌리면 이번 건은 안 잡힌다.

**배운 점**
- 검증 항목에 적힌 것만 확인하면 적히지 않은 것을 놓친다. 스펙의 "본문 대비비 4.5:1"을 그대로 따랐으면 통과 보고를 냈을 것이다.
- 토큰 이름(`strong`)이 기준 충족을 보장하지 않는다. 숫자를 봐야 한다.

---

### TS-017: 스크롤 진입 연출의 폴백이 트랜지션에 의존해, 애니메이션이 억제된 환경에서 콘텐츠가 계속 투명했다

**날짜**: 2026-08-07
**상태**: 해결

**증상**
진입 연출을 전 화면으로 넓히고 340px iframe 세 개로 확인했더니, 머리말만 선명하고 카드·단계·질문은 유령처럼 흐릿하게 남았다. 화면이 비어 보인다.

계산값도 이상했다. `is-revealed` 클래스가 붙어 있는데 `opacity`가 0이었다.

```
{"classes":"pricing__tier is-revealed","opacity":"0",
 "delay":"0s","dur":"0.6s, 0.6s","idx":"0"}
```

**재현 조건**
- `useRevealOnScroll`을 쓰는 화면을
- 배경 탭 또는 iframe처럼 **애니메이션이 억제되는 컨텍스트**에서 연다
- IntersectionObserver가 발화하지 않는다

**원인**

- 표면: 명시도 문제로 보였다. `.reveal-enabled [data-reveal]`(0,2,0)와 `[data-reveal].is-revealed`(0,2,0)가 동점이라 순서에만 기대고 있었다. 이건 실제 결함이라 함께 고쳤지만 **이번 증상의 원인은 아니었다.**
- 근본(확인함): 폴백이 `is-revealed`를 붙이는 것으로 끝났다. 그 클래스의 복구(`opacity: 0 → 1`)는 **트랜지션이 실제로 재생돼야 완성된다.** 애니메이션이 억제된 컨텍스트에서는 전환이 진행되지 않아 시작값 0에 그대로 머문다. 클래스는 붙었는데 화면은 여전히 비어 있는 상태가 된다.

같은 이유로 조상 `.route-enter`(라우트 진입 페이드, `fill: both`)도 `opacity: 0`으로 얼어 있었다. **즉 계산값 판독 자체가 이 환경에서는 믿을 수 없다** — 실제 화면은 스크린샷으로 확인해야 한다.

**시도했지만 안 된 것**
- `.reveal-enabled [data-reveal].is-revealed`로 명시도를 올렸다 → 계산값은 여전히 0. 원인이 명시도가 아니었으므로 당연한 결과였다. (규칙 자체는 순서 의존을 없애는 개선이라 남겨뒀다)
- 계산값(`getComputedStyle`)으로 원인을 좁히려 했다 → 조상까지 훑고 나서야 `.route-enter`도 0이라는 것을 보고, 측정 쪽이 틀렸음을 알았다. 여기서 방향을 바꿨다.

**해결**
폴백이 전환에 기대지 않게 한다. 숨김 자체를 걷어내면 전환이 필요 없다.

```js
const fallback = window.setTimeout(() => {
  targets.forEach(reveal);
  container.classList.remove('reveal-enabled');  // ← 이 줄
  observer.disconnect();
}, FALLBACK_MS);
```

`.reveal-enabled`가 사라지면 `[data-reveal]`에 `opacity: 0`을 거는 규칙이 아예 매칭되지 않는다. 전환이 재생되든 말든 즉시 보인다.

**검증**
340px iframe 세 개(Pricing·UserGuide·FAQ)에서 카드·단계·질문이 전부 완전히 렌더되는 것을 스크린샷으로 확인했다. 정상 탭에서는 스크롤에 따라 순서대로 들어오는 연출이 그대로 유지된다.

**추후 관리**
- **연출의 폴백은 연출과 같은 수단에 기대면 안 된다.** 애니메이션이 실패하는 상황을 대비하는 폴백이 애니메이션으로 복구하면 아무것도 대비하지 못한다.
- 이 환경에서 `getComputedStyle`로 opacity·transform을 읽어 판단하지 않는다. 애니메이션·트랜지션이 얼어 시작값이 나온다. 레이아웃(`scrollWidth` 등)은 신뢰할 수 있다.
- TS-007이 같은 뿌리다. 그때는 "관찰자가 안 도니 숨기지 말자"였고, 이번엔 "폴백이 돌아도 전환이 안 돌면 소용없다"였다.

**배운 점**
- 첫 가설(명시도)이 그럴듯해서 고쳤는데 증상이 그대로였다. **고쳤는데 안 나으면 원인이 아니다** — 다음 가설로 넘어가는 신호로 삼아야 했고, 실제로 그 시점에 조상을 훑어 원인을 찾았다.
- 콘텐츠를 숨기는 코드에는 항상 "이게 실패하면 사용자는 무엇을 보는가"를 먼저 답해야 한다. 답이 "빈 화면"이면 설계가 틀린 것이다.

**재발 사례 (같은 날, 같은 뿌리)**

진입 연출을 넓히면서 같은 함정을 두 번 더 만들었다가 배포 전에 잡았다.

| 위치 | 무엇이 문제였나 | 고친 방식 |
|---|---|---|
| `Sparkline.css` | 기본 상태가 `stroke-dashoffset: 100`(선 숨김)이고 애니메이션이 0으로 되돌리는 구조. `forwards` 까지 붙어 있었다 | 기본을 "다 그려진 상태"로 두고 숨김을 `@keyframes` 의 `from` 으로 옮김. `forwards` 제거 |
| `motion.css`의 `.fade-in-content` | `animation: ... both` — 재생이 멈추면 `from`(opacity 0)을 붙들어 목록이 통째로 사라진다. 하필 로그인이 필요해 브라우저로 확인할 수 없는 화면들이었다 | fill-mode 제거. 지연도 함께 제거 — fill 없이 지연을 주면 보였다가 투명해져 깜빡인다 |

**규칙으로 정리한다: 콘텐츠의 기본 상태는 항상 "보이는 상태"여야 한다.**
숨김은 애니메이션 안(`from`)에만 존재해야 하고, `fill-mode` 로 그 숨김을
바깥까지 끌고 나오면 안 된다. 재생되면 연출이 되고, 안 되면 그냥 보인다.

**세 번째 재발 — 이번엔 내가 쓴 코드가 아니었다 (PDF 저장 기능 작업 중 발견)**

`FocusChart.css` 의 막대가 원래부터 이렇게 되어 있었다.

```css
animation: focus-chart-bar-grow var(--duration-slow) var(--ease-out-expo) both;
/* @keyframes ... from { transform: scaleY(0); } */
```

인쇄는 애니메이션이 재생되지 않는 매체다. `both` 가 `from`(높이 0)을 붙들면
**집중도 그래프가 통째로 사라진 PDF** 가 나온다. 리포트에서 그래프가 빠지면
남는 게 숫자 몇 개뿐이라, 기능 자체가 무의미해진다.

인쇄 블록에서 `animation: none` 으로 못박아 PDF는 해결했다.
**화면 쪽은 그대로 두었다** — 고치려면 왼쪽부터 순차로 자라는 연출을 포기해야
해서(`fill` 없이 `animation-delay` 를 주면 지연 동안 보였다가 0으로 튄다),
연출을 없앨지는 내가 정할 문제가 아니다. 화면에서도 배경 탭·iframe 처럼
애니메이션이 억제되는 환경에서는 같은 증상이 날 수 있다는 것을 남겨 둔다.

배운 것: 이 함정은 **내가 새로 쓰는 코드에만 있는 게 아니다.** 기존 코드에도
이미 심겨 있고, 새 매체(인쇄)를 추가하는 순간 드러난다. `fill-mode` 가 붙은
`animation` 은 발견할 때마다 기본 상태를 확인해야 한다.
