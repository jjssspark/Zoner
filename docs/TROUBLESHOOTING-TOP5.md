# 트러블슈팅 5선

TS-001~021 중 다섯 건. 고른 기준은 **"고치는 데 오래 걸린 것"이 아니라 "사고 과정이 남는 것"**이다.

| 순 | 건 | 왜 골랐나 |
|---|---|---|
| 1 | [TS-017](#1-ts-017--고쳤는데-안-나았다-그리고-측정값-자체가-거짓말이었다) | 첫 가설이 틀렸다. 게다가 **측정 도구가 거짓값을 주고 있었다** |
| 2 | [TS-010](#2-ts-010--정적-리뷰-3회를-통과한-코드가-화면을-멈췄다) | 가설이 틀렸고, 그 전에 **독립 리뷰 3회를 통과**했다 |
| 3 | [TS-012](#3-ts-012--컬럼이-없다는-에러가-컬럼이-없다는-뜻이-아니었다) | 에러 메시지와 실제 원인이 안 이어졌다. 하루 넘게 **에러 없이 반쪽만 살아 있었다** |
| 4 | [TS-020](#4-ts-020--로컬에서-되던-빌드가-배포에서만-깨졌다) | 환경 문제. 그리고 **검증이 실패할 수 없는 조건으로 짜여 있었다** |
| 5 | [TS-005](#5-ts-005--브라우저-실측을-전부-통과한-데이터-손상) | 수동 검증으로는 원리상 못 잡는 결함. 리뷰가 잡았다 |

전문은 [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)에 증상·재현 조건·**실패한 시도**·근본 원인·검증까지 있다.

---

## 1. TS-017 — 고쳤는데 안 나았다. 그리고 측정값 자체가 거짓말이었다

**증상**
스크롤 진입 연출을 전 화면으로 넓히고 340px iframe 세 개로 확인했더니,
머리말만 선명하고 카드·단계·질문이 유령처럼 흐릿하게 남았다. 화면이 비어 보인다.

계산값도 이상했다. `is-revealed` 클래스가 붙어 있는데 `opacity`가 0이었다.

```
{"classes":"pricing__tier is-revealed","opacity":"0",
 "delay":"0s","dur":"0.6s, 0.6s","idx":"0"}
```

**첫 가설 — 명시도 충돌**
`.reveal-enabled [data-reveal]`(0,2,0)와 `[data-reveal].is-revealed`(0,2,0)가 동점이라
소스 순서에만 기대고 있었다. 그럴듯했다. `.reveal-enabled [data-reveal].is-revealed`로
명시도를 올렸다.

**증상이 그대로였다.**

**방향 전환**
계산값으로 원인을 좁히려고 조상까지 훑다가, 라우트 진입 페이드용 `.route-enter`도
`opacity: 0`으로 얼어 있는 것을 봤다. 그건 이 증상과 아무 관계가 없는 요소다.

여기서 **측정 쪽이 틀렸다**는 걸 알았다.

**근본 원인**
폴백이 `is-revealed` 클래스를 붙이는 것으로 끝났다. 그런데 그 클래스의 복구
(`opacity: 0 → 1`)는 **트랜지션이 실제로 재생돼야 완성된다.**
애니메이션이 억제된 컨텍스트(배경 탭·iframe)에서는 전환이 진행되지 않아 시작값 0에 머문다.

**연출이 실패하는 상황을 대비하는 폴백이, 연출과 같은 수단으로 복구하고 있었다.**

**해결**
숨김 자체를 걷어낸다. 전환이 필요 없어진다.

```js
const fallback = window.setTimeout(() => {
  targets.forEach(reveal);
  container.classList.remove('reveal-enabled');  // ← 이 줄
  observer.disconnect();
}, FALLBACK_MS);
```

`.reveal-enabled`가 사라지면 `[data-reveal]`에 `opacity: 0`을 거는 규칙이 아예 매칭되지 않는다.

**남은 것**
- **고쳤는데 안 나으면 그건 원인이 아니다.** 다음 가설로 넘어가는 신호로 삼아야 한다
- **이 환경에서 `getComputedStyle`로 opacity·transform을 읽어 판단하지 않는다.** 애니메이션이 얼어 시작값이 나온다. 레이아웃 값(`scrollWidth` 등)은 신뢰할 수 있다
- **콘텐츠의 기본 상태는 항상 "보이는 상태"여야 한다.** 숨김은 `@keyframes`의 `from`에만 있어야 하고, `fill-mode`로 바깥까지 끌고 나오면 안 된다

같은 함정을 그날 두 번 더 만들었다가 배포 전에 잡았고(`Sparkline.css`, `motion.css`),
세 번째는 **내가 쓴 코드가 아니었다** — `FocusChart.css`의 막대가 원래부터 `animation: … both`였고,
인쇄는 애니메이션이 재생되지 않는 매체라 **그래프가 통째로 사라진 PDF**가 나왔다.

---

## 2. TS-010 — 정적 리뷰 3회를 통과한 코드가 화면을 멈췄다

**증상**
AI 채팅 대화방 분리를 배포한 뒤 `/ai-chat`에 들어가면 아무것도 없는 어두운 화면만 나온다.
헤더도, 대화 목록도, 입력창도, **에러 메시지도** 없다.

콘솔에 에러가 하나도 없고, 네트워크 요청은 정상적으로 200을 받는다.

**첫 가설 — 로그인 세션**
`!user` 분기에 걸렸나 싶었다. 하지만 그 분기라면 `navigate('/login')`으로 URL이 바뀌어야 하는데
`/ai-chat` 그대로였다. **가설을 버리고 코드를 직접 읽었다.**

**근본 원인**
마운트 해제 후 state를 건드리지 않으려고 둔 가드가 StrictMode 재마운트에서 복구되지 않았다.

```javascript
const isMountedRef = useRef(true);

useEffect(() => {
  return () => {
    isMountedRef.current = false;   // 언마운트에서 false로만 간다
  };
}, []);
```

React 18/19 StrictMode는 개발 모드에서 **마운트 → 언마운트 → 재마운트**를 한 번 한다.
첫 언마운트의 cleanup이 `false`로 만드는데, **ref 객체는 그 재마운트를 넘어 유지된다.**
어디에서도 `true`로 되돌리지 않았다.

그 결과 실제로 화면에 남는 두 번째 마운트에서는 처음부터 `false`이고:

```javascript
} finally {
  if (isMountedRef.current) {
    setIsLoading(false);      // 영원히 실행되지 않는다
  }
}
```

**로딩 해제를 보장하려고 넣은 `finally`가, 같은 커밋에서 함께 넣은 가드 때문에 무력화됐다.**

**해결**
수명주기 이펙트의 **본문**에서 `true`로 되돌린다.

```javascript
useEffect(() => {
  isMountedRef.current = true;
  return () => { isMountedRef.current = false; };
}, []);
```

**왜 이게 5선에 들어가나**

이 코드는 **세 번의 독립 리뷰를 통과**했다 — 태스크 리뷰, 브랜치 전체 리뷰, 수정 후 재리뷰.
세 리뷰 모두 "초기 로드의 모든 이탈 경로가 `setIsLoading(false)`에 도달하는가"를
명시적으로 지시받고 경로를 하나씩 열거해 "도달한다"고 답했다.

**그 답은 종이 위에서 옳았다.** 리뷰어들은 `finally`가 무조건 실행되는지를 봤고, 실제로 무조건 실행된다.
**아무도 `isMountedRef.current`가 그 시점에 무슨 값인지를 묻지 않았다.**

**남은 것**
- **가드는 그 자체가 실패 지점이다.** `finally { if (조건) { 해제 } }`는 `finally`의 보장을 조건문의 보장으로 낮춘 것이다
- **"에러가 없다"는 정상이라는 뜻이 아니다.** TS-008은 실패가 로딩 해제를 건너뛴 건이었고, 이번엔 성공했는데도 건너뛰었다. 둘 다 콘솔은 깨끗했다
- ref 기반 마운트 가드는 이펙트 **본문**에서 되돌린다. `let isMounted = true`처럼 이펙트 **안에** 선언하는 지역 변수 패턴은 이 문제가 없다

이 저장소에서 StrictMode 관련 사고가 세 번째다 (TS-002, TS-009, TS-010).

---

## 3. TS-012 — "컬럼이 없다"는 에러가 컬럼이 없다는 뜻이 아니었다

**증상**
`focus_breakdown` 컬럼은 전날 `study_sessions`에 추가했고, 그때부터 모든 세션이 값을 정상 저장하고 있었다.
그런데 조회하면:

```
Failed to run sql query: ERROR:  42703: column "focus_breakdown" does not exist
LINE 1: select count(*) as sessions_before, count(focus_breakdown) as with_breakdown from active_study_sessions limit 100
```

`select * from study_sessions`에는 그 컬럼이 멀쩡히 있다. **테이블에는 있는데 뷰에는 없다.**

**근본 원인**
`active_study_sessions` 뷰가 **컬럼을 하나씩 나열하는 형태로 고정**돼 있었다.

```sql
create or replace view active_study_sessions with (security_invoker = true) as
select id, user_id, started_at, ended_at, duration_seconds, focus_score, timeline, created_at, deleted_at
from study_sessions where deleted_at is null;
```

`focus_breakdown`은 그 다음 마이그레이션에서 테이블에만 추가됐다.
**뷰는 생성 시점의 컬럼 목록으로 고정되므로 테이블에 컬럼이 늘어도 모른다.**

그리고 화면(`Read.js`)은 테이블이 아니라 **뷰**에서 읽는다.

**아무도 눈치채지 못한 이유가 핵심이다.**
에러가 난 적이 없다. `Read.js`가 `focus_breakdown`을 `select`에 넣은 적이 없으니 조회 실패가
발생하지 않았고, 저장 쪽은 테이블에 직접 insert 하므로 정상 동작했다.
**하루 넘게 저장은 되는데 화면에서는 읽을 방법이 없는 데이터가 쌓이고 있었다.**

**어떻게 잡았나**
디버깅이 아니라 **계획 단계의 코드 읽기**로 먼저 잡았다.
승인된 스펙에 "`focus_breakdown`은 이미 저장되고 있으니 `select`에 추가만 하면 된다"고
적혀 있었는데, `Read.js:48`이 테이블이 아니라 뷰에서 읽는 것을 확인하고 뷰 정의를 열어 보니
컬럼이 없었다. 그 뒤 실제 DB에 쿼리를 날려 위 에러로 확증했다.

**해결**
`alerts` 컬럼을 추가하는 마이그레이션에서 뷰도 함께 갱신했다.

> ⚠️ `create or replace view`는 **기존 컬럼의 이름과 순서를 바꿀 수 없다.**
> `focus_breakdown`을 의미상 어울리는 `timeline` 옆에 끼워 넣으면
> `cannot change name of view column`으로 실패한다. 읽기에는 어색해도 뒤에 붙여야 한다.

**검증**
뷰 컬럼 9 → 11. 그리고 **전날 저장된 세션의 리포트에 원인별 비율이 처음으로 표시됐다** —
집중 33% / 아래 보기 33% / 자리 비움 17% / 눈 감김 17%.
데이터는 내내 있었고 뷰가 가리고 있었을 뿐이다.

**남은 것**
- **"컬럼이 없다"는 어느 관계(relation)에 없다는 뜻이다.** 테이블과 뷰는 다른 관계다. 에러 메시지의 `from` 절을 먼저 읽어야 한다
- **컬럼을 추가했으면 저장뿐 아니라 조회까지 한 번은 실제로 해봐야 한다**
- **스펙도 틀릴 수 있다.** 그 문장은 테이블 기준으로는 맞고 뷰 기준으로는 틀렸다

---

## 4. TS-020 — 로컬에서 되던 빌드가 배포에서만 깨졌다

**증상**
포트폴리오용 첫 Vercel 배포. 직전에 로컬에서 `npx react-scripts build` 성공을 확인했고
테스트 276개도 전부 통과한 상태였다. 그런데 Vercel 빌드가 실패했다.

```
Error: Command "npm run build" exited with 1
```

**Vercel이 뱉은 요약에는 왜 실패했는지가 없다.** 같은 명령이 로컬에서 성공했으므로
처음에는 Node 버전이나 의존성 설치 문제를 의심할 여지가 있었다.

**재현 조건이 원인을 가리켰다**

| 명령 | 결과 |
|---|---|
| `CI=true npx react-scripts build` | **항상 실패** |
| `npx react-scripts build` | 성공 |

환경 차이는 Node 버전도 의존성도 아니고 **환경변수 하나**였다.

**근본 원인 — 두 겹이라 메시지만 봐서는 안 이어진다**

```
Treating warnings as errors because process.env.CI = true.
Most CI servers set it automatically.

Failed to compile.

Critical dependency: the request of a dependency is an expression
```

1. **Vercel을 포함한 CI 환경은 `CI=true`를 자동으로 설정한다.** CRA는 이 변수를 보면 경고를 에러로 승격한다
2. **승격된 그 경고는 우리 코드에서 나온 게 아니다.** `@mediapipe/tasks-vision/vision_bundle.mjs`
   2941행이 웹팩이 정적 분석할 수 없는 동적 import 표현식을 쓴다. 라이브러리를 패치하지 않는 한 없앨 수 없다

에러 메시지는 "의존성이 이상하다"고 말하는데 실제로 고쳐야 할 것은 **빌드 환경변수**였다.

**왜 배포 전에 못 잡았나 — 이쪽이 더 중요하다**

실패한 수정 시도는 없었다. 가설이 첫 번에 맞았다. 문제는 그 전이다.
구현 계획의 완료 기준이 이렇게 적혀 있었다.

```
- [ ] `npx react-scripts build` 성공
```

**이 명령은 CI 조건을 재현하지 않는다.** 로컬 셸에 `CI`가 없으므로 경고 승격이 일어나지 않고,
따라서 이 검증은 통과할 수밖에 없었다. **실패할 수 없는 조건으로 짜인 검증이었다.**

TS-018과 같은 계열이다. 그때는 검증 하니스가 `body`에 흰 배경을 강제해 버그를 가렸고,
이번엔 검증 명령이 실제 실행 환경을 재현하지 않아 가렸다.

**해결**
빌드 명령에만 범위를 좁혀 승격을 해제했다. 대안(CRACO + `ignoreWarnings`)과의 비교는
[ADR-005](adr/005-ci-false-over-craco.md)에 있다.

```json
{ "buildCommand": "CI=false react-scripts build" }
```

`CI=false`는 우리 코드의 lint 경고까지 함께 눈감아 준다. **대가를 알고 고른 선택이다.**

**검증**

```bash
CI=true bash -c 'CI=false npx react-scripts build'                        # 성공
npx vercel --prod --yes                                                   # ● Ready
curl -o /dev/null -w "%{http_code}" https://zoner-one.vercel.app/read     # 200
curl -o /dev/null -w "%{http_code}" https://zoner-one.vercel.app/mypage   # 200
```

`/read`와 `/mypage`가 200을 내는 것이 중요하다. `BrowserRouter`를 쓰는 SPA는 정적 호스팅에서
그 경로에 해당하는 파일이 없어 기본적으로 404가 난다. `vercel.json`의 rewrite 폴백이 걸렸다는 증거다.

배포별 URL이 302를 내는 것은 버그가 아니라 Vercel이 배포별 주소에만 거는 SSO 보호다.
처음엔 이걸 배포 실패로 오인할 뻔했다.

**남은 것**
- **완료 기준의 빌드 검증을 `CI=true`로 바꿨다.** 로컬 빌드 성공은 배포 성공을 보장하지 않는다
- **배포 자체가 여태 없던 검증 계층이었다.** 3주 가까이 쌓인 코드가 로컬 검증을 전부 통과했지만 처음 배포하자마자 깨졌다
- **검증 환경과 실행 환경의 거리가 멀수록 통과의 의미는 약해진다**

---

## 5. TS-005 — 브라우저 실측을 전부 통과한 데이터 손상

**문제**
세션에 시작/중지/재개/종료 제어를 넣으면서, 저장할 `duration_seconds`를 화면 타이머 카운터로 바꿨다.
일시정지 구간을 자연스럽게 뺄 수 있어서였다.

```js
elapsedTimerIdRef.current = window.setInterval(() => {
  setElapsedSeconds((prev) => prev + 1);
}, 1000);
...
duration_seconds: elapsedSeconds,   // ← 시간이 아니라 "틱이 돈 횟수"
```

**코드 리뷰에서 지적됐다** — 다른 탭을 보며 공부하면 학습 시간이 실제보다 적게 기록된다.

**근본 원인**
`elapsedSeconds`는 시간이 아니라 **인터벌 콜백이 실행된 횟수**다.

- 브라우저는 숨겨진 탭의 타이머를 최소 1000ms로 클램프한다
- Chrome은 탭이 5분 이상 숨겨지면 intensive throttling으로 **분당 1회**까지 낮춘다
- `setInterval`은 메인 스레드가 바빠 놓친 틱을 나중에 보충하지 않는다. 이 앱은 5초마다 MediaPipe 추론을 돌리므로 장시간 세션에서 누락이 단조 누적된다

웹캠 스트림이 활성이면 스로틀링 예외에 해당할 가능성도 있으나 확인하지 않았다.
**문서로 보장되지 않는 브라우저 구현 세부사항에 데이터 정확성을 의존시킬 수 없다**고 판단했다.

**왜 실측으로 못 잡았나**
브라우저 수동 검증(시작→중지→재개→종료, 중지↔재개 2회)에서 타이머가 36→44로 정확히 이어지고
중지 4초가 정확히 제외되는 것까지 확인했다. **전부 포그라운드였기 때문에** 이 문제를 전혀 건드리지 못했다.

그리고 이건 **이번 변경이 만든 회귀**다. 이전 코드(`endedAt - startedAt` 벽시계 차이)에는 이 문제가 없었다.

**해결**
표시와 저장의 책임을 분리한다. 화면 타이머는 카운터를 그대로 쓰되,
**저장값은 활동 구간별 벽시계 시간을 누적**한다.

```js
// stopTicking(): 구간 종료 — null 가드로 중복 호출 시 이중 계상 방지
if (segmentStartedAtRef.current !== null) {
  accumulatedMsRef.current += Date.now() - segmentStartedAtRef.current;
  segmentStartedAtRef.current = null;
}

duration_seconds: Math.round(accumulatedMsRef.current / 1000),
```

`null` 가드가 중요하다 — 저장 실패 후 "다시 저장"을 누르면 `handleStop`이 다시 실행되는데,
가드가 없으면 마지막 구간이 두 번 더해진다.

**남은 부채**
`timeline`의 버킷 인덱스는 여전히 `started_at` 기준 벽시계 분이라,
1분 이상 일시정지하면 저장 시간과 그래프 x축의 기준이 서로 다르다.
수정 범위가 다른 파일로 번져서 문서화만 하고 미뤘다.

**남은 것**
- **타이머 카운터는 시간이 아니다.** UI에 초를 보여주려고 만든 값을 그대로 저장하는 것은 표시용 근사값을 진실로 승격시키는 일이다. 저장이 필요한 값은 `Date.now()` 같은 **실제 시각을 빼서** 구한다
- **실측은 "내가 테스트한 조건"만 검증한다.** 백그라운드 탭, 장시간 실행, 저사양 기기처럼 재현 비용이 높은 조건은 코드를 읽어서 추론해야 한다. 수동 검증이 끝난 뒤에도 코드 리뷰를 거쳐야 하는 이유다

---

## 다섯 건을 관통하는 것

세 건(TS-017 · TS-010 · TS-020)이 같은 말을 하고 있다.

> **검증이 통과했다는 사실 자체는 아무것도 보장하지 않는다 — 무엇을 재현한 검증인지가 전부다.**

- TS-017: 측정 도구(`getComputedStyle`)가 그 환경에서 거짓값을 줬다
- TS-010: 정적 리뷰 3회가 옳은 답을 냈는데 실행이 달랐다
- TS-020: 검증 명령이 실행 환경을 재현하지 않아 실패할 수 없는 조건이었다
- TS-012 · TS-005: 에러도 안 나고 실측도 통과했지만 데이터가 조용히 반쪽이었다

그래서 이 저장소에서 완료 기준을 쓸 때 **"이 검증은 실패할 수 있는가"**를 먼저 묻는다.
답이 "아니오"면 그건 검증이 아니다.

---

전체 기록: [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) (TS-001~021)
의사결정 기록: [`adr/`](adr/README.md)
