// tokens.css가 정의하지 않은 CSS 변수를 화면이 참조하면 브라우저는 오류 없이
// 그 선언을 통째로 버린다. 색이 빠진 자리는 부모 색으로 조용히 그려져서
// 눈으로 잡기 어렵다. 토큰 이름을 바꿀 때 소비처를 놓치는 것을 막는 가드다.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const read = (file) => fs.readFileSync(file, 'utf8');

const files = walk(SRC);
const cssFiles = files.filter((f) => f.endsWith('.css'));
const jsFiles = files.filter((f) => f.endsWith('.js'));

// 정의 경로는 셋이다: CSS 선언, JS 인라인 스타일 객체, setProperty 호출.
// useRevealOnScroll이 --reveal-index를 setProperty로만 넣으므로 셋 다 봐야 한다.
const defined = new Set();
for (const file of cssFiles) {
  for (const m of read(file).matchAll(/(--[\w-]+)\s*:/g)) {
    defined.add(m[1]);
  }
}
for (const file of jsFiles) {
  const src = read(file);
  for (const m of src.matchAll(/['"](--[\w-]+)['"]\s*:/g)) {
    defined.add(m[1]);
  }
  for (const m of src.matchAll(/setProperty\(\s*['"](--[\w-]+)['"]/g)) {
    defined.add(m[1]);
  }
}

describe('CSS 커스텀 프로퍼티', () => {
  test('CSS가 참조하는 토큰이 모두 어딘가에 정의돼 있다', () => {
    const dangling = [];
    for (const file of cssFiles) {
      for (const m of read(file).matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!defined.has(m[1])) {
          dangling.push(`${path.relative(SRC, file)} → ${m[1]}`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  test('인쇄에서 HUD 레이어가 전부 무력화된다', () => {
    const indexCss = read(path.join(SRC, 'index.css'));
    const printBlock = indexCss.slice(indexCss.indexOf('@media print'));

    // 노치·글로우·격자 토큰은 tokens.css 쪽으로 옮겨졌다 (TS-018) —
    // index.css에는 :root 토큰 외의 인쇄 규칙만 남는다.
    expect(printBlock).toMatch(/background-image:\s*none/);
    expect(printBlock).toMatch(/\.hud-brackets::before/);
  });

  test('tokens.css의 인쇄 :root가 기본 :root 뒤에 와서 소스 순서로 이긴다', () => {
    // index.js가 index.css를, App.js가 tokens.css를 나중에 import한다.
    // 같은 :root 선택자는 @media 유무와 무관하게 소스 순서로 결정되므로,
    // tokens.css 안에서도 인쇄 오버라이드가 기본 선언보다 뒤에 있어야 한다.
    // 이 블록이 다시 파일 위쪽으로 옮겨지면 이 테스트가 실패해야 한다.
    const tokensCss = read(path.join(SRC, 'styles', 'tokens.css'));
    const printBlockStart = tokensCss.indexOf('@media print');
    expect(printBlockStart).toBeGreaterThan(-1);

    const baseNotchIndex = tokensCss.indexOf('--notch-path:');
    const printNotchIndex = tokensCss.indexOf(
      '--notch-path: none',
      printBlockStart
    );
    expect(printNotchIndex).toBeGreaterThan(baseNotchIndex);

    const baseGlowIndex = tokensCss.indexOf('--glow-metric:');
    const printGlowIndex = tokensCss.indexOf(
      '--glow-metric: none',
      printBlockStart
    );
    expect(printGlowIndex).toBeGreaterThan(baseGlowIndex);

    const baseGridIndex = tokensCss.indexOf('--color-grid:');
    const printGridIndex = tokensCss.indexOf(
      '--color-grid: transparent',
      printBlockStart
    );
    expect(printGridIndex).toBeGreaterThan(baseGridIndex);
  });
});
