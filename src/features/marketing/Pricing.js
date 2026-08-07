import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import './Pricing.css';

// 기존 화면에 실제로 적혀 있던 내용만 옮겼다. 없던 요금제나 기능은 넣지 않는다.
const PLANS = [
  {
    id: 'basic',
    icon: '💡',
    name: 'Basic Plan',
    price: '무료',
    period: null,
    tagline: '입문자를 위한 체험용 플랜',
    features: [
      '실시간 집중도 분석 (기본 정확도)',
      '학습 영상 1개 저장 가능 (최대 30분)',
      '주간 리포트 1회 제공',
      '광고 포함',
    ],
    target: '처음 체험해보는 사용자, 학생',
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
      '고정밀 실시간 집중 분석',
      '영상 최대 10개 저장 (최대 1시간/세션)',
      '집중도 히트맵 & 주간/월간 리포트',
      '개인 집중 패턴 분석 + 개선 팁 제공',
      '광고 제거',
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
      '무제한 영상 저장',
      '고급 AI 분석 + 장기 학습 추세 리포트',
      '집중력 코칭 챗봇 & 일정 추천 시스템',
      'PDF 리포트 다운로드 가능',
      '맞춤형 학습 전략 컨설팅 제공 (월 1회)',
    ],
    target: '집중력 향상이 중요한 고효율 학습자',
    featured: false,
  },
];

export const Pricing = () => {
  const navigate = useNavigate();

  return (
    <div className="pricing">
      <NavBar />

      <main className="pricing__main">
        <header className="pricing__intro">
          <p className="pricing__eyebrow">Pricing</p>
          <h1 className="pricing__title">요금제</h1>
          <p className="pricing__lead">
            무료로 시작하고, 학습량이 늘면 그때 올리면 됩니다.
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
                    <li key={feature} className="pricing__feature">
                      {feature}
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
