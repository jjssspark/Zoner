import React, { useState } from 'react';
import NavBar from './NavBar';
import './FAQ.css';

const QUESTIONS = [
  {
    id: 'webcam',
    question: '웹캠을 계속 켜야 집중도 분석이 되나요?',
    answer: [
      '네, 집중도 분석은 사용자의 얼굴, 시선, 자세 등을 실시간으로 추적하여 이루어지므로 웹캠을 켠 상태에서만 분석이 가능합니다.',
      '단, 모든 영상은 사용자의 기기 내에서만 처리되며, 서버에 저장되지 않아 개인정보는 안전하게 보호됩니다.',
    ],
  },
  {
    id: 'ai-report',
    question: 'AI 분석 결과는 어떻게 활용되나요?',
    answer: [
      'AI는 사용자의 눈 깜빡임 빈도, 머리 방향, 집중 지속 시간 등을 종합 분석해 세션별 집중 점수를 산출하고, 반복적인 패턴을 기반으로 개인 맞춤형 학습 피드백(예: 집중 잘 되는 시간대, 주의 산만 요인 등)을 제공합니다.',
      '이를 통해 사용자 스스로 학습 루틴을 개선할 수 있습니다.',
    ],
  },
  {
    id: 'effect',
    question: '집중도 분석이 실제로 내 성과 향상에 도움이 되나요?',
    answer: [
      '실제로 집중 패턴을 시각화하고 피드백을 받는 것만으로도 학습 습관에 대한 인식이 높아져 성과 향상에 긍정적인 영향을 줍니다.',
      '특히, 주의가 자주 흐트러지는 구간을 파악하거나, 자신에게 맞는 집중 시간대를 찾는 데 효과적입니다.',
    ],
  },
];

export const FAQ = () => {
  // 한 번에 하나만 열린다. 첫 질문은 열어 둔다 — 이전 화면은 답변이 어디에도
  // 보이지 않아 무엇을 하는 화면인지 읽히지 않았다.
  const [openId, setOpenId] = useState(QUESTIONS[0].id);

  return (
    <div className="faq">
      <NavBar />

      <main className="faq__main">
        <header className="faq__intro">
          <p className="faq__eyebrow">Support</p>
          <h1 className="faq__title">자주 묻는 질문</h1>
          <p className="faq__lead">
            Zoner를 쓰기 전에 가장 많이 확인하는 세 가지입니다.
          </p>
        </header>

        <section className="faq__section" aria-labelledby="faq-list-heading">
          <h2 id="faq-list-heading" className="sr-only">
            질문 목록
          </h2>

          <ul className="faq__list">
            {QUESTIONS.map((item) => {
              const isOpen = openId === item.id;

              return (
                <li key={item.id} className="faq__item">
                  <h3 className="faq__question">
                    <button
                      type="button"
                      id={`faq-question-${item.id}`}
                      className="faq__trigger"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${item.id}`}
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                    >
                      <span className="faq__question-text">
                        {item.question}
                      </span>
                      <span className="faq__marker" aria-hidden="true" />
                    </button>
                  </h3>

                  <div
                    id={`faq-answer-${item.id}`}
                    role="region"
                    aria-labelledby={`faq-question-${item.id}`}
                    className={`faq__answer ${
                      isOpen ? 'faq__answer--open' : ''
                    }`}
                  >
                    <div className="faq__answer-inner">
                      {item.answer.map((paragraph) => (
                        <p key={paragraph} className="faq__answer-text">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default FAQ;
