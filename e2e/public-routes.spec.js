const { test, expect } = require('@playwright/test');

// 공개 라우트가 세 폭에서 가로로 넘치지 않는지 본다.
// 이 프로젝트는 브레이크포인트 대신 유동 크기(min()/max-width)로 좁은 화면을
// 다루기 때문에, "@media가 몇 개냐"가 아니라 실제 넘침 여부로 검증해야 한다.

const ROUTES = [
  { path: '/', heading: 'Focus Smarter' },
  { path: '/guide', heading: null },
  { path: '/pricing', heading: null },
  { path: '/faq', heading: null },
  { path: '/login', heading: '로그인' },
  { path: '/signup', heading: null },
];

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of ROUTES) {
      test(`${route.path} — 가로 넘침 없이 렌더된다`, async ({ page }) => {
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error)));

        await page.goto(route.path);
        await expect(page.locator('#root')).not.toBeEmpty();

        if (route.heading) {
          await expect(page.getByText(route.heading).first()).toBeVisible();
        }

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        // 1px은 서브픽셀 반올림 여유다.
        expect(scrollWidth, `${route.path}에서 가로 스크롤이 생겼다`).toBeLessThanOrEqual(clientWidth + 1);

        expect(pageErrors, `${route.path}에서 JS 에러가 났다`).toEqual([]);
      });
    }
  });
}
