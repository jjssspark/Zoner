# ADR-005 — CRACO 도입 대신 `CI=false`로 빌드를 통과시킨다

**날짜** 2026-08-11 · **상태** 채택 (한시적. 되돌리는 조건 있음)
**관련** [ADR-001](001-in-browser-inference.md), [ADR-003](003-keep-cra.md), TROUBLESHOOTING.md TS-020

## 맥락

포트폴리오용 첫 Vercel 배포에서 빌드가 실패했다. 로컬에서는 같은 명령이 성공했고,
테스트 276개도 전부 통과한 상태였다.

```
Treating warnings as errors because process.env.CI = true.
Most CI servers set it automatically.

Failed to compile.

Critical dependency: the request of a dependency is an expression
```

원인이 두 겹이다.

1. **CI 환경은 `CI=true`를 자동으로 건다.** CRA는 이 변수를 보면 경고를 에러로 승격한다 ([ADR-003](003-keep-cra.md))
2. **승격된 그 경고는 우리 코드에서 나온 게 아니다.** `@mediapipe/tasks-vision/vision_bundle.mjs`
   2941행이 웹팩이 정적 분석할 수 없는 동적 import 표현식을 쓴다 ([ADR-001](001-in-browser-inference.md))

즉 **고칠 수 없는 경고 하나 때문에 배포가 통째로 막힌 상태**였다.

## 선택지

| 안 | 내용 | 문제 |
|---|---|---|
| A. CRACO + `ignoreWarnings` | 웹팩 설정을 열어 그 경고만 골라 끈다 | 새 빌드 의존성. CRACO는 `react-scripts` 내부를 감싸 덮어쓰는 도구라, CRA 버전과의 호환이 또 하나의 관리 대상이 된다 |
| B. `CI=false` | 빌드 명령에서만 승격을 해제한다 | **우리 코드의 lint 경고까지 함께 눈감아 준다** |
| C. MediaPipe 패치·교체 | 라이브러리를 고치거나 다른 것으로 바꾼다 | 앱의 핵심 의존성이다. 경고 하나로 바꿀 대상이 아니다 |
| D. Vite 이전 | 번들러를 바꿔 문제를 우회한다 | 배포 하나 때문에 [ADR-003](003-keep-cra.md)을 뒤집는 셈 |

## 결정

**B — `vercel.json`의 빌드 명령에만 범위를 좁혀 승격을 해제한다.**

```json
{
  "buildCommand": "CI=false react-scripts build"
}
```

## 근거

**서드파티 경고 하나 때문에 새 빌드 의존성을 추가하는 비용이 더 크다.**
CRACO를 넣으면 이후 모든 빌드 문제에서 "CRA인가 CRACO인가"를 먼저 갈라야 한다.
[ADR-003](003-keep-cra.md)에서 CRA를 유지하기로 한 이유가 "도구를 건드리는 데 시간을 쓰지 않는다"였는데,
여기서 도구를 하나 더 얹으면 그 판단과 어긋난다.

**범위를 빌드 명령 하나로 가둘 수 있다.** 저장소 전체나 개발 환경에 `CI=false`를 심는 게 아니라,
배포 명령 한 줄에만 붙는다. 로컬에서 `CI=true`로 재현하는 것은 그대로 가능하다.

**테스트 쪽 그물은 살아 있다.** 테스트는 여전히 `CI=true`로 돌린다.
`CI=false`가 가리는 것은 빌드 경고뿐이고, 276개 테스트는 그대로 배포를 막을 수 있다.

## 대가

**이건 대가를 알고 고른 선택이다.**

`CI=false`는 MediaPipe 경고만 끄는 게 아니라 **우리 코드의 lint 경고도 함께 끈다.**
미사용 변수, 의존성 배열 누락 같은 것이 배포를 막지 못한다.
A안(`ignoreWarnings`)이었다면 그 경고 하나만 정확히 지목해 끌 수 있었다.

정밀함을 포기하고 단순함을 샀다. 지금 규모에서는 맞는 교환이라고 보지만,
**"우리 코드 경고가 배포를 못 막는다"는 사실을 잊으면 그때부터 위험해진다.**

## 결과

배포가 통과했고, 수정이 실제로 듣는지를 CI 조건을 재현해서 확인했다.

```bash
CI=true bash -c 'CI=false npx react-scripts build'   # 성공
npx vercel --prod --yes                              # ● Ready
```

**더 중요한 건 이 사건이 드러낸 검증의 공백이다.** 구현 계획의 완료 기준은
`npx react-scripts build` 성공이었는데, 그 명령은 **CI 조건을 재현하지 않는다.**
로컬 셸에 `CI`가 없으니 승격이 일어나지 않고, 따라서 이 검증은 통과할 수밖에 없었다.
**실패할 수 없는 조건으로 짜인 검증**이었던 것이다.

그래서 결정과 함께 완료 기준도 바꿨다 — 빌드 검증은 `CI=true`로 한다.
결정 하나보다 이쪽이 재발을 더 많이 막는다.

## 되돌리는 조건

- `@mediapipe/tasks-vision`을 올릴 때 이 경고가 사라졌는지 확인한다. 사라졌으면 `CI=false`를 걷어낸다
- 우리 코드의 lint 경고가 실제로 문제를 일으킨 사례가 한 번이라도 나오면, 그때는 A안(CRACO + `ignoreWarnings`)의 비용이 정당해진다
