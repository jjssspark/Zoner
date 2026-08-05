// src/components/AiChat.js
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { sendChatMessage, isValidMessage, MAX_MESSAGE_LENGTH } from '../lib/aiChat';
import './AiChat.css';

export const AiChat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [failedMessage, setFailedMessage] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (isMounted) {
        setMessages((data || []).slice().reverse());
        setIsLoading(false);
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (contentOverride) => {
    const content = (contentOverride ?? input).trim();
    if (!isValidMessage(content) || isSending) return;

    setIsSending(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setIsSending(false);
      navigate('/login');
      return;
    }

    setErrorMessage(null);
    setFailedMessage(null);
    setInput('');

    const userMessage = { id: `local-user-${Date.now()}`, role: 'user', content };
    const assistantMessage = {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      await sendChatMessage({
        supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
        accessToken: session.access_token,
        content,
        onDelta: (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        },
      });
      setAnnouncement('');
      setTimeout(() => setAnnouncement('AI 응답이 도착했습니다.'), 0);
    } catch (error) {
      if (error.isDailyLimit) {
        setLimitReached(true);
      }
      setErrorMessage(error.message || '답변을 받지 못했어요.');
      setFailedMessage(content);
      // 낙관적으로 추가한 user 버블 + 빈 assistant 버블을 함께 제거한다.
      // 하나만 제거하면 재시도 시 같은 user 메시지가 중복 표시된다.
      setMessages((prev) => prev.slice(0, -2));
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = () => {
    if (failedMessage) {
      handleSend(failedMessage);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return <div className="ai-chat-page" />;
  }

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-page__topbar">
        <h1 className="ai-chat-page__title">AI 채팅</h1>
        <div className="ai-chat-page__topbar-actions">
          <button type="button" className="ai-chat-page__back" onClick={() => navigate(-1)}>
            뒤로가기
          </button>
          <button
            type="button"
            className="ai-chat-page__home"
            onClick={() => navigate('/mypage')}
          >
            HOME
          </button>
        </div>
      </header>

      <main className="ai-chat-page__main">
        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>
        <div className="ai-chat-list">
          {messages.length === 0 ? (
            <p className="ai-chat-list__empty">학습에 대해 궁금한 걸 물어보세요.</p>
          ) : (
            messages.map((message, index) => {
              const isWaitingForReply =
                isSending &&
                index === messages.length - 1 &&
                message.role === 'assistant' &&
                message.content === '';

              return (
                <div
                  key={message.id}
                  className={`ai-chat-bubble ai-chat-bubble--${message.role}`}
                >
                  {isWaitingForReply ? (
                    <span className="ai-chat-typing" aria-hidden="true">
                      <span className="ai-chat-typing__dot" />
                      <span className="ai-chat-typing__dot" />
                      <span className="ai-chat-typing__dot" />
                    </span>
                  ) : (
                    message.content
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {errorMessage && (
          <p className="ai-chat-error" role="alert">
            <span>{errorMessage}</span>
            {failedMessage && !limitReached && (
              <button type="button" onClick={handleRetry}>
                다시 시도
              </button>
            )}
          </p>
        )}

        <form
          className="ai-chat-input"
          onSubmit={(event) => {
            event.preventDefault();
            handleSend();
          }}
        >
          <label htmlFor="ai-chat-textarea" className="ai-chat-input__label">
            메시지 입력
          </label>
          <textarea
            id="ai-chat-textarea"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={isSending || limitReached}
            placeholder={
              limitReached
                ? '오늘 사용 가능한 메시지 횟수를 다 썼어요. 내일 다시 이용해주세요.'
                : '학습에 대해 궁금한 걸 물어보세요.'
            }
          />
          <button type="submit" disabled={isSending || limitReached || !isValidMessage(input)}>
            전송
          </button>
        </form>
      </main>
    </div>
  );
};

export default AiChat;
