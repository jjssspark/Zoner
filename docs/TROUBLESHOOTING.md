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
