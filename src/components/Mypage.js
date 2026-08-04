import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // useNavigate import 추가
import './Mypage.css';

export const Mypage = () => {
  const navigate = useNavigate(); // navigate 훅 사용
  const location = useLocation(); // location 훅 사용
  const userName = location.state ? location.state.name : 'Guest'; // 로그인 시 전달된 이름

  // 최근 학습 기록과 리포트에 대한 영상 목록 상태
  const [learningVideos, setLearningVideos] = useState([]); // 업로드된 학습 영상 리스트
  const [reportVideos, setReportVideos] = useState([]); // 업로드된 리포트 영상 리스트

  // 영상 추가 함수 (여기서는 단순히 배열에 영상 추가하는 방식으로 구현)
  const addLearningVideo = (video) => {
    setLearningVideos([...learningVideos, video]);
  };

  const addReportVideo = (video) => {
    setReportVideos([...reportVideos, video]);
  };

  return (
    <div className="M-screen">
      <div className="M-div">
        <div className="frame">
          <div className="user-name">{userName}</div> {/* 전달받은 이름 출력 */}
        </div>

        <div className="overlap">
          <div className="frame-2">
            <p className="element">
              <span className="text-wrapper">
                최근
                기록&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </span>

              {/* 최근 학습 영상 리스트 출력 */}
              <span className="span">
                {learningVideos.length > 0
                  ? `최근 학습 녹화 기록 열람 가능(${learningVideos.length}개)`
                  : '업로드된 학습 녹화가 없습니다.'}
              </span>
            </p>

            {/* 학습 영상 리스트 출력 */}
            <div className="rectangle">
              {learningVideos.length > 0 ? (
                learningVideos.map((video, index) => (
                  <div key={index}>{video}</div> // 영상 제목을 예시로 출력
                ))
              ) : (
                <p>학습 영상이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="frame-3">
            <p className="p">
              <span className="text-wrapper">
                최근
                리포트&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </span>

              {/* 최근 리포트 영상 리스트 출력 */}
              <span className="span">
                {reportVideos.length > 0
                  ? `최근 학습 리포트 열람 가능(${reportVideos.length}개)`
                  : '업로드된 리포트가 없습니다.'}
              </span>
            </p>

            {/* 리포트 영상 리스트 출력 */}
            <div className="rectangle-4">
              {reportVideos.length > 0 ? (
                reportVideos.map((video, index) => (
                  <div key={index}>{video}</div> // 영상 제목을 예시로 출력
                ))
              ) : (
                <p>리포트 영상이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="frame-4">
            <p className="zoner">
              <span className="text-wrapper">
                추천
                서비스&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
              </span>

              <span className="span">Zoner의 다른 서비스도 확인해보세요.</span>
            </p>

            <div className="overlap-group-wrapper">
              <div className="overlap-group">
                <div className="text-wrapper-2">요금제 업그레이드</div>
              </div>
            </div>

            <div className="overlap-wrapper">
              <div className="overlap-group">
                <div className="text-wrapper-2">개인 설정</div>
              </div>
            </div>

            <div className="div-wrapper">
              <div className="overlap-group">
                <div className="text-wrapper-2">프로모션</div>
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 및 링크 */}
        <div className="h-ome-wrapper">
          <button className="text-wrapper-3" onClick={() => navigate('/')}>
            HOME
          </button>
        </div>

        <div className="frame-5">
          <button
            className="text-wrapper-3"
            onClick={() => navigate('/ai-chat')}
          >
            AI 채팅
          </button>
        </div>

        <div className="frame-6">
          <button
            className="text-wrapper-3"
            onClick={() => navigate('/start-learning')}
          >
            학습 시작
          </button>
        </div>

        <div className="frame-7">
          <button className="text-wrapper-3" onClick={() => navigate('/save')}>
            학습 기록
          </button>
        </div>

        <div className="frame-8">
          <button
            className="text-wrapper-3"
            onClick={() => navigate('/save_report')}
          >
            학습 리포트
          </button>
        </div>

        <div className="frame-9">
          <button className="text-wrapper-3" onClick={() => navigate('/trash')}>
            휴지통
          </button>
        </div>

        <div className="logout-wrapper">
          <button className="logout" onClick={() => navigate('/')}>
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
};

export default Mypage;
