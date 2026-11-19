// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// CRA는 빌드 시점에 .env를 번들에 박는다. e2e는 그 박힌 값과 같은 값을 알아야
// 가짜 세션을 올바른 localStorage 키(sb-<project-ref>-auth-token)에 넣을 수 있다.
// 그래서 빌드가 쓴 .env를 여기서도 같은 방식으로 읽는다.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const PORT = process.env.E2E_PORT || 5179;

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 측정 화면은 웹캠 없이는 시작조차 못 한다. 가짜 장치를 물려
        // 권한 대화상자 없이 getUserMedia가 성공하게 한다.
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
        },
        permissions: ['camera'],
      },
    },
  ],
  webServer: {
    command: 'node e2e/serve.mjs',
    url: `http://localhost:${PORT}`,
    // 항상 새로 띄운다. 기본값(!process.env.CI)은 로컬에서 이미 떠 있는 서버에
    // 붙는데, 그 서버가 지금 코드로 돈다는 보장이 없다. 실제로 서버 파일에
    // 문법 오류를 넣고도 로컬 e2e 36개가 전부 통과한 적이 있다 — 측정하느라
    // 띄워 둔 수정 전 서버에 붙어 있었다 (TS-024). CI에서만 깨졌다.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
