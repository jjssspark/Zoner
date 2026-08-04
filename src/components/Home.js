import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import image1 from './image-1.png';
import image2 from './image-2.png';
import image3 from './image-3.png';
import image4 from './image-4.png';
import './Home.css';

const FEATURES = [
  {
    icon: '◉',
    title: '집중도 분석',
    desc: 'AI가 학습 영상을 분석해 집중 구간과 흐트러진 구간을 실시간으로 짚어줍니다.',
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

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home">
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
        <img className="home__hero-image" alt="" src={image1} />
      </section>

      <section className="home__features" aria-label="주요 기능">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="feature-card">
            <span className="feature-card__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h2 className="feature-card__title">{feature.title}</h2>
            <p className="feature-card__desc">{feature.desc}</p>
          </article>
        ))}
      </section>

      <section className="home__vision" aria-labelledby="vision-heading">
        <h2 id="vision-heading" className="home__vision-title">
          Our Vision
        </h2>
        <div className="home__vision-gallery">
          <img alt="" src={image2} />
          <img alt="" src={image3} />
          <img alt="" src={image4} />
        </div>
      </section>

      <p className="home__watermark" aria-hidden="true">
        ZONER
      </p>
    </div>
  );
};

export default Home;
