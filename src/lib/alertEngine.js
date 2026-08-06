// src/lib/alertEngine.js
// 비집중 틱을 알림 이벤트로 바꾸는 순수 상태 기계.
// UI에서 분리해 둔 이유는 두 가지다 — 발화 규칙을 단위 테스트로 고정하기 위해서,
// 그리고 react-router-dom을 import 하는 화면 파일은 이 저장소 Jest가 로드하지 못하기
// 때문이다(docs/TROUBLESHOOTING.md TS-003).

export const ALERT_CONSECUTIVE_TICKS = 3;

// 배너 문구. focused와 looking_down은 집중으로 판정되므로 대상이 아니다.
export const ALERT_MESSAGES = {
  absent: '자리를 비우셨나요?',
  head_turned: '화면에서 시선이 벗어났어요',
  looking_up: '집중이 흐트러진 것 같아요',
  eyes_closed: '졸고 계신가요? 잠깐 쉬어가세요',
};

export function createAlertEngine({
  consecutiveTicks = ALERT_CONSECUTIVE_TICKS,
  onAlert,
} = {}) {
  let unfocusedCount = 0;
  let openAlert = null;
  const alerts = [];

  const closeOpenAlert = (endedAtMs) => {
    if (!openAlert) return;
    alerts.push({
      started_at: openAlert.startedAt,
      ended_at: new Date(endedAtMs).toISOString(),
      reason: openAlert.reason,
      duration_seconds: Math.max(
        0,
        Math.round((endedAtMs - openAlert.startedAtMs) / 1000)
      ),
      offset_seconds: openAlert.offsetSeconds,
    });
    openAlert = null;
  };

  return {
    handleTick(tick) {
      if (tick.focused) {
        unfocusedCount = 0;
        closeOpenAlert(tick.timestampMs);
        return;
      }

      // 이미 열린 이탈의 연속이면 아무것도 하지 않는다. reason이 바뀌어도
      // 같은 이탈로 본다 — 자리를 비웠다 돌아오며 고개를 돌리는 것은 한 번의 이탈이고,
      // 두 건으로 세면 알림이 잦아지고 리포트도 부풀려진다.
      if (openAlert) return;

      unfocusedCount += 1;
      if (unfocusedCount < consecutiveTicks) return;

      openAlert = {
        startedAtMs: tick.timestampMs,
        startedAt: new Date(tick.timestampMs).toISOString(),
        reason: tick.reason,
        // 영상 재생 시간축(일시정지 제외)에서 이 알림이 발생한 지점.
        // 리포트에서 이 값으로 seek한다.
        offsetSeconds: Math.max(0, Math.round((tick.elapsedMs ?? 0) / 1000)),
      };

      if (onAlert) {
        onAlert({ started_at: openAlert.startedAt, reason: openAlert.reason });
      }
    },

    // 일시정지용. 사용자가 의도적으로 멈춘 시간은 비집중 구간이 아니므로
    // 열린 알림을 그 시각으로 닫고 카운트를 초기화한다.
    reset(atMs) {
      closeOpenAlert(atMs);
      unfocusedCount = 0;
    },

    finish(endedAtMs) {
      closeOpenAlert(endedAtMs);
      unfocusedCount = 0;
      return alerts.slice();
    },

    getAlerts() {
      return alerts.slice();
    },
  };
}
