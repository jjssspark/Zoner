import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Pricing.css';

export const Pricing = () => {
  const navigate = useNavigate();
  return (
    <div className="P-screen">
      <div className="P-div">
        <div className="overlap-group">
          <div className="text-wrapper">ZONER</div>

          <div className="rectangle" />

          <div className="rectangle-2" />

          <div className="rectangle-3" />

          <p className="element-premium-plan fade-in">
            <span className="span">
              🧠 3. Premium Plan <br />
              (월 $14.99)
              <br />
            </span>

            <span className="text-wrapper-2">
              집중력 코칭까지 받는 전문가급 플랜
              <br />
              <br />
              무제한 영상 저장
              <br />
              고급 AI 분석 + 장기 학습 추세 리포트
              <br />
              집중력 코칭 챗봇 &amp; 일정 추천 시스템
              <br />
              PDF 리포트 다운로드 가능
              <br />
              맞춤형 학습 전략 컨설팅 제공 (월 1회)
              <br />
            </span>

            <span className="text-wrapper-3">
              <br />
            </span>

            <span className="text-wrapper-4">
              💬 타겟: 집중력 향상이 중요한 고효율 학습자
            </span>
          </p>

          <p className="element-pro-plan fade-in">
            <span className="span">
              🚀 2. Pro Plan (월 $7.99)
              <br />
            </span>

            <span className="text-wrapper-2">
              정기 학습자를 위한 집중 관리 플랜
              <br />
              <br />
              고정밀 실시간 집중 분석
              <br />
              영상 최대 10개 저장 (최대 1시간/세션)
              <br />
              집중도 히트맵 &amp; 주간/월간 리포트
              <br />
              개인 집중 패턴 분석 + 개선 팁 제공
              <br />
              광고 제거
              <br />
              <br />
            </span>

            <span className="text-wrapper-4">
              💬 타겟: 꾸준한 학습자, 자격증/입시 준비생
            </span>
          </p>

          <p className="element-basic-plan fade-in">
            <span className="span">
              💡 1. Basic Plan (무료)
              <br />
              <br />
            </span>

            <span className="text-wrapper-5">
              입문자를 위한 체험용 플랜
              <br />
            </span>

            <span className="text-wrapper-6">
              <br />
            </span>

            <span className="text-wrapper-2">
              실시간 집중도 분석 (기본 정확도)
              <br />
              학습 영상 1개 저장 가능 (최대 30분)
              <br />
              주간 리포트 1회 제공
              <br />
              광고 포함
              <br />
            </span>

            <span className="text-wrapper-3">
              <br />
              <br />
            </span>

            <span className="text-wrapper-4">
              💬 타겟: 처음 체험해보는 사용자, 학생
            </span>
          </p>

          <div className="frame">
            <div className="text-wrapper-7" onClick={() => navigate('/Login')}>
              시작하기
            </div>
          </div>

          <div className="div-wrapper">
            <div className="text-wrapper-7" onClick={() => navigate('/Login')}>
              시작하기
            </div>
          </div>

          <div className="frame-2">
            <div className="text-wrapper-7" onClick={() => navigate('/Login')}>
              시작하기
            </div>
          </div>
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
          <button className="text-wrapper-U">Pricing</button>
        </div>

        <div className="FAQ-wrapper">
          <button className="text-wrapper-U" onClick={() => navigate('/faq')}>
            Faq
          </button>
        </div>
      </div>
    </div>
  );
};
export default Pricing;
