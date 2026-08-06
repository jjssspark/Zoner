import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

const noop = () => {};

describe('ConfirmDialog', () => {
  test('제목과 설명을 보여준다', () => {
    render(
      <ConfirmDialog
        title="대화를 삭제할까요?"
        description="메시지도 함께 사라져요."
        onConfirm={noop}
        onCancel={noop}
      />
    );

    expect(screen.getByText('대화를 삭제할까요?')).toBeInTheDocument();
    expect(screen.getByText('메시지도 함께 사라져요.')).toBeInTheDocument();
  });

  test('모달 다이얼로그 역할을 가진다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('열리면 취소 버튼에 포커스가 간다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
  });

  test('확인 버튼을 누르면 onConfirm이 불린다', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={onConfirm} onCancel={noop} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test('취소 버튼을 누르면 onCancel이 불린다', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('Esc를 누르면 onCancel이 불린다', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('마지막 요소에서 Tab을 누르면 첫 요소로 돌아온다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: '삭제' });

    confirm.focus();
    fireEvent.keyDown(confirm, { key: 'Tab' });
    expect(cancel).toHaveFocus();
  });

  test('첫 요소에서 Shift+Tab을 누르면 마지막 요소로 간다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const cancel = screen.getByRole('button', { name: '취소' });
    const confirm = screen.getByRole('button', { name: '삭제' });

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();
  });

  test('닫히면 열기 전 포커스로 돌아간다', () => {
    const { rerender } = render(
      <>
        <button type="button" data-testid="opener">
          삭제
        </button>
      </>
    );
    const opener = screen.getByTestId('opener');
    opener.focus();

    rerender(
      <>
        <button type="button" data-testid="opener">
          삭제
        </button>
        <ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />
      </>
    );
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();

    rerender(
      <>
        <button type="button" data-testid="opener">
          삭제
        </button>
      </>
    );
    expect(opener).toHaveFocus();
  });

  test('aria-labelledby와 aria-describedby가 실제 제목·설명 요소를 가리킨다', () => {
    render(
      <ConfirmDialog
        title="대화를 삭제할까요?"
        description="메시지도 함께 사라져요."
        onConfirm={noop}
        onCancel={noop}
      />
    );

    const dialog = screen.getByRole('dialog');

    const labelledBy = document.getElementById(dialog.getAttribute('aria-labelledby'));
    expect(labelledBy).not.toBeNull();
    expect(labelledBy).toHaveTextContent('대화를 삭제할까요?');

    const describedBy = document.getElementById(dialog.getAttribute('aria-describedby'));
    expect(describedBy).not.toBeNull();
    expect(describedBy).toHaveTextContent('메시지도 함께 사라져요.');
  });

  test('설명이 없으면 aria-describedby가 존재하지 않는다', () => {
    render(<ConfirmDialog title="삭제할까요?" onConfirm={noop} onCancel={noop} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).not.toHaveAttribute('aria-describedby');
  });

  describe('onDismiss', () => {
    test('onDismiss를 주면 Esc가 onCancel 대신 onDismiss를 부른다', () => {
      const onCancel = jest.fn();
      const onDismiss = jest.fn();
      render(
        <ConfirmDialog
          title="종료할까요?"
          onConfirm={jest.fn()}
          onCancel={onCancel}
          onDismiss={onDismiss}
        />
      );

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    test('onDismiss를 줘도 취소 버튼은 여전히 onCancel을 부른다', () => {
      const onCancel = jest.fn();
      const onDismiss = jest.fn();
      render(
        <ConfirmDialog
          title="종료할까요?"
          cancelLabel="기록만 저장"
          onConfirm={jest.fn()}
          onCancel={onCancel}
          onDismiss={onDismiss}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: '기록만 저장' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
    });

    test('onDismiss가 없으면 Esc가 기존대로 onCancel을 부른다', () => {
      const onCancel = jest.fn();
      render(<ConfirmDialog title="삭제할까요?" onConfirm={jest.fn()} onCancel={onCancel} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
