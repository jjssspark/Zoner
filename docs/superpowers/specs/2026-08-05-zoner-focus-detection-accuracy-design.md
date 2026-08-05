# Zoner 집중도 판정 정확도 개선 — 설계

## 배경

[[2026-08-04-zoner-focus-session-pipeline-design.md]]에서 구현한 집중도 판정은 신호가 **고개 방향 하나**뿐이다. `computeTickFocused()`는 얼굴이 검출되지 않거나 yaw 30° / pitch 20°를 넘으면 비집중, 아니면 집중으로 처리한다.

이 기준에는 두 가지 문제가 있다.

1. **놓치는 딴짓** — 책상 위 휴대폰을 보면 고개는 거의 움직이지 않는다. 시선만 아래로 내려가므로 현재 기준으로는 100% 집중으로 집계된다.
2. **잘못 잡는 집중** — 책상 위 교재를 보면 고개가 자연스럽게 아래로 내려간다. pitch 20°를 넘는 순간 비집중으로 찍히므로, **종이 교재로 공부하는 사용자는 집중도가 계속 낮게 나온다.** 이건 현재 배포된 코드에 이미 존재하는 결함이다.

또한 tick은 `{ timestampMs, focused: boolean }`뿐이라 "왜 비집중인지"를 알 수 없다. 후속 서브프로젝트(리포트 강화, 실시간 피드백, AI 조언)가 전부 이 원인 정보를 재료로 쓰므로, 그 전에 tick 구조를 확정해야 한다.

### 서브프로젝트 분해

집중도 분석 고도화는 범위가 커서 넷으로 나눴다. 의존 순서:

```
1. 판정 정확도 (이 문서)  ─┬─→ 3. 리포트 강화 ─→ 5. AI 피드백
                          └─→ 4. 실시간 피드백
2. 디자인 개편 (별도 스펙) ──→ 3, 4의 기반
```

1번이 먼저인 이유는 tick 구조가 3·4·5 모두의 입력이기 때문이다. 2번(디자인 개편)은 1번과 겹치지 않으나, UI 비중이 큰 3·4보다 먼저 와야 같은 화면을 두 번 만들지 않는다.

## 아키텍처

기존 구조를 그대로 유지한다 — 웹캠 프레임은 브라우저를 벗어나지 않고, MediaPipe `FaceLandmarker`로 클라이언트에서 분석하며, 집계 결과만 Supabase에 저장한다. 새 의존성도, 모델 교체도 없다.

변경은 두 곳이다.

- **신호 확보**: `FaceLandmarker` 옵션에 `outputFaceBlendshapes: true`를 추가한다. 이미 로드 중인 모델이 blendshape 52종을 함께 반환하며, 그중 눈 감김(`eyeBlinkLeft`/`eyeBlinkRight`)과 시선 방향(`eyeLookDownLeft`/`eyeLookDownRight`)을 쓴다.
- **판정 로직**: `computeTickFocused()`가 boolean 대신 `{ focused, reason }`을 반환하도록 바꾸고, 축별로 다른 규칙을 적용한다.

판정 로직은 전부 순수 함수로 유지한다 — MediaPipe 결과 객체를 입력으로 받고 부수효과가 없으므로, 실제 웹캠 없이 단위 테스트할 수 있다(기존 `focusTracker.test.js` 패턴).

## 판정 규칙

### reason 종류

```js
{ timestampMs, focused: boolean, reason: string }
```

| reason | 조건 | focused |
|---|---|---|
| `absent` | 얼굴 미검출 | false |
| `eyes_closed` | 양쪽 눈 감김이 **연속 2회 tick** | false |
| `head_turned` | \|yaw\| > 30° | false |
| `looking_up` | pitch > 20° (위쪽) | false |
| `looking_down` | pitch < -20° (아래쪽) 또는 시선 아래 | **true** |
| `focused` | 위 어디에도 해당 없음 | true |

### 우선순위

여러 조건이 동시에 성립할 수 있으므로 위 표의 순서대로 먼저 걸리는 것을 채택한다. 두 가지 순서 결정에 이유가 있다.

- **`absent`가 최상위**: 얼굴이 없으면 다른 신호를 판단할 근거 자체가 없다.
- **`eyes_closed`가 `head_turned`보다 위**: 졸면 고개가 함께 떨어져 두 조건이 같이 걸린다. 이때 사용자에게 알려줘야 할 정보는 "졸고 있다"이지 "고개를 돌렸다"가 아니다.

### 축을 나누는 이유 (yaw vs pitch)

기존 코드는 yaw와 pitch를 같은 임계값 로직으로 묶어 처리했다. 이번에 축별로 분리한다.

- **yaw(좌우)** 초과는 비집중이 맞다. 옆을 보는 것은 공부 자세가 아니다.
- **pitch 아래**는 **집중으로 친다**. 책상 위 교재·노트를 보는 자세이기 때문이다. 기존 코드가 이걸 비집중으로 처리한 것이 위 배경의 두 번째 문제다.
- **pitch 위**는 비집중으로 둔다. 천장을 보며 멍때리는 자세에 해당한다.

### `eyes_closed`의 연속 2회 규칙

눈 깜빡임은 0.1~0.4초, 샘플링 간격은 5초다. 단발 샘플로는 평범한 깜빡임과 졸음을 구분할 수 없다 — 우연히 깜빡이는 순간에 찍히면 졸음으로 오판된다.

따라서 **연속 2회 tick에서 모두 눈 감김이 잡힐 때만** `eyes_closed`로 판정한다. 10초 이상 눈을 감고 있어야 성립하므로 깜빡임은 걸러진다. 대가는 졸음 감지가 최대 10초 늦는 것인데, 샘플링을 1초로 올리는 대안(추론 부하 5배)보다 이 트레이드오프가 낫다고 판단했다.

연속 판정은 `createFocusTracker` 내부에서 직전 tick의 눈 감김 여부를 기억해 처리한다. 판정 자체는 순수 함수로 분리해 테스트 가능하게 둔다.

### `looking_down`을 집중으로 치는 이유

시선이 아래로 향하는 것은 휴대폰일 수도, 교재·필기일 수도 있다. **얼굴만 보는 모델로는 이 둘을 원리적으로 구분할 수 없다** — 시선 각도가 동일하기 때문이다.

세션 시작 시 "화면/종이" 모드를 고르게 하는 방안을 검토했으나 기각했다. 강의 영상을 보다가 필기하러 종이로 내려가는 전환이 세션 중에 자연스럽게 일어나는데, 그때마다 토글을 누르게 하는 것은 비현실적이고 사용자는 반드시 잊는다.

고개 각도와 시선 각도의 조합으로 구분하는 방안도 검토했다(책은 면적이 넓어 줄을 따라가려면 고개가 함께 내려가고, 휴대폰은 눈만 내리는 경향). 사람마다 자세 편차가 커서 신뢰할 수 없다고 보고 기각했다 — 통계적 경향을 개인 점수에 적용하면 경향에 맞지 않는 사용자에게는 계속 틀린 점수가 나온다.

채택한 방침은 **판정에는 관대하게, 리포트에는 정직하게**다. `looking_down`을 집중으로 세되 reason 태그는 남겨, 리포트에서 "시선 아래 26%"처럼 별도 항목으로 보여준다. 근거는 세 가지다.

1. **오판 비용이 비대칭이다.** 공부 중인 사용자를 딴짓으로 찍으면 신뢰를 잃고 앱을 떠난다. 반대 방향의 오차는 점수가 다소 후해질 뿐이다.
2. **모델이 모르는 것을 아는 척하지 않는다.** 근거 없는 추측을 점수에 넣으면 점수 전체의 신뢰도가 떨어진다.
3. **판단 재료를 사용자에게 넘긴다.** "시선 아래 26%"를 보면 본인은 그것이 교재였는지 휴대폰이었는지 안다.

세션 종료 후 "시선 아래 N분 중 딴짓이 있었나요?"를 물어 점수를 재계산하는 사후 조정은 3번(리포트 강화)에서 다룬다 — 흐름을 끊지 않고, 기억이 생생할 때 묻는다.

## 데이터 모델

`study_sessions`에 컬럼 하나를 추가한다. 기존 컬럼은 변경하지 않는다.

```sql
alter table study_sessions add column focus_breakdown jsonb;
```

```json
{
  "focused": 0.52,
  "looking_down": 0.26,
  "head_turned": 0.12,
  "absent": 0.07,
  "eyes_closed": 0.03,
  "looking_up": 0.00
}
```

각 값은 전체 tick 대비 해당 reason의 비율(소수 둘째 자리 반올림)이다. 합은 1.0이 된다.

**기존 행은 `null`이다.** 이 컬럼을 읽는 화면은 반드시 null을 처리해야 한다 — 이번 스펙에서는 저장만 하고 표시는 3번에서 다루므로, 읽는 쪽 대응도 3번의 범위다.

`focus_score`와 `timeline`은 계산 방식·의미 모두 그대로 유지한다. 기존 리포트 화면(`Read.js`, `Trashread.js`)이 깨지지 않아야 하기 때문이다. `focus_score`는 여전히 `focused: true`인 tick의 비율이며, `looking_down`이 집중으로 분류되므로 종이 교재 사용자의 점수는 자연히 개선된다.

RLS 정책은 컬럼 추가에 영향받지 않는다(행 단위 정책이므로 변경 불필요).

## 프론트엔드 변경

### 수정 파일

**`src/lib/focusTracker.js`**
- `loadFaceLandmarker()`: `createFromOptions`에 `outputFaceBlendshapes: true` 추가
- `computeTickFocused(result, thresholds)`: 반환을 boolean → `{ focused, reason }`으로 변경. 위 우선순위대로 판정. 눈 감김 연속 판정을 위해 직전 tick의 눈 감김 여부를 인자로 받는다
- blendshape에서 눈 감김·시선 아래를 읽는 헬퍼 추가 (카테고리 이름으로 조회 — 인덱스 하드코딩 금지)
- `createFocusTracker()`: 직전 tick의 눈 감김 상태를 클로저에 유지하며 `onTick`에 `{ timestampMs, focused, reason }`을 전달
- `aggregateSession()`: 반환에 `focusBreakdown` 추가. `durationSeconds`·`focusScore`·`timeline` 계산은 변경 없음

**`src/components/StartLearning.js`**
- `onTick`에서 `tick.focused`를 그대로 사용(구조 변경 없음 — tick 객체에 필드가 추가될 뿐)
- `handleStop`의 insert에 `focus_breakdown: focusBreakdown` 추가

**`supabase/migrations/<timestamp>_add_focus_breakdown_to_study_sessions.sql`** (신규)

### 신규 의존성 없음

MediaPipe 모델·패키지 모두 그대로다.

## 임계값

기존 값을 유지하되 축별로 분리한다. blendshape 임계값은 신규다.

| 항목 | 값 | 비고 |
|---|---|---|
| `maxYawDeg` | 30 | 기존 값 유지 |
| `maxPitchUpDeg` | 20 | 기존 pitch 임계값에서 위쪽만 |
| `maxPitchDownDeg` | 20 | 초과 시 `looking_down`(집중) |
| `eyeBlinkThreshold` | 0.5 | blendshape 계수 0~1, 양쪽 모두 초과해야 눈 감김 |
| `eyeLookDownThreshold` | 0.4 | 양쪽 평균 기준 |
| `intervalMs` | 5000 | 기존 값 유지 |

blendshape 임계값(0.5 / 0.4)은 MediaPipe 계수의 통상 범위를 기준으로 잡은 초기값이다. 실사용 중 오탐이 확인되면 조정한다 — 상수로 분리해 한 곳에서 바꿀 수 있게 둔다.

## 에러 처리

- **blendshape 미반환**: 모델이 `faceBlendshapes`를 비워 반환하면(옵션 미적용, 버전 차이 등) 눈 감김·시선 판정을 건너뛰고 기존 고개 방향 판정만으로 동작한다. 세션을 막지 않는다 — 정확도가 낮아질 뿐 기능은 유지된다.
- **`focus_breakdown` 저장 실패**: 컬럼이 nullable이므로 값이 없어도 insert는 성공한다. 별도 처리 불필요.
- 캠 권한·모델 로드·저장 실패 처리는 기존과 동일하며 변경하지 않는다.

## 범위 밖 (명시적 제외)

- 리포트 화면에 breakdown 표시 (3번)
- 세션 중 실시간 알림·경고 (4번)
- 집중도 데이터를 Claude에 넘기는 조언 기능 (5번)
- 세션 종료 후 사후 조정(시선 아래 구간 자가 라벨링) (3번)
- 디자인·색·레이아웃 개편 (2번, 별도 스펙)
- 임계값의 사용자별 자동 보정(캘리브레이션)
- 휴대폰·물체 인식 모델 추가 — 얼굴 모델만 사용한다
- 여러 얼굴 동시 감지

## 검증

- 얼굴을 좌우로 돌렸을 때 `head_turned`, 위를 봤을 때 `looking_up`, 아래를 봤을 때 `looking_down`(집중 유지)으로 각각 판정되는지 확인
- 눈을 5초만 감았을 때는 졸음으로 잡히지 않고, 10초 이상 감고 있으면 `eyes_closed`가 잡히는지 확인
- 화면 밖으로 벗어났을 때 `absent`가 잡히는지 확인
- 세션 종료 후 Supabase에서 `focus_breakdown` 값의 합이 1.0인지, 각 비율이 실제 행동과 대응하는지 확인
- 기존 세션(`focus_breakdown`이 null인 행)의 리포트 화면이 그대로 열리는지 확인
- 종이 교재를 보는 자세로 세션을 진행했을 때 집중도가 낮게 나오지 않는지 확인 (배경의 두 번째 문제 해소 확인)
- 단위 테스트: 판정 우선순위, 연속 2회 규칙, breakdown 집계, blendshape 부재 시 폴백
- `npm run build` 컴파일 성공 확인
