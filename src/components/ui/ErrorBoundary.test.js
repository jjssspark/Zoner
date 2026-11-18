import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

// 예외를 던지는 자식. 렌더 단계에서 던져야 ErrorBoundary가 잡는다.
const Boom = ({ message = '터짐' }) => {
  throw new Error(message);
};

// React는 경계가 잡은 예외도 콘솔에 찍는다. 테스트 출력이 그걸로 덮이지
// 않도록 막되, 우리 코드가 남기는 로그는 횟수로 확인한다.
let consoleError;
beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('ErrorBoundary', () => {
  test('자식이 멀쩡하면 그대로 보여준다', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('정상 화면')).toBeInTheDocument();
  });

  test('자식이 던지면 흰 화면 대신 안내를 보여준다', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('화면을 그리지 못했습니다')).toBeInTheDocument();
  });

  test('회복 수단을 둘 다 준다 — 다시 시도와 홈으로', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '홈으로' })).toBeInTheDocument();
  });

  test('onError로 오류를 바깥에 알린다', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom message="수집용" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('수집용');
  });

  test('단서를 콘솔에 남긴다 — 수집 서버가 없으므로 유일한 기록이다', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    const ours = consoleError.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('렌더 중 처리되지 않은 오류')
    );
    expect(ours).toHaveLength(1);
  });
});
