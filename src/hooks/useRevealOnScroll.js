import { useLayoutEffect, useRef } from 'react';

// 뷰포트에 들어온 [data-reveal] 요소를 순서대로 드러낸다.
//
// Home.js 안에만 있던 것을 꺼냈다. 여러 화면이 쓰므로 hooks/에 둔다.
//
// 두 가지 안전장치가 있다. 둘 다 TS-007(랜딩이 영구히 빈 화면이 된 사고)에서
// 나온 것이다.
//   1. JS가 실제로 돌고 대상을 찾은 뒤에야 reveal-enabled를 붙인다. 스크립트가
//      죽으면 아무것도 숨기지 않는다.
//   2. 관찰자가 끝내 발화하지 않아도 FALLBACK_MS 뒤에 전부 드러낸다. 자동화
//      브라우저나 일부 임베드 환경에서 IntersectionObserver가 억제되는 경우가
//      실제로 있었다. 콘텐츠가 안 보이는 것보다 모션을 잃는 쪽이 낫다.
const FALLBACK_MS = 1500;
const THRESHOLD = 0.15;

export function useRevealOnScroll() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const container = ref.current;
    const targets = container?.querySelectorAll('[data-reveal]');
    if (!targets || targets.length === 0) return undefined;

    // 형제끼리만 순번을 매긴다. 페이지 전체로 매기면 아래쪽 요소의 지연이
    // 몇 초까지 늘어나 기다리는 화면이 된다.
    const seen = new Map();
    targets.forEach((el) => {
      const parent = el.parentElement;
      const index = seen.get(parent) ?? 0;
      el.style.setProperty('--reveal-index', index);
      seen.set(parent, index + 1);
    });

    container.classList.add('reveal-enabled');

    const reveal = (el) => el.classList.add('is-revealed');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            reveal(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: THRESHOLD }
    );

    targets.forEach((el) => observer.observe(el));

    // 폴백은 is-revealed 를 붙이는 것으로 끝내면 안 된다. 그 복구는
    // opacity 트랜지션이 실제로 재생돼야 완성되는데, 배경 탭이나 iframe
    // 처럼 애니메이션이 억제되는 환경에서는 전환이 진행되지 않아 콘텐츠가
    // 계속 투명한 채로 남는다. 숨김 자체를 걷어내야 확실하다.
    const fallback = window.setTimeout(() => {
      targets.forEach(reveal);
      container.classList.remove('reveal-enabled');
      observer.disconnect();
    }, FALLBACK_MS);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, []);

  return ref;
}

export default useRevealOnScroll;
