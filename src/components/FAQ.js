import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './FAQ.css';

export const FAQ = () => {
  const [hovered, setHovered] = useState(null);
  const navigate = useNavigate();
  return (
    <div className="F-screen">
      <div className="div">
        <div className="text-wrapper">ZONER</div>

        <div className="text-wrapper-2">자주 묻는 질문</div>

        <div
          className={`frame ${hovered === 'frame' ? 'hovered' : ''}`}
          onMouseEnter={() => setHovered('frame')}
          onMouseLeave={() => setHovered(null)}
        >
          {hovered === 'frame' ? (
            <p className="p hovered-text">
              네, 집중도 분석은 사용자의 얼굴, 시선, 자세 등을 실시간으로
              추적하여 이루어지므로 웹캠을 켠 상태에서만 분석이 가능합니다.
              <br />
              단, 모든 영상은 사용자의 기기 내에서만 처리되며, 서버에 저장되지
              않아 개인정보는 안전하게 보호됩니다.
            </p>
          ) : (
            <p className="p fade-in">
              <span className="span">❓</span>
              <span className="text-wrapper-3">
                웹캠을 계속 켜야 집중도 분석이 되나요?
              </span>
            </p>
          )}
        </div>

        <div
          className={`AI-wrapper ${hovered === 'ai' ? 'hovered' : ''}`}
          onMouseEnter={() => setHovered('ai')}
          onMouseLeave={() => setHovered(null)}
        >
          {hovered === 'ai' ? (
            <p className="p hovered-text">
              AI는 사용자의 눈 깜빡임 빈도, 머리 방향, 집중 지속 시간 등을 종합
              분석해 세션별 집중 점수를 산출하고, 반복적인 패턴을 기반으로 개인
              맞춤형 학습 피드백(예: 집중 잘 되는 시간대, 주의 산만 요인 등)을
              제공합니다.
              <br />
              이를 통해 사용자 스스로 학습 루틴을 개선할 수 있습니다.
            </p>
          ) : (
            <p className="p fade-in">
              <span className="span">❓</span>
              <span className="text-wrapper-3">
                {' '}
                AI분석 결과는 어떻게 활용되나요?
              </span>
            </p>
          )}
        </div>

        <div
          className={`div-wrapper ${hovered === 'result' ? 'hovered' : ''}`}
          onMouseEnter={() => setHovered('result')}
          onMouseLeave={() => setHovered(null)}
        >
          {hovered === 'result' ? (
            <p className="p hovered-text">
              실제로 집중 패턴을 시각화하고 피드백을 받는 것만으로도 학습 습관에
              대한 인식이 높아져 성과 향상에 긍정적인 영향을 줍니다.
              <br />
              특히, 주의가 자주 흐트러지는 구간을 파악하거나,
              <br />
              자신에게 맞는 집중 시간대를 찾는 데 효과적입니다.
            </p>
          ) : (
            <p className="p fade-in">
              <span className="span">❓</span>
              <span className="text-wrapper-3">
                집중도 분석이 실제로 내 성과 향상에
                <br /> 도움이 되나요?
              </span>
            </p>
          )}
        </div>
        <div className="ZONER-wrapper">
          <button className="ZONER" onClick={() => navigate('/')}>
            Zoner
          </button>
        </div>

        <div className="USER-GUIDE-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/guide')}>
            User Guide
          </button>
        </div>

        <div className="PRICING-wrapper">
          <button
            className="text-wrapper-U"
            onClick={() => navigate('/pricing')}
          >
            Pricing
          </button>
        </div>

        <div className="FAQ-wrapper">
          <button className="text-wrapper-U">Faq</button>
        </div>
      </div>
    </div>
  );
};
export default FAQ;
