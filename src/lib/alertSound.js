// src/lib/alertSound.js
// 알림음과 음소거 설정. 오디오 파일을 번들에 넣지 않으려고 WebAudio로 톤을 합성한다.
//
// 소리는 부가 기능이다. AudioContext 생성이나 재생이 실패해도(브라우저 미지원,
// 자동재생 정책 차단, 권한 거부) 예외를 밖으로 던지지 않는다 — 소리 때문에
// 배너까지 멈추면 알림 기능 자체가 무의미해진다.

export const ALERT_MUTED_STORAGE_KEY = 'zoner:alert-muted';

const TONE_FREQUENCY_HZ = 660;
const TONE_DURATION_SECONDS = 0.18;
const TONE_PEAK_GAIN = 0.12;

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
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(TONE_FREQUENCY_HZ, now);

    // 뚝 끊기면 클릭음이 나므로 지수 감쇠로 끝낸다.
    gain.gain.setValueAtTime(TONE_PEAK_GAIN, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + TONE_DURATION_SECONDS);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + TONE_DURATION_SECONDS);
  } catch {
    // 재생 실패는 무시한다. 배너는 그대로 표시된다.
  }
}
