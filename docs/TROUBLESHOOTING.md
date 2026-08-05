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

**배운 점**
"모듈을 못 찾는다"는 에러가 항상 설치 문제인 것은 아니다. 빌드는 되는데 테스트 러너에서만 못 찾는다면, 두 도구가 모듈을 해석하는 방식(esbuild/webpack의 최신 exports map 해석 vs. 구버전 Jest 리졸버)이 다르다는 신호다. `package.json`의 `exports` 필드를 직접 열어보면 원인을 빠르게 좁힐 수 있다.
