# Zoner 실시간 비집중 알림 + 알림 기록 리플레이 — 설계

## 배경

[[2026-08-05-zoner-focus-detection-accuracy-design.md]]에서 틱 판정에 `reason`(6종)을 붙였지만, 판정 결과는 세션이 끝난 뒤 점수와 비율로만 드러난다. 사용자가 집중이 흐트러진 **그 순간에는 아무 신호도 받지 못하고**, 나중에 리포트를 봐도 "언제 어떤 이유로 얼마나 벗어났는지"를 알 수 없다.

이 스펙은 두 가지를 붙인다:

1. 비집중이 일정 시간 이어지면 학습 화면에서 즉시 알린다
2. 그 알림들을 세션에 저장해 리포트에서 다시 볼 수 있게 한다

### 명시적 해석 — "녹화한 거 다시 보기"

사용자 요청의 "녹화한 거 다시 볼 수 있게"는 **알림 로그 리플레이**를 뜻한다. 영상 파일은 [[2026-08-05-zoner-focus-session-controls-design.md]]에서 저장하지 않기로 정했고 이 스펙도 그 결정을 유지한다. 리포트에 나타나는 것은 "14:32 자리 비움 (1분 20초)" 형태의 **이벤트 목록**이지 영상 클립이 아니다. 영상 저장·재생은 스토리지 용량과 비용이 걸린 별개 규모의 작업으로, 필요해지면 독립 스펙으로 다룬다.

## 아키텍처

알림 판단은 UI에서 분리한다. `focusTracker`가 5초마다 내보내는 틱을 받아 알림 이벤트로 변환하는 순수 상태 기계를 새 모듈로 두고, `StartLearning.js`는 그 결과를 화면과 소리로 표현하기만 한다.

이 분리에는 실용적 이유가 하나 더 있다. TS-003 기록대로 `react-router-dom`을 import 하는 파일은 CRA 번들 Jest 리졸버가 해석하지 못해 테스트를 쓸 수 없다. 알림 발화 조건 같은 규칙은 `src/lib` 안에 두어야 단위 테스트가 가능하다.

```
focusTracker (5초 틱)
      │  { timestampMs, focused, reason }
      ▼
alertEngine (순수)  ──onAlert──▶  StartLearning: 배너 + 알림음
      │
      └─ 종료 시 alerts[] ──▶ study_sessions.alerts ──▶ Read.js: 알림 목록
```

## 알림 엔진 — `src/lib/alertEngine.js` (신규)

### 발화 규칙

연속 **3틱(15초)** 비집중에서 1회 발화한다. 물을 마시거나 잠깐 고개를 돌리는 정도는 잡지 않고 실제 이탈만 잡기 위해서다.

| 입력 | 동작 |
|---|---|
| `focused` 틱 | 연속 카운트를 0으로. 열려 있는 알림이 있으면 그 틱 시각으로 `ended_at` 확정 후 닫는다 |
| `!focused` 틱, 카운트 < 3 | 카운트 증가. 카운트가 3이 되는 **그 틱에서만** `onAlert` 1회 발화하고 알림을 연다 |
| `!focused` 틱, 알림이 열려 있음 | 아무것도 하지 않는다 — `reason`이 바뀌어도 같은 이탈의 연속으로 본다 |
| 세션 종료 | 열려 있는 알림을 종료 시각으로 닫는다 |

`reason`이 바뀌어도 재발화하지 않는 이유: 자리를 비웠다가(`absent`) 돌아오면서 고개를 돌린 상태(`head_turned`)를 거치는 것은 한 번의 이탈이다. 이를 두 건으로 세면 알림이 잦아지고 리포트도 부풀려진다. 저장되는 대표 `reason`은 **발화 시점의 값**이다.

### 이벤트 모양

시점이 아니라 **구간**으로 기록한다. "언제 벗어났나"보다 "얼마나 오래 벗어났나"가 리포트에서 쓸모 있기 때문이다.

```js
{
  started_at: '2026-08-05T14:32:10.000Z',  // 발화 시점 (연속 3틱째)
  ended_at:   '2026-08-05T14:33:30.000Z',  // 집중 복귀 시점 또는 세션 종료 시각
  reason:     'absent',                     // 발화 시점의 REASON 값
  duration_seconds: 80,
}
```

`started_at`은 비집중이 시작된 시점이 아니라 발화 시점이다. 사용자가 화면에서 본 알림과 리포트의 기록이 일치해야 혼란이 없다.

### 공개 인터페이스

```js
export const ALERT_CONSECUTIVE_TICKS = 3;

export function createAlertEngine({ consecutiveTicks = ALERT_CONSECUTIVE_TICKS, onAlert })
// 반환: { handleTick(tick), finish(endedAtMs), getAlerts() }
```

`onAlert(alert)`는 발화 시점에 호출되어 화면 표시를 트리거한다. `getAlerts()`는 닫힌 이벤트 배열을 반환하며 저장에 쓴다. `finish()`는 열린 알림을 닫고 최종 배열을 확정한다.

## 화면 — `StartLearning.js` / `StartLearning.css`

### 알림 배너

웹캠 영상 위에 겹쳐 표시한다. 원인별 문구:

| `reason` | 문구 |
|---|---|
| `absent` | 자리를 비우셨나요? |
| `head_turned` | 화면에서 시선이 벗어났어요 |
| `looking_up` | 집중이 흐트러진 것 같아요 |
| `eyes_closed` | 졸고 계신가요? 잠깐 쉬어가세요 |

`focused`와 `looking_down`은 집중으로 판정되므로 배너 대상이 아니다.

배너는 다시 집중 상태로 돌아오면 사라진다. 자동 타이머로 닫지 않는다 — 비집중이 계속되는 동안에는 계속 보이는 것이 목적에 맞는다.

**접근성**: 배너에 `role="alert"`를 준다. 색만으로 구분하지 않도록 아이콘과 문구를 함께 둔다. 등장 애니메이션은 `transform`/`opacity`만 사용하고, `prefers-reduced-motion` 대응은 `tokens.css`의 전역 블록이 이미 처리한다.

### 알림음

WebAudio API(`AudioContext` + `OscillatorNode`)로 짧은 톤을 합성한다. 오디오 파일을 번들에 넣지 않아 용량이 늘지 않는다.

음소거 토글 버튼을 학습 화면에 두고 상태를 `localStorage`에 저장한다. 도서관 등에서 소리를 끌 수 있어야 한다.

브라우저 자동재생 정책상 `AudioContext`는 사용자 제스처 이후에만 소리를 낼 수 있다. "시작" 버튼 클릭이 그 제스처이므로, `handleStart`에서 `AudioContext`를 생성한다.

### 웹캠 확대

현재 `.start-learning__main`이 `max-width: 560px`이고 영상은 `aspect-ratio: 4 / 3`이다. 웹캠 소스가 4:3이므로 비율은 유지하고 폭만 키운다.

```css
.start-learning__main   { max-width: clamp(560px, 72vw, 880px); }
.start-learning__video-wrap { max-height: 60vh; }
```

`max-height` 가드가 없으면 880px 폭에서 세로가 660px이 되어 노트북 화면에서 컨트롤 버튼이 접힌다.

## 데이터 모델

```sql
alter table study_sessions add column alerts jsonb;
```

세션 종료 시 `alerts: alertEngineRef.current.getAlerts()`를 함께 insert 한다. 기존 세션은 `null`로 남는다.

`active_study_sessions` 뷰가 컬럼을 고정 나열하고 있으므로(`20260805110000_pin_active_study_sessions_columns.sql`) 뷰도 함께 갱신해야 한다. 마이그레이션 작성 시 현재 뷰 정의를 먼저 확인한다.

## 리포트 — `Read.js`

`select`에 `alerts`, `focus_breakdown`을 추가하고 두 섹션을 붙인다.

**원인별 비율**: `focus_breakdown`의 6개 값을 가로 막대로. 이미 저장되고 있으나 화면에 나온 적이 없는 데이터다.

**알림 목록**: 시각 / 원인 배지 / 지속 시간. 시각순 정렬.

두 섹션 모두 해당 값이 `null`이면 렌더링하지 않는다. 이 컬럼들이 생기기 전 세션이 깨지지 않아야 한다.

## 에러 처리

- `AudioContext` 생성 실패(브라우저 미지원, 정책 차단): 소리만 조용히 건너뛰고 배너는 정상 표시한다. 알림 기능 전체가 멈추면 안 된다.
- `alerts` 저장 실패: 기존 `handleStop`의 try/catch가 `SAVE_ERROR`로 처리하므로 별도 경로를 만들지 않는다.

## 범위 밖

- 브라우저 알림(Notification API) — 권한 프롬프트 비용 대비 이득이 불명확하다. 다른 탭을 보고 있다는 것 자체는 웹캠으로 판정되지 않으므로 알림이 실제로 도움이 되는 상황이 제한적이다
- 영상 파일 저장·재생
- 알림 구간을 시간대별 막대그래프 위에 겹쳐 그리기 — 목록만으로 충분한지 먼저 확인한다
- AI 피드백 — 이 스펙이 만드는 `alerts`를 입력으로 쓰는 후속 서브프로젝트

## 선행 조건

[[2026-08-05-zoner-design-system-design.md]]의 디자인 시스템 개편이 먼저 들어간다. 알림 배너와 원인 배지는 그 스펙의 `--color-reason-*` 토큰과 `ReasonBadge` 컴포넌트를 사용하며, 순서를 뒤집으면 같은 화면을 두 번 만들게 된다.

## 검증

- 알림 엔진 단위 테스트: 2틱 비집중은 발화하지 않고 3틱에서 1회만 발화한다 / 알림이 열린 동안 `reason`이 바뀌어도 재발화하지 않는다 / `focused` 복귀 시 `ended_at`과 `duration_seconds`가 맞게 채워진다 / `finish()`가 열린 알림을 닫는다 / 비집중이 전혀 없으면 빈 배열
- 브라우저: 15초 이상 자리를 비우면 배너가 뜨고 소리가 난다. 돌아오면 사라진다
- 음소거 토글 후 새로고침해도 음소거가 유지된다
- 세션 종료 후 Supabase에서 `alerts` 배열이 화면에서 본 알림과 개수·원인이 일치하는지 확인
- `alerts`가 `null`인 기존 세션의 리포트가 정상 표시되는지 확인
- `npm run build` 컴파일 성공
