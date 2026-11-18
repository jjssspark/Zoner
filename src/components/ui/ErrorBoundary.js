// src/components/ui/ErrorBoundary.js
import React from 'react';
import './ErrorBoundary.css';

// 렌더 중 터진 예외를 여기서 받는다. 이게 없으면 React 18+는 트리를 통째로
// 언마운트해서 흰 화면만 남는다. 사용자는 무엇이 잘못됐는지도, 무엇을 해야
// 하는지도 알 수 없다.
//
// react-router를 쓰지 않는다. 이 컴포넌트가 라우터에 의존하면 CRA 번들
// Jest 리졸버가 v7 exports 맵을 못 읽어 테스트를 쓸 수 없다 (TROUBLESHOOTING TS-003).
// 이동은 window.location으로 한다 — 어차피 트리가 깨진 상태라 새로 고치는 편이 낫다.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleRetry = this.handleRetry.bind(this);
    this.handleHome = this.handleHome.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 수집 서버가 없으므로 콘솔에 남긴다. 사용자가 개발자도구를 열어
    // 캡처해 줄 수 있는 유일한 단서다.
    console.error('렌더 중 처리되지 않은 오류:', error, info?.componentStack);
    this.props.onError?.(error, info);
  }

  handleRetry() {
    // 같은 화면을 다시 그려 본다. 일시적인 원인(네트워크 응답 모양 등)이면
    // 이것으로 회복된다.
    this.setState({ error: null });
    this.props.onReset?.();
  }

  handleHome() {
    window.location.assign('/');
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary__panel">
          <h1 className="error-boundary__title">화면을 그리지 못했습니다</h1>
          <p className="error-boundary__description">
            예상하지 못한 오류가 났습니다. 다시 시도해도 같은 화면이 나오면
            홈으로 돌아가 주세요.
          </p>
          <div className="error-boundary__actions">
            <button type="button" className="error-boundary__retry" onClick={this.handleRetry}>
              다시 시도
            </button>
            <button type="button" className="error-boundary__home" onClick={this.handleHome}>
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
