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
        .order('created_at', { ascending: true });

      if (isMounted) {
        setMessages(data || []);
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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate('/login');
      return;
    }

    setErrorMessage(null);
    setFailedMessage(null);
    setIsSending(true);
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
    } catch (error) {
      if (error.message.includes('오늘 사용 가능한')) {
        setLimitReached(true);
      }
      setErrorMessage(error.message || '답변을 받지 못했어요.');
      setFailedMessage(content);
      setMessages((prev) => prev.slice(0, -1));
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
        <button type="button" className="ai-chat-page__home" onClick={() => navigate('/mypage')}>
          HOME
        </button>
      </header>

      <main className="ai-chat-page__main">
        <div className="ai-chat-list" aria-live="polite">
          {messages.length === 0 ? (
            <p className="ai-chat-list__empty">학습에 대해 궁금한 걸 물어보세요.</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`ai-chat-bubble ai-chat-bubble--${message.role}`}>
                {message.content}
              </div>
            ))
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
