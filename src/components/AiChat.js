// src/components/AiChat.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../lib/supabaseClient';
import { sendChatMessage, isValidMessage, MAX_MESSAGE_LENGTH } from '../lib/aiChat';
import { buildConversationTitle, DEFAULT_CONVERSATION_TITLE } from '../lib/conversations';
import ConfirmDialog from './ui/ConfirmDialog';
import './AiChat.css';

const MAX_TITLE_INPUT_LENGTH = 60;

export const AiChat = () => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [limitReached, setLimitReached] = useState(false);
  const [failedMessage, setFailedMessage] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [isListOpen, setIsListOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const renameInputRef = useRef(null);
  // 대화를 빠르게 전환할 때 늦게 도착한 응답이 최신 화면을 덮어쓰지 않게 한다.
  const loadRequestRef = useRef(0);

  const loadMessages = useCallback(async (conversationId) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    setIsMessagesLoading(true);
    setAnnouncement('대화를 불러오는 중입니다.');

    try {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (loadRequestRef.current !== requestId) return;
      setMessages((data || []).slice().reverse());
      setAnnouncement('대화를 불러왔습니다.');
    } finally {
      // 실패해도 로딩 상태에서 반드시 빠져나온다.
      // (TS-008: 실패 경로가 로딩 해제를 건너뛰면 화면이 영구히 멈춘다)
      if (loadRequestRef.current === requestId) {
        setIsMessagesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate('/login');
        return;
      }

      const { data } = await supabase
        .from('conversations')
        .select('id, title, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!isMounted) return;

      const list = data || [];
      setConversations(list);
      setIsLoading(false);

      if (list.length > 0) {
        setActiveId(list[0].id);
        loadMessages(list[0].id);
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [navigate, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (renamingId) {
      renameInputRef.current?.focus();
    }
  }, [renamingId]);

  const handleSelect = (conversationId) => {
    setIsListOpen(false);
    if (conversationId === activeId) return;

    setActiveId(conversationId);
    setMessages([]);
    setErrorMessage(null);
    setFailedMessage(null);
    loadMessages(conversationId);
  };

  const handleNewConversation = () => {
    // DB 행은 첫 메시지를 보낼 때 만든다. 버튼만 누르고 끝나면 빈 대화가 쌓인다.
    setIsListOpen(false);
    setActiveId(null);
    setMessages([]);
    setErrorMessage(null);
    setFailedMessage(null);
    setAnnouncement('새 대화를 시작합니다.');
    textareaRef.current?.focus();
  };

  const createConversation = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate('/login');
      return null;
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: DEFAULT_CONVERSATION_TITLE })
      .select('id, title, updated_at')
      .single();

    if (error || !data) return null;

    setConversations((prev) => [data, ...prev]);
    setActiveId(data.id);
    return data.id;
  };

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

    // 낙관적 말풍선을 그리기 "전"에 첫 메시지 여부를 판단한다.
    let conversationId = activeId;
    let isFirstMessage = messages.length === 0;

    if (!conversationId) {
      conversationId = await createConversation();
      if (!conversationId) {
        setIsSending(false);
        setErrorMessage('대화를 만들지 못했어요.');
        setFailedMessage(content);
        return;
      }
      isFirstMessage = true;
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
        conversationId,
        onDelta: (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        },
      });

      // Edge Function이 방금 갱신한 제목/정렬을 화면에도 반영한다(새로고침 없이).
      setConversations((prev) => {
        const target = prev.find((conversation) => conversation.id === conversationId);
        if (!target) return prev;
        const updated = isFirstMessage
          ? { ...target, title: buildConversationTitle(content) }
          : target;
        return [
          updated,
          ...prev.filter((conversation) => conversation.id !== conversationId),
        ];
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

  const startRename = (conversation) => {
    setRenamingId(conversation.id);
    setRenameValue(conversation.title);
  };

  const submitRename = async (event) => {
    event.preventDefault();

    const conversationId = renamingId;
    if (!conversationId) return;

    const trimmed = renameValue.trim();
    const nextTitle = trimmed.length === 0 ? DEFAULT_CONVERSATION_TITLE : trimmed;

    setRenamingId(null);
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId ? { ...conversation, title: nextTitle } : conversation
      )
    );

    const { error } = await supabase
      .from('conversations')
      .update({ title: nextTitle })
      .eq('id', conversationId);

    if (error) {
      setErrorMessage('이름을 바꾸지 못했어요.');
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;

    const { error } = await supabase.from('conversations').delete().eq('id', target.id);

    if (error) {
      setErrorMessage('대화를 삭제하지 못했어요.');
      return;
    }

    const remaining = conversations.filter((conversation) => conversation.id !== target.id);
    setConversations(remaining);
    setAnnouncement('대화를 삭제했습니다.');

    if (target.id === activeId) {
      const nextActiveId = remaining.length > 0 ? remaining[0].id : null;
      setActiveId(nextActiveId);
      setMessages([]);
      if (nextActiveId) {
        loadMessages(nextActiveId);
      }
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
          <button
            type="button"
            className="ai-chat-page__list-toggle"
            aria-expanded={isListOpen}
            aria-controls="ai-chat-conversations"
            onClick={() => setIsListOpen((open) => !open)}
          >
            대화 목록
          </button>
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
        <aside
          id="ai-chat-conversations"
          className={`ai-chat-conversations${
            isListOpen ? ' ai-chat-conversations--open' : ''
          }`}
        >
          <div className="ai-chat-conversations__head">
            <h2 className="ai-chat-conversations__heading">대화 목록</h2>
            <button
              type="button"
              className="ai-chat-conversations__new"
              onClick={handleNewConversation}
            >
              새 대화
            </button>
          </div>

          {conversations.length === 0 ? (
            <p className="ai-chat-conversations__empty">
              아직 대화가 없어요. 첫 질문을 보내면 대화가 만들어져요.
            </p>
          ) : (
            <ul className="ai-chat-conversations__list">
              {conversations.map((conversation) => (
                <li key={conversation.id} className="ai-chat-conversations__item">
                  {renamingId === conversation.id ? (
                    <form className="ai-chat-rename" onSubmit={submitRename}>
                      <label className="sr-only" htmlFor={`rename-${conversation.id}`}>
                        대화 이름
                      </label>
                      <input
                        id={`rename-${conversation.id}`}
                        className="ai-chat-rename__input"
                        ref={renameInputRef}
                        value={renameValue}
                        maxLength={MAX_TITLE_INPUT_LENGTH}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                      />
                      <button type="submit" className="ai-chat-rename__save">
                        저장
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ai-chat-conversations__select"
                        aria-current={conversation.id === activeId ? 'true' : undefined}
                        onClick={() => handleSelect(conversation.id)}
                      >
                        {conversation.title}
                      </button>
                      <span className="ai-chat-conversations__controls">
                        <button
                          type="button"
                          className="ai-chat-conversations__control"
                          aria-label={`${conversation.title} 이름 변경`}
                          onClick={() => startRename(conversation)}
                        >
                          이름
                        </button>
                        <button
                          type="button"
                          className="ai-chat-conversations__control"
                          aria-label={`${conversation.title} 삭제`}
                          onClick={() => setDeleteTarget(conversation)}
                        >
                          삭제
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="ai-chat-page__thread">
          <div aria-live="polite" className="sr-only">
            {announcement}
          </div>
          <div className="ai-chat-list">
            {isMessagesLoading ? (
              <p className="ai-chat-list__loading">대화를 불러오는 중이에요.</p>
            ) : messages.length === 0 ? (
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
              ref={textareaRef}
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
        </section>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          title="이 대화를 삭제할까요?"
          description={`"${deleteTarget.title}" 안의 메시지도 함께 사라져요. 되돌릴 수 없어요.`}
          confirmLabel="삭제"
          cancelLabel="취소"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default AiChat;
