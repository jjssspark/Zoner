// src/lib/alertSound.js
// 알림음과 음소거 설정. 오디오 파일을 번들에 넣지 않으려고 WebAudio로 톤을 합성한다.
//
// 소리는 부가 기능이다. AudioContext 생성이나 재생이 실패해도(브라우저 미지원,
// 자동재생 정책 차단, 권한 거부) 예외를 밖으로 던지지 않는다 — 소리 때문에
// 배너까지 멈추면 알림 기능 자체가 무의미해진다.

export const ALERT_MUTED_STORAGE_KEY = 'zoner:alert-muted';

// 한 번 삑 하고 마는 소리는 UI 효과음으로 들려 알림으로 인지되지 않는다.
// 높은 음 → 낮은 음 두 번으로 끊어 쳐야 "알림"으로 읽힌다.
const TONE_BEEPS_HZ = [880, 660];
const BEEP_DURATION_SECONDS = 0.16;
const BEEP_GAP_SECONDS = 0.09;
const TONE_PEAK_GAIN = 0.3;
// 0에서 짧게 올린다. 최대 게인에서 바로 시작하면 클릭음이 섞인다.
const ATTACK_SECONDS = 0.01;

export function loadAlertMuted() {
  try {
    return window.localStorage.getItem(ALERT_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAlertMuted(muted) {
  try {
    window.localStorage.setItem(ALERT_MUTED_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // 저장 실패는 무시한다. 이번 세션 동안만 설정이 유지된다.
  }
}

export function playAlertTone(audioContext) {
  if (!audioContext) return;

  try {
    // 탭이 백그라운드로 갔다 오거나 OS가 오디오를 뺏으면 컨텍스트가 suspended로
    // 남는다. 그 상태에서는 오실레이터를 걸어도 소리가 나지 않으므로 매번 깨운다.
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const now = audioContext.currentTime;

    TONE_BEEPS_HZ.forEach((frequency, index) => {
      const startAt = now + index * (BEEP_DURATION_SECONDS + BEEP_GAP_SECONDS);
      const endAt = startAt + BEEP_DURATION_SECONDS;

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);

      // 뚝 끊기면 클릭음이 나므로 지수 감쇠로 끝낸다.
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(
        TONE_PEAK_GAIN,
        startAt + ATTACK_SECONDS
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(startAt);
      oscillator.stop(endAt);
    });
  } catch {
    // 재생 실패는 무시한다. 배너는 그대로 표시된다.
  }
}
