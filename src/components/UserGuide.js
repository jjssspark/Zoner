import React from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import image10 from './image-10.png';
import image11 from './image-11.png';
import image12 from './image-12.png';
import './UserGuide.css';

// 기존 화면에 적혀 있던 3단계를 그대로 옮겼다. 단계나 설명을 새로 만들지 않는다.
const STEPS = [
  {
    id: 'analyze',
    title: '실시간 집중력 분석 시작',
    lead: '사용자의 얼굴과 행동을 웹캠으로 인식하여 집중 상태를 실시간으로 분석합니다.',
    details: [
      '웹캠 권한 허용 시 분석이 시작됩니다.',
      '머리 각도, 시선 방향, 눈 깜빡임, 움직임 등을 기반으로 집중 여부를 감지합니다.',
      '분석 결과는 실시간으로 화면에 시각화되어 점수로 표시됩니다.',
    ],
    image: image12,
    alt: '책상 앞에서 노트북을 보는 사용자와, 그 뒤로 집중 상태를 나타내는 그래프가 떠 있는 일러스트',
  },
  {
    id: 'record',
    title: '학습 영상 기록 및 열람',
    lead: '집중력 분석과 함께 학습 장면을 영상으로 자동 기록하고, 나중에 다시 확인할 수 있습니다.',
    details: [
      '학습 세션이 종료되면 영상이 자동 저장됩니다.',
      '기록된 영상은 사용자 전용 페이지에서 확인할 수 있습니다.',
      '영상마다 집중도 분석 그래프가 함께 제공되어 집중 흐름을 파악할 수 있습니다.',
    ],
    image: image10,
    alt: '모니터에서 저장된 학습 영상을 재생 컨트롤과 함께 다시 보는 화면 일러스트',
  },
  {
    id: 'report',
    title: 'AI 집중 분석 리포트 및 맞춤 피드백',
    lead: 'AI가 기록된 데이터를 분석하여 집중 습관과 개선 방향을 제시합니다.',
    details: [
      '세션별 집중 점수, 주의 흐름, 이탈 시점 등을 AI가 분석합니다.',
      '집중이 잘 된 구간과 흐트러진 구간을 구분해 시각적으로 제공합니다.',
      '사용자의 집중 패턴에 따른 개인 맞춤형 학습 전략 및 집중력 향상 팁을 제안합니다.',
    ],
    image: image11,
    alt: '집중도 추이 선그래프와 레이더 차트, 피드백 문구가 함께 놓인 분석 리포트 화면',
  },
];

export const UserGuide = () => {
  const navigate = useNavigate();

  return (
    <div className="guide">
      <NavBar />

      <main className="guide__main">
        <header className="guide__intro">
          <p className="guide__eyebrow">User Guide</p>
          <h1 className="guide__title">Zoner는 이렇게 씁니다</h1>
          <p className="guide__lead">
            웹캠을 켜고 학습을 시작하면, 세 단계로 집중 기록이 쌓입니다.
          </p>
        </header>

        <section className="guide__section" aria-labelledby="steps-heading">
          <h2 id="steps-heading" className="sr-only">
            이용 단계
          </h2>

          <ol className="guide__steps">
            {STEPS.map((step, index) => (
              <li key={step.id} className="guide__step">
                <div className="guide__text">
                  <p className="guide__step-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="guide__step-title">{step.title}</h3>
                  <p className="guide__step-lead">{step.lead}</p>
                  <ul className="guide__details">
                    {step.details.map((detail) => (
                      <li key={detail} className="guide__detail">
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>

                <img
                  className="guide__figure"
                  src={step.image}
                  alt={step.alt}
                  width="904"
                  height="586"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </li>
            ))}
          </ol>
        </section>

        <section className="guide__outro" aria-labelledby="start-heading">
          <h2 id="start-heading" className="guide__outro-title">
            준비됐다면 바로 시작하세요
          </h2>
          <button
            type="button"
            className="guide__cta"
            onClick={() => navigate('/login')}
          >
            시작하기
          </button>
        </section>
      </main>
    </div>
  );
};

export default UserGuide;
