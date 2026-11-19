const { test, expect } = require('@playwright/test');
const { mockApi } = require('./fixtures');

// 전역 안전망. 어느 것도 없으면 사용자는 빈 화면만 본다.

test.describe('404', () => {
  test.beforeEach(async ({ context }) => {
    await mockApi(context, { signedIn: false });
  });

  test('없는 주소는 빈 화면이 아니라 안내를 보여준다', async ({ page }) => {
    await page.goto('/이런-주소는-없다');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('없는 주소입니다')).toBeVisible();
  });

  test('홈으로 버튼이 실제로 홈으로 보낸다', async ({ page }) => {
    await page.goto('/no-such-page');
    await page.getByRole('button', { name: '홈으로' }).click();
    await page.waitForURL((url) => new URL(url).pathname === '/');
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('오타 주소에서도 가로로 넘치지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/typo');
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
