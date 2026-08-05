# Zoner 디자인 개편 — 계측 장비 시스템 — 설계

## 배경

현재 UI는 Figma export를 정리한 이후 기능 위주로 쌓여왔고, 시각적으로는 다음 문제가 있다.

1. **위계가 없다.** Mypage의 최근 기록·빠른 실행·추천 서비스가 전부 같은 반경, 같은 간격, 같은 크기의 카드다. 무엇이 중요한지 화면이 말하지 않는다.
2. **데이터가 죽어 있다.** 최근 기록 카드에서 `2026. 8. 5. · 0%`와 `· 100%`가 시각적으로 완전히 동일하다. 집중도 측정이 제품의 핵심인데 점수가 그냥 텍스트다.
3. **깊이와 모션이 없다.** 전부 평면이고 상태 변화에 대한 시각적 반응이 없다.
4. **로딩이 빈 화면이다.** Mypage는 데이터를 불러오는 동안 아무것도 그리지 않아(`isLoading`일 때 빈 div 반환) 고장난 것처럼 보인다. 실제로 이 화면을 처음 열었을 때 5초가량 완전한 빈 화면이 유지되는 것을 확인했다.
5. **색이 장식용이다.** 시안이 강조색으로 곳곳에 쓰이지만 집중 상태를 의미하지 않는다.

`.claude/standards/design-quality.md`가 금지하는 "균일한 간격의 기본 카드 그리드", "평면 레이아웃", "전 컴포넌트 동일 반경·간격"에 정확히 해당한다.

## 방향: 계측 장비

앱을 **측정 기계**처럼 다룬다. Zoner는 사용자를 실시간으로 관측하고 수치로 환산하는 제품이므로, 인터페이스도 그 성격을 그대로 드러내는 것이 제품과 일치한다.

세 가지 원칙으로 구체화한다.

- **숫자가 주인공이다.** 집중도 수치는 화면에서 가장 큰 요소이고, 나머지는 그것을 보조한다. 크기 대비로 위계를 만든다.
- **색이 상태를 말한다.** 집중 수준과 판정 원인을 색으로 인코딩한다. 예뻐서 쓰는 색은 없앤다.
- **살아 있음을 보인다.** 관측 중임이 드러나도록 미세한 모션을 쓴다. 장식적 애니메이션이 아니라 "지금 보고 있다"는 상태 표현이다.

### 시각 레퍼런스 성격

계기판·오실로스코프·모니터링 대시보드 계열. 데이터 텍스트는 모노스페이스로 자릿수를 고정하고, 추이는 스파크라인으로, 상태는 링·글로우로 표현한다.

## 범위

Read(리포트)와 StartLearning(학습 중)은 **이번 범위에서 제외**한다. 두 화면은 각각 서브프로젝트 3(집중도 원인 breakdown 표시, 사후 조정)과 4(실시간 피드백)에서 기능이 추가되므로, 지금 디자인만 새로 입히면 곧 다시 뜯게 된다. 새 디자인 시스템 위에서 기능과 함께 한 번에 만든다.

| 대상 | 이번 스펙 | 비고 |
|---|---|---|
| `src/styles/tokens.css` | ✅ 확장 | 전 화면 공통 기반 |
| 공용 컴포넌트 (스파크라인, 스코어 링, 스켈레톤, 상태 배지) | ✅ 신규 | 3·4번에서 재사용 |
| `Mypage` | ✅ 개편 | 기능 변경 예정 없음 |
| `Save`, `Trash`, `Trashread` | ✅ 개편 | 기능 변경 예정 없음 |
| `Home` | ✅ 개편 | 첫인상 |
| `Read` | ❌ | 서브프로젝트 3 |
| `StartLearning` | ❌ | 서브프로젝트 4 |
| `AiChat`, `Login`, `SignUp`, `UserGuide`, `Pricing`, `FAQ` | ❌ | 후속 |

## 디자인 토큰 확장

기존 토큰(`src/styles/tokens.css`)은 유지하고 추가만 한다 — 전역 import되어 모든 화면이 소비하므로 기존 값 변경은 파급이 크다.

### 집중 상태 색 (신규)

집중도 구간과 판정 원인을 의미로 매핑한다.

```css
:root {
  /* primitive — 상태 스케일 */
  --lime-400:   oklch(80% 0.16 145);
  --amber-400:  oklch(80% 0.14 80);
  --orange-500: oklch(70% 0.17 50);

  /* 의미 — 집중 수준 (점수 구간) */
  --color-focus-high:   var(--lime-400);   /* 80% 이상 */
  --color-focus-mid:    var(--cyan-400);   /* 50~79% */
  --color-focus-low:    var(--amber-400);  /* 30~49% */
  --color-focus-poor:   var(--red-500);    /* 30% 미만 */

  /* 의미 — 판정 원인 (서브프로젝트 1의 reason과 1:1) */
  --color-reason-focused:      var(--cyan-400);
  --color-reason-looking-down: var(--cyan-500);
  --color-reason-head-turned:  var(--amber-400);
  --color-reason-looking-up:   var(--orange-500);
  --color-reason-eyes-closed:  var(--red-500);
  --color-reason-absent:       var(--navy-550);
}
```

원인 색은 서브프로젝트 1이 정의한 `reason` 값과 이름을 1:1로 맞춘다. 3번에서 breakdown을 그릴 때 매핑 테이블 없이 바로 쓸 수 있게 하기 위함이다. `looking_down`이 `focused`와 인접한 색인 것은 의도적이다 — 둘 다 집중으로 집계되므로 시각적으로도 같은 계열이어야 한다.

### 데이터 타이포그래피 (신규)

```css
:root {
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;

  --text-metric-sm: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
  --text-metric:    clamp(2.5rem, 1.8rem + 3.5vw, 4rem);
  --text-metric-lg: clamp(4rem, 2.5rem + 7vw, 8rem);

  --tracking-tight: -0.03em;
  --tracking-data:   0.02em;
}
```

수치는 모노스페이스로 렌더링해 자릿수가 바뀌어도 폭이 흔들리지 않게 한다(실시간으로 변하는 값에서 특히 중요). 폰트 패밀리는 본문 Pretendard + 데이터 JetBrains Mono **2종**을 넘지 않는다.

`--font-display`가 현재 `--font-sans`와 동일한 값이라 실질적으로 무의미하다. 이번에 제거하지 않고 그대로 둔다 — 여러 화면이 참조 중이라 교체 범위가 이번 스펙보다 넓다. 후속 정리 대상으로 남긴다.

### 모션 (확장)

```css
:root {
  --duration-slow: 600ms;
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

기존 `--duration-fast`, `--duration-normal`, `--ease-out-expo`는 유지한다. `prefers-reduced-motion` 블록은 이미 존재하며 신규 애니메이션도 자동으로 커버된다 — 추가 대응 불필요.

## 공용 컴포넌트 (신규)

`src/components/ui/` 아래에 둔다. 도메인 용어를 모르는 순수 프레젠테이션 컴포넌트이며, props로만 데이터를 받는다(`.claude/standards/project-structure.md`의 `components/ui/` 규약).

### `ScoreRing`

집중도 점수를 원형 게이지로 표현한다.

- props: `value` (0~100), `size` (`sm` | `md` | `lg`), `label`
- SVG `<circle>`의 `stroke-dasharray`로 진행률을 그린다. 차트 라이브러리를 추가하지 않는다
- 점수 구간에 따라 `--color-focus-*`를 적용한다
- 중앙에 수치를 모노스페이스로 표시
- 마운트 시 0에서 목표값까지 `--duration-slow`로 채워진다 (`stroke-dashoffset`만 애니메이션)
- 접근성: `role="img"` + `aria-label`로 수치를 텍스트로도 전달

### `Sparkline`

시간대별 집중도 추이를 작게 표현한다.

- props: `data` (숫자 배열, 0~1), `width`, `height`
- SVG `<polyline>` 하나. 축·눈금·범례 없음 — 목록에서 추이만 읽히면 된다
- 접근성: `role="img"` + `aria-label`에 요약 문장(예: "12분간 집중도 추이, 평균 78%")

### `Skeleton`

로딩 중 레이아웃 자리를 미리 잡는다. 위 배경의 4번 문제를 해결한다.

- props: `variant` (`text` | `card` | `metric`), `count`
- 실제 콘텐츠와 같은 높이·간격을 차지해 로드 완료 시 레이아웃이 튀지 않게 한다
- 은은한 shimmer는 `opacity`만 애니메이션한다
- 접근성: 컨테이너에 `aria-busy="true"`, 스크린리더에는 "불러오는 중"을 한 번만 전달

### `ReasonBadge`

판정 원인을 색 + 라벨로 표시한다. 이번 범위에서는 정의만 하고, 실제 사용은 3번(리포트)이다.

- props: `reason` (서브프로젝트 1의 reason 문자열), `ratio`
- **색만으로 정보를 전달하지 않는다** — 색과 함께 항상 한글 라벨을 표시한다(`.claude/standards/accessibility.md`)

## 화면별 변경

### `Mypage`

현재 균일 카드 3단(최근 기록 / 빠른 실행 / 추천 서비스)을 위계 있는 구성으로 바꾼다.

- **최상단에 오늘의 집중 요약**을 둔다. `ScoreRing`(`lg`)이 화면에서 가장 큰 요소가 되고, 그 옆에 학습 시간·세션 수를 작게 배치한다. 데이터가 없으면 "첫 세션을 시작해보세요" 빈 상태를 같은 자리에 둔다
- **최근 기록 카드에 `Sparkline`을 넣는다.** 지금은 점수가 텍스트뿐이라 0%와 100%가 구분되지 않는다. 점수 텍스트에 `--color-focus-*`를 적용하고 추이 스파크라인을 함께 그린다
- **간격으로 위계를 만든다.** 관련된 요소는 붙이고(`--space-2`~`--space-4`), 섹션 사이는 크게 띄운다(`--space-12`). 지금처럼 모든 곳에 같은 패딩을 주지 않는다
- **빠른 실행은 축소한다.** 4개 카드가 최근 기록과 같은 비중을 차지할 이유가 없다. 아이콘 + 라벨의 작은 행으로 줄인다
- **로딩 시 `Skeleton`**을 렌더한다 (현재는 빈 div)
- 상단 AI 상태 카드는 링에 미세한 호흡 애니메이션(`opacity`/`transform`)을 넣어 대기 중임을 표현한다

### `Save` (학습 기록 목록)

- 각 행에 `Sparkline` + 점수 색상 적용
- 점수는 모노스페이스로 자릿수를 고정해 세로로 정렬되게 한다
- 로딩 시 `Skeleton` (`variant="card"`, `count={3}`)
- 행 hover 시 `transform: translateY(-2px)` + 테두리 강조 (기존 패턴 유지·강화)

### `Trash`, `Trashread`

- `Save`와 같은 시각 언어를 적용하되, 삭제된 항목임이 드러나도록 채도를 낮춘다(`opacity` 또는 muted 토큰)
- `Trash`의 "N일 후 자동 삭제"는 남은 일수가 적을수록 `--color-focus-low` → `--color-focus-poor`로 색이 변해 긴급도를 표현한다
- 로딩 시 `Skeleton`

### `Home`

- 히어로의 영문 대형 타이포는 유지하되, 아래 스톡 이미지를 **제품 실제 화면 미리보기**로 교체한다. 계측 장비 성격이 첫 화면에서 드러나야 한다(`ScoreRing` + `Sparkline`을 더미 데이터로 정적 렌더)
- 하단 3개 균일 카드를 크기가 다른 구성으로 바꾼다 — 집중도 분석이 가장 크고, 나머지는 작게
- 스크롤 진입 시 요소가 나타나는 모션을 넣는다. `IntersectionObserver` + `transform`/`opacity`만 사용하고 스크롤 핸들러는 쓰지 않는다

## 반응형

브레이크포인트를 명시적으로 검증한다: **320 / 375 / 768 / 1024 / 1440**.

- 레이아웃은 CSS Grid + `minmax()`/`auto-fit` 위주로 구성해 미디어쿼리 개수를 최소화한다
- 수치 타이포는 `clamp()`로 유동 스케일을 쓴다 (위 토큰)
- **가로 스크롤이 발생하지 않아야 한다.** 넓은 콘텐츠(스파크라인, 목록 행)는 자체 컨테이너 안에서만 스크롤한다
- 터치 대상 최소 44×44 CSS px (`.claude/standards/accessibility.md` 권장값)
- Mypage의 최근 기록은 좁은 화면에서 3열 → 1열로 떨어뜨린다

## 접근성

- 신규 색은 전부 대비비를 확인한다: 본문 4.5:1, 큰 텍스트 3:1, UI 경계·아이콘 3:1
- **색만으로 정보를 전달하지 않는다.** 집중 수준·판정 원인은 색과 함께 반드시 수치나 라벨을 동반한다
- `ScoreRing`, `Sparkline`은 `role="img"` + `aria-label`로 값을 텍스트로 제공한다
- `Skeleton` 컨테이너에 `aria-busy`를 둔다
- 모든 인터랙티브 요소에 `:focus-visible` 스타일을 유지한다 — 신규 컴포넌트도 예외 없다
- 신규 애니메이션은 `transform`/`opacity`/`stroke-dashoffset`만 사용한다. 기존 `prefers-reduced-motion` 블록이 자동으로 무력화한다

## 성능

- 차트 라이브러리를 추가하지 않는다. `ScoreRing`·`Sparkline` 모두 SVG를 직접 그린다 — `.claude/standards`의 번들 예산(랜딩 JS 150kb)을 지키기 위함이다
- 신규 폰트는 JetBrains Mono 하나이며, 데이터 표시에 쓰는 **한 가지 굵기만** 로드한다. `font-display: swap`
- 애니메이션은 컴포지터 친화 속성만 사용한다. `will-change`는 실제 애니메이션 구간에만 좁게 적용하고 끝나면 제거한다

## 범위 밖 (명시적 제외)

- `Read`, `StartLearning` 개편 — 각각 서브프로젝트 3, 4에서 기능과 함께
- `AiChat`, `Login`, `SignUp`, `UserGuide`, `Pricing`, `FAQ` — 후속
- 라이트 모드 — 현재 다크 단일 테마이며 이번에 확장하지 않는다
- 로고·브랜드 아이덴티티 재정의
- 애니메이션 라이브러리(Framer Motion 등) 도입 — CSS와 `IntersectionObserver`로 충분하다
- `--font-display` 토큰 정리 — 참조 범위가 넓어 별도 작업
- 새 기능·새 데이터 — 이번 스펙은 표현만 바꾼다. 쿼리·스키마·함수 시그니처를 건드리지 않는다

## 검증

- 320 / 375 / 768 / 1024 / 1440에서 각 화면 스크린샷 확인, 가로 스크롤 없음 확인
- 집중도 0%, 50%, 100% 세 경우에 `ScoreRing`·점수 색이 서로 다르게 보이는지 확인 (배경 2번 문제 해소)
- 데이터가 없는 계정으로 로그인해 각 화면의 빈 상태가 의도대로 보이는지 확인
- 네트워크를 느리게 제한한 상태에서 Mypage·Save 진입 시 `Skeleton`이 보이는지, 로드 완료 시 레이아웃이 튀지 않는지 확인 (배경 4번 문제 해소)
- 키보드만으로 전체 플로우를 수행하고 포커스 링이 모든 요소에서 보이는지 확인
- `prefers-reduced-motion: reduce`를 켠 상태에서 애니메이션이 멈추는지 확인
- 신규 색 조합의 대비비를 측정해 기준 충족 확인
- 브라우저 확대 200%에서 레이아웃이 깨지지 않는지 확인
- `npm run build` 컴파일 성공 및 번들 크기 증가폭 확인
