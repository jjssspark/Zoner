const { test, expect } = require('@playwright/test');
const { signIn, mockApi } = require('./fixtures');

// 인증이 필요한 화면들. 실제 Supabase 프로젝트 없이, 가짜 세션을 localStorage에
// 넣고 REST를 가로채 렌더한다.

const PROTECTED = ['/mypage', '/ai-chat', '/trash', '/start-learning'];

test.describe('로그인 상태', () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  for (const path of PROTECTED) {
    test(`${path} — 로그인 화면으로 튕기지 않고 렌더된다`, async ({ page }) => {
      await page.goto(path);
      // 측정 화면은 카메라와 모델 로딩이 끼어 있어 조금 더 기다린다.
      await page.waitForTimeout(path === '/start-learning' ? 2500 : 500);

      expect(page.url(), `${path}에서 로그인으로 튕겼다`).toContain(path);
      await expect(page.locator('#root')).not.toBeEmpty();

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
    });
  }

  // 타임아웃이 긴 이유: 이 화면은 MediaPipe WASM과 모델 가중치를 외부 CDN에서
  // 받는다(README의 '알려진 한계'). CI는 매번 캐시가 비어 있어 첫 로드가
  // 수십 초 걸릴 수 있다. 실제로 빌드 직후 15초 타임아웃으로 한 번 깨졌다.
  test('측정 화면에 세션 컨트롤이 보인다', async ({ page }) => {
    await page.goto('/start-learning');
    await expect(page.getByRole('button', { name: '시작' })).toBeVisible({ timeout: 60_000 });
  });
});

test.describe('비로그인 상태', () => {
  test.beforeEach(async ({ context }) => {
    await mockApi(context, { signedIn: false });
  });

  for (const path of PROTECTED) {
    test(`${path} — 로그인 화면으로 보낸다`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL('**/login', { timeout: 15_000 });
      expect(page.url()).toContain('/login');
    });
  }
});
