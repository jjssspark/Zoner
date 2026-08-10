import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import useRevealOnScroll from '../../hooks/useRevealOnScroll';
import './Pricing.css';

// 코드가 실제로 하는 일과 맞춘다.
//
// 원래는 기존 화면의 문구를 그대로 옮겨 놓았는데, 그 안에 구현이 없는
// 항목이 섞여 있었다 — "PDF 리포트 다운로드"(당시 미구현), "영상 최대
// 10개 저장 (최대 1시간/세션)"(실제로는 전 사용자 3개·약 15분).
// 결제 화면에 없는 기능을 적어두면 그건 그냥 거짓말이다.
//
// 티어별 분기는 코드에 아예 없다(MAX_STORED_VIDEOS 는 전 사용자 공통).
// 그래서 지금 되는 것은 전부 무료 칸에 넣고, 나머지는 planned 로 표시한다.
const PLANS = [
  {
    id: 'basic',
    icon: '💡',
    name: 'Basic Plan',
    price: '무료',
    period: null,
    tagline: '지금 열려 있는 기능 전부',
    features: [
      { text: '실시간 집중도 분석' },
      { text: '학습 영상 3개 저장 (세션당 약 15분)' },
      { text: '세션 리포트 · 학습 성향 분석' },
      { text: 'PDF 리포트 저장' },
      { text: 'AI 학습 상담 챗봇' },
    ],
    target: '지금 Zoner 를 쓰는 모든 사용자',
    featured: false,
  },
  {
    id: 'pro',
    icon: '🚀',
    name: 'Pro Plan',
    price: '$7.99',
    period: '월',
    tagline: '정기 학습자를 위한 집중 관리 플랜',
    features: [
      { text: '영상 저장 개수 · 길이 확대', planned: true },
      { text: '집중도 히트맵', planned: true },
      { text: '주간 · 월간 리포트', planned: true },
      { text: '광고 제거', planned: true },
    ],
    target: '꾸준한 학습자, 자격증/입시 준비생',
    featured: true,
  },
  {
    id: 'premium',
    icon: '🧠',
    name: 'Premium Plan',
    price: '$14.99',
    period: '월',
    tagline: '집중력 코칭까지 받는 전문가급 플랜',
    features: [
      { text: '무제한 영상 저장', planned: true },
      { text: '장기 학습 추세 리포트', planned: true },
      { text: '학습 일정 추천', planned: true },
      { text: '맞춤형 학습 전략 컨설팅 (월 1회)', planned: true },
    ],
    target: '집중력 향상이 중요한 고효율 학습자',
    featured: false,
  },
];

export const Pricing = () => {
  const navigate = useNavigate();
  const revealRef = useRevealOnScroll();

  return (
    <div className="pricing" ref={revealRef}>
      <NavBar />

      <main className="pricing__main">
        <header className="pricing__intro">
          <p className="pricing__eyebrow">Pricing</p>
          <h1 className="pricing__title">요금제</h1>
          <p className="pricing__lead">
            무료로 시작하고, 학습량이 늘면 그때 올리면 됩니다.
          </p>
          <p className="pricing__notice" role="note">
            지금은 모든 기능이 무료로 열려 있습니다. 유료 플랜은 준비 중이며
            결제는 아직 동작하지 않습니다.
          </p>
        </header>

        <section className="pricing__section" aria-labelledby="plans-heading">
          <h2 id="plans-heading" className="sr-only">
            요금제 목록
          </h2>

          <ul className="pricing__grid">
            {PLANS.map((plan) => (
              <li
                key={plan.id}
                className={`pricing__tier ${
                  plan.featured ? 'pricing__tier--featured' : ''
                }`}
                data-reveal
              >
                {plan.featured && <p className="pricing__badge">추천</p>}

                <span className="pricing__icon" aria-hidden="true">
                  {plan.icon}
                </span>

                <h3 className="pricing__name">{plan.name}</h3>

                <p className="pricing__price">
                  <span className="pricing__amount">{plan.price}</span>
                  {plan.period && (
                    <span className="pricing__period"> / {plan.period}</span>
                  )}
                </p>

                <p className="pricing__tagline">{plan.tagline}</p>

                <ul className="pricing__features">
                  {plan.features.map((feature) => (
                    <li
                      key={feature.text}
                      className={`pricing__feature${
                        feature.planned ? ' pricing__feature--planned' : ''
                      }`}
                    >
                      {feature.text}
                      {/* 색이나 흐림만으로 구분하지 않는다. 글자로 적는다. */}
                      {feature.planned && (
                        <span className="pricing__planned">준비 중</span>
                      )}
                    </li>
                  ))}
                </ul>

                <p className="pricing__target">
                  <span className="pricing__target-label">타겟</span>
                  {plan.target}
                </p>

                <button
                  type="button"
                  className="pricing__cta"
                  onClick={() => navigate('/login')}
                >
                  시작하기
                  <span className="sr-only"> — {plan.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default Pricing;
