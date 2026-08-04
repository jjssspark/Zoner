import React from 'react';
import image10 from './image-10.png';
import image11 from './image-11.png';
import image12 from './image-12.png';
import { useNavigate } from 'react-router-dom';
import './UserGuide.css';

export const UserGuide = () => {
  const navigate = useNavigate();
  return (
    <div className="U-screen">
      <div className="U-div">
        <img className="image" alt="Image" src={image12} />

        <p className="p">
          <span className="text-wrapper">
            실시간 집중력 분석 시작
            <br />
          </span>

          <span className="span">
            <br />
          </span>

          <span className="text-wrapper-2">
            사용자의 얼굴과 행동을 웹캠으로 인식하여 집중 상태를 실시간으로
            분석합니다. <br />
            <br />
          </span>

          <span className="text-wrapper-3">
            웹캠 권한 허용 시 분석이 시작됩니다
            <br />
            머리 각도, 시선 방향, 눈 깜빡임, 움직임 등을 기반으로 집중 여부를
            감지합니다..
            <br />
            분석결과는 실시간으로 화면에 시각화되어 점수로 표시됩니다,{' '}
          </span>
        </p>

        <p className="div-2">
          <span className="text-wrapper">
            학습 영상 기록 및 열람
            <br />
          </span>

          <span className="span">
            <br />
          </span>

          <span className="text-wrapper-2">
            집중력 분석과 함께 학습 장면을 영상으로 자동 기록하고, 나중에 다시
            확인할 수 있습니다. <br />
            <br />
          </span>

          <span className="text-wrapper-3">
            학습세션이 종료되면 영상이 자동 저장 됩니다. <br />
            기록된 영상은 사용자 전용 페이지에서 확인할 수 있습니다.
            <br />
            영상마다 집중도 분석 그래프가 함게 제공되어 집중 흐름을 파악할 수
            있습니다.
          </span>
        </p>

        <p className="AI-AI-AI">
          <span className="text-wrapper">
            AI 집중 분석 리포트 및 맞춤 피드백
            <br />
          </span>

          <span className="span">
            <br />
          </span>

          <span className="text-wrapper-2">
            AI가 기록된&nbsp;&nbsp;데이터를 분석하여 집중 습관과 개선 방향을
            제시합니다.
            <br />
            <br />
          </span>

          <span className="text-wrapper-3">
            세션별 집중 점수, 주의 흐름, 이탈 시점 등을 AI가 분석합니다
            <br />
            집중이 잘 된 구간 / 흐트러진 구간을 구분해 시각적으로 제공합니다.
            <br />
            사용자의 집중 패턴에 따른 개인 맞춤형 학습 전략 및 집중력 향상 팁을
            제안합니다.{' '}
          </span>
        </p>

        <div className="text-wrapper-4">ZONER</div>

        <div className="ZONER-wrapper">
          <button className="ZONER" onClick={() => navigate('/')}>
            Zoner
          </button>
        </div>

        <div className="USER-GUIDE-wrapper">
          <button className="text-wrapper-U">User Guide</button>
        </div>

        <div className="PRICING-wrapper">
          <button
            className="text-wrapper-U"
            onClick={() => navigate('/')}
          >
            Pricing
          </button>
        </div>

        <div className="FAQ-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/faq')}>
            Faq
          </button>
        </div>

        <img className="img" alt="Image" src={image10} />

        <img className="image-2" alt="Image" src={image11} />
      </div>
    </div>
  );
};
export default UserGuide;
