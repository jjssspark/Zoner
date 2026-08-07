import React, { useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import ScoreRing from '../../components/ui/ScoreRing';
import Sparkline from '../../components/ui/Sparkline';
import image2 from './image-2.png';
import image3 from './image-3.png';
import image4 from './image-4.png';
import './Home.css';

const FEATURES = [
  {
    icon: '◉',
    title: '집중도 분석',
    desc: 'AI가 학습 영상을 분석해 집중 구간과 흐트러진 구간을 실시간으로 짚어줍니다.',
    primary: true,
  },
  {
    icon: '✧',
    title: 'AI 리포트',
    desc: '학습이 끝나면 요약 리포트를 자동으로 생성해 다음 학습 계획을 도와줍니다.',
  },
  {
    icon: '⏱',
    title: '학습 기록',
    desc: '모든 학습 세션을 저장하고 언제든 다시 돌아볼 수 있습니다.',
  },
];

const PREVIEW_TREND = [0.4, 0.62, 0.55, 0.78, 0.83, 0.71, 0.9, 0.86];

function useRevealOnScroll() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const container = ref.current;
    const targets = container?.querySelectorAll('[data-reveal]');
    if (!targets || targets.length === 0) return undefined;

    // Only hide content once JS has proven it can run and found something to
    // reveal — otherwise a failed observer would leave the page permanently
    // blank. See task-8-report.md for the incident this fixes.
    container.classList.add('reveal-enabled');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return ref;
}

export const Home = () => {
  const navigate = useNavigate();
  const revealRef = useRevealOnScroll();

  return (
    <div className="home" ref={revealRef}>
      <NavBar />

      <section className="home__hero">
        <div className="home__hero-text">
          <p className="home__eyebrow">Zoner : 학습에 혁신을 더하다</p>
          <h1 className="home__headline">
            Focus Smarter, <br />
            Learn Better
          </h1>
          <button
            type="button"
            className="home__cta"
            onClick={() => navigate('/login')}
          >
            시작하기
          </button>
        </div>
        <figure className="home__preview">
          <ScoreRing value={82} size="lg" label="종합" />
          <Sparkline
            data={PREVIEW_TREND}
            width={280}
            height={64}
            ariaLabel="시간대별 집중도 추이 예시"
          />
          <figcaption className="home__preview-caption">
            리포트 화면 예시입니다 (실제 데이터 아님)
          </figcaption>
        </figure>
      </section>

      <section className="home__features" aria-label="주요 기능">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className={`feature-card ${
              feature.primary ? 'feature-card--primary' : ''
            }`}
            data-reveal
          >
            <span className="feature-card__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h2 className="feature-card__title">{feature.title}</h2>
            <p className="feature-card__desc">{feature.desc}</p>
          </article>
        ))}
      </section>

      <section className="home__vision" aria-labelledby="vision-heading">
        <h2 id="vision-heading" className="home__vision-title" data-reveal>
          Our Vision
        </h2>
        <div className="home__vision-gallery">
          <img alt="" src={image2} data-reveal />
          <img alt="" src={image3} data-reveal />
          <img alt="" src={image4} data-reveal />
        </div>
      </section>

      <p className="home__watermark" aria-hidden="true">
        ZONER
      </p>
    </div>
  );
};

export default Home;
