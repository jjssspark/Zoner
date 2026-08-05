# Zoner 학습 세션 — 시작/중지/재개/종료 제어 — 설계

## 배경

[[2026-08-04-zoner-focus-session-pipeline-design.md]]에서 구현한 `/start-learning`은 페이지 진입 즉시 캠 권한 요청 → AI 모델 로딩 → 분석 시작까지 자동으로 진행되고, 종료 방법은 "종료" 버튼 하나뿐이다. 사용자가 중간에 자리를 비우거나 쉬어야 할 때 세션을 일시 중단할 방법이 없어, 쉬는 시간까지 "비집중"으로 집계되거나 아예 세션을 종료해버려야 하는 문제가 있다.

이번 스펙은 세션 제어를 사용자가 명시적으로 조작하는 상태 머신으로 바꾼다: **시작 → (중지 ⇄ 재개, 반복 가능) → 종료**. 실제 영상 파일 저장은 이번에도 범위 밖이다 — 기존과 동일하게 라이브 분석만 하고 틱 집계 결과만 저장한다.

## 아키텍처

기존 `focusTracker.js`의 순수 함수(틱 판정, 세션 집계)는 변경 없이 재사용한다. 변경은 `StartLearning.js`의 상태 관리에 집중된다:

- 캠 스트림과 AI 모델은 **한 번만** 획득/로딩하고 페이지를 벗어날 때까지 계속 유지한다. "중지"는 스트림을 끊지 않고 분석 인터벌(틱 타이머)과 경과 시간 타이머만 멈춘다 — "재개"가 카메라 재권한 요청 없이 즉시 이어지도록 하기 위함이다.
- "중지" 상태에서도 웹캠 미리보기는 계속 표시된다. 집중/비집중 상태 점만 숨긴다(측정 중이 아니므로).
- 화면 진입 시 자동으로 분석을 시작하지 않는다 — 캠 미리보기 + "시작" 버튼을 먼저 보여주고, AI 모델은 백그라운드에서 로딩해 "시작" 클릭 시 대기 없이 바로 분석이 시작되게 한다. 모델이 아직 로딩 중이면 "시작" 버튼은 비활성화 상태로 "모델 준비 중..."을 표시한다.

## 상태 머신

```
REQUESTING_CAMERA
  → CAMERA_DENIED (에러, 재시도 가능)
  → PREVIEW (캠 미리보기 표시, AI 모델 백그라운드 로딩 시작)
       → MODEL_ERROR (에러, 재시도 가능)
       → (모델 로딩 완료 → PREVIEW 상태 유지, "시작" 버튼 활성화)
            → RUNNING ("시작" 클릭 → 틱 타이머 + 경과 시간 타이머 시작)
                 ⇄ PAUSED ("중지" ↔ "재개", 무제한 반복)
                 → SAVING (RUNNING/PAUSED 어느 쪽에서든 "종료" 클릭)
                      → SAVE_ERROR (에러, 데이터 유지한 채 재시도 가능)
                      → /read?session=<id> 이동 (성공)
```

새 상태: `PREVIEW`, `PAUSED`. 기존 `LOADING_MODEL`은 별도 화면 없이 `PREVIEW` 내부의 `isModelReady` 플래그로 대체한다(미리보기는 이미 보이는 상태에서 모델만 백그라운드로 준비되므로 전용 로딩 화면이 필요 없음).

## 버튼 및 화면 요소

| 상태 | 화면 요소 |
|---|---|
| `PREVIEW`, 모델 준비 중 | 캠 미리보기, `시작` 버튼 비활성화 + "모델 준비 중..." |
| `PREVIEW`, 모델 준비됨 | 캠 미리보기, `시작` 버튼 활성화 |
| `RUNNING` | 캠 미리보기, 집중/비집중 상태 점, 경과 시간, `중지` + `종료` 버튼 |
| `PAUSED` | 캠 미리보기(상태 점 숨김), "일시정지됨" 텍스트, 경과 시간(멈춘 값 유지), `재개` + `종료` 버튼 |
| `SAVING` | 버튼 비활성화, "저장 중..." |

## 데이터 모델 변경

스키마(`study_sessions`)는 변경 없음. **`duration_seconds` 계산 방식만 변경**한다.

- 기존: `Math.round((endedAt - startedAt) / 1000)` — 벽시계 기준이라 일시정지 시간까지 포함됨
- 변경: 화면에 표시되는 `elapsedSeconds` 카운터(= `RUNNING` 상태일 때만 1초마다 증가, `PAUSED`에선 정지)를 그대로 `duration_seconds`로 저장 — **순수 활동 시간만 기록**

`focus_score`, `timeline`은 변경 없음 — 둘 다 tick 배열 기반이고, 일시정지 구간엔 애초에 tick이 쌓이지 않으므로(인터벌이 멈춰 있음) 추가 처리 없이 자연스럽게 공백으로 남는다. `aggregateSession()`(`focusTracker.js`)의 시그니처는 유지하되, 호출부(`StartLearning.js`)에서 계산한 `duration_seconds`를 반환값에 덮어써서 insert한다. `aggregateSession` 내부의 duration 계산 로직 자체는 다른 곳에서 쓰이지 않으므로 그대로 둬도 무방하나, 혼동을 피하기 위해 함수가 반환하는 `durationSeconds`는 폐기하고 호출부의 값을 사용한다.

## 프론트엔드 변경

### 수정 파일

**`src/components/StartLearning.js`**
- `STATUS`에 `PREVIEW`, `PAUSED` 추가, `LOADING_MODEL` 제거
- `isModelReady` state 추가 (모델 로딩 완료 여부, `PREVIEW` 상태에서만 의미 있음)
- 마운트 effect: 캠 권한 요청 → 성공 시 `PREVIEW`로 전환 + 백그라운드로 `loadFaceLandmarker()` 호출 (완료 시 `isModelReady=true`, 실패 시 `MODEL_ERROR`) — AI 모델과 캠 스트림 준비는 여기서 끝, 틱 타이머는 시작하지 않음
- `faceLandmarker` 인스턴스를 `faceLandmarkerRef`에 저장 (기존엔 effect 지역 변수였음 — `handleStart`/`handleResume`에서 재사용해야 하므로 ref로 승격)
- `elapsedTimerIdRef` 추가 (기존엔 effect 지역 변수 `elapsedTimerId` — `handlePause`/`handleResume`에서 clear/재생성해야 하므로 ref로 승격)
- `handleStart`: `RUNNING`으로 전환, `startedAtRef.current`(최초 시작 시각, DB `started_at`용) 기록, 경과 시간 인터벌 시작, `trackerRef.current = createFocusTracker(...)` 생성
- `handlePause`: `trackerRef.current.stop()`, `window.clearInterval(elapsedTimerIdRef.current)`, `PAUSED`로 전환 — 캠 스트림은 건드리지 않음
- `handleResume`: `RUNNING`으로 복귀, 경과 시간 인터벌 재시작, `trackerRef.current = createFocusTracker(...)`로 새 틱 타이머 재생성(같은 `videoRef.current`, `faceLandmarkerRef.current` 재사용 — 재권한 요청 없음)
- `handleStop`(기존 종료 로직 유지, 호출 시점만 RUNNING/PAUSED 양쪽에서 가능하도록 확장): 진행 중이면 `trackerRef.current.stop()` + 인터벌 정리 후 `SAVING`, `aggregateSession()` 결과에서 `durationSeconds`를 `elapsedSeconds` state 값으로 덮어써 insert
- 언마운트 cleanup: 기존과 동일하게 트래커/인터벌/스트림 정리 (상태와 무관하게 항상 정리되어야 함)

**`src/components/StartLearning.css`**
- `.start-learning__controls`(중지+종료, 재개+종료를 담는 flex 컨테이너) 추가 — 버튼 2개 나란히 배치, `gap: var(--space-3)`
- `.start-learning__pause`, `.start-learning__resume` — `.start-learning__stop`과 동일한 톤이되 danger가 아닌 accent 색상 사용(중지/재개는 파괴적 동작이 아니므로 `--color-danger` 대신 `--color-accent` 배경)
- 기존 `.start-learning__stop`은 "종료" 버튼에 계속 사용(danger 색상 유지 — 세션을 끝내는 동작이므로)

### 신규/삭제 파일 없음

이번 스펙은 기존 두 파일(`StartLearning.js`, `StartLearning.css`)만 수정한다. `focusTracker.js`, DB 스키마, 다른 라우트는 변경하지 않는다.

## 에러 처리

기존과 동일 (변경 없음):
- 캠 권한 거부, 모델 로드 실패: 인라인 에러 메시지 + 재시도 버튼
- 저장 실패: 집계 데이터 유지한 채 재시도 유도

추가:
- `중지` 상태에서 브라우저가 알림 없이 탭을 닫거나 새로고침하면 기존과 동일하게 세션 데이터가 유실된다(자동 저장/복구는 여전히 범위 밖). 새 상태(`PAUSED`)가 이 위험을 늘리지 않는다 — RUNNING 상태에서도 이미 동일했다.

## 범위 밖 (명시적 제외)

- 실제 웹캠 영상 파일 저장/재생 — 이번에도 라이브 분석 + 집계 데이터만 저장
- 브라우저 종료/새로고침 시 세션 자동 저장·복구
- 일시정지 횟수·총 일시정지 시간을 별도로 기록/표시 (리포트 화면엔 순수 활동 시간만 노출)
- 고정 타이머/뽀모도로 자동 중지

## 검증

- "시작" 전 캠 미리보기만 뜨고 분석/타이머가 동작하지 않는지 확인
- 모델 로딩 완료 전엔 "시작" 버튼이 비활성화 상태인지 확인
- "시작" → 몇 초 후 "중지" → 몇 초 대기 → "재개" → "종료" 흐름에서, 저장된 `duration_seconds`가 중지 구간을 제외한 순수 활동 시간과 일치하는지 Supabase 대시보드에서 확인
- "중지" 상태에서 캠 미리보기가 계속 보이는지(스트림이 끊기지 않는지) 확인
- 중지↔재개를 3회 이상 반복해도 정상 동작하는지 확인
- `npm run build` 컴파일 성공 확인
