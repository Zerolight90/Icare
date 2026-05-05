"use client";

import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import api from '../lib/axios';
import ReactMarkdown from 'react-markdown';

interface ChatRoom { id: string; title: string; }
interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}
interface Category { id: number; name: string; icon: string; }

export default function ChatPage() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchRooms();
    api.get('/api/categories').then(r => setCategories(r.data)).catch(() => {});
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/api/chat/rooms');
      setRooms(res.data);
      if (res.data.length > 0 && !currentRoomId) setCurrentRoomId(res.data[0].id);
    } catch { /* not logged in */ }
  }, [currentRoomId]);

  useEffect(() => {
    if (!currentRoomId) return;
    const load = async () => {
      setIsRoomLoading(true);
      setMessages([]);
      try {
        const res = await api.get(`/api/chat/rooms/${currentRoomId}/messages`);
        setMessages(res.data);
      } finally { setIsRoomLoading(false); }
    };
    load();
  }, [currentRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; }
  }, [input]);

  const handleCreateRoom = async () => {
    const title = newRoomTitle.trim() || '새 육아 상담';
    setIsCreating(false);
    setNewRoomTitle('');
    try {
      const res = await api.post(`/api/chat/rooms?title=${encodeURIComponent(title)}`);
      await fetchRooms();
      setCurrentRoomId(res.data.id);
      setIsSidebarOpen(false);
    } catch { alert('방 생성에 실패했습니다. 로그인 후 이용해주세요.'); }
  };

  const handleSend = async (quickMessage?: string) => {
    const question = quickMessage || input.trim();
    if (!question || isLoading || !currentRoomId) return;
    setInput('');
    const tempMsg: ChatMessage = { id: Date.now(), role: 'USER', content: question, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    setIsLoading(true);
    try {
      await api.post(`/api/chat/message?roomId=${currentRoomId}&message=${encodeURIComponent(question)}`);
      const res = await api.get(`/api/chat/rooms/${currentRoomId}/messages`);
      setMessages(res.data);
    } catch { alert('연결이 끊어졌거나, 질문 한도를 초과했어요.'); }
    finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-50">

      {/* ── 사이드바 오버레이 ── */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 사이드바 패널 */}
          <div className="w-72 flex flex-col h-full flex-shrink-0 bg-white border-r border-gray-200 shadow-lg">
            {/* 상단: 닫기 + 새채팅 */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                title="메뉴 닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-gray-800 flex-1">iCare 상담</span>
              <button
                onClick={() => setIsCreating(true)}
                className="p-2 rounded-lg text-gray-400 hover:text-pink-500 hover:bg-pink-50 transition"
                title="새 채팅"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* 새 채팅 입력 */}
            {isCreating && (
              <div className="p-3 border-b border-gray-100 bg-pink-50/50">
                <input
                  autoFocus
                  value={newRoomTitle}
                  onChange={e => setNewRoomTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreateRoom();
                    if (e.key === 'Escape') { setIsCreating(false); setNewRoomTitle(''); }
                  }}
                  placeholder="상담 제목 (Enter)"
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100 transition"
                />
              </div>
            )}

            {/* 카테고리 */}
            {categories.length > 0 && (
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">빠른 상담</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        if (currentRoomId) {
                          handleSend(`${cat.name}에 대해서 상담하고 싶어요.`);
                          setIsSidebarOpen(false);
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:text-pink-600 hover:bg-pink-50 transition border border-gray-100 hover:border-pink-200"
                    >
                      <span>{cat.icon}</span>
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 채팅 목록 */}
            <div className="flex-1 overflow-y-auto p-2">
              {rooms.length > 0 && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 pt-2 pb-1.5">
                  최근 상담
                </p>
              )}
              {rooms.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">상담 기록이 없습니다</p>
              )}
              <div className="space-y-0.5">
                {rooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => { setCurrentRoomId(room.id); setIsSidebarOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm truncate transition-all ${
                      currentRoomId === room.id
                        ? 'bg-pink-50 text-pink-700 font-medium border border-pink-100'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <span className="text-gray-400 mr-1.5">💬</span>
                    {room.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2 px-2">
                <div className="w-7 h-7 rounded-full bg-pink-100 flex items-center justify-center">
                  <span className="text-xs">🍼</span>
                </div>
                <span className="text-xs text-gray-400">닥터 의비스 • iCare</span>
              </div>
            </div>
          </div>
          {/* 오버레이 닫기 영역 */}
          <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
        </div>
      )}

      {/* ── 메인 채팅 영역 ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 탑바 */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
          <button
            className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            onClick={() => setIsSidebarOpen(true)}
            title="메뉴"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-pink-100 border border-pink-200 flex items-center justify-center">
              <span className="text-sm">🩺</span>
            </div>
            <div>
              <span className="font-semibold text-gray-800 text-sm block leading-tight">닥터 의비스</span>
              <span className="text-xs text-gray-400">AI 육아 상담사</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {currentRoomId && (
              <span className="text-xs text-gray-400 font-mono hidden sm:block truncate max-w-32">
                {rooms.find(r => r.id === currentRoomId)?.title ?? ''}
              </span>
            )}
            <button
              onClick={() => { setIsCreating(true); setIsSidebarOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:text-pink-600 hover:bg-pink-50 border border-gray-200 hover:border-pink-200 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 채팅
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-3xl mx-auto px-4 py-8">

            {isRoomLoading && (
              <div className="flex items-center justify-center py-24">
                <div className="w-5 h-5 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin" />
              </div>
            )}

            {!currentRoomId && !isRoomLoading && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-3xl bg-pink-50 border border-pink-100 flex items-center justify-center mb-6">
                  <span className="text-4xl">🍼</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">iCare에 오신 걸 환영해요</h2>
                <p className="text-sm text-gray-500 mb-8 max-w-sm">소아과 전문의 닥터 의비스가 육아 고민을<br/>RAG 기반 최신 지식으로 도와드립니다</p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-md">
                    {categories.map(cat => (
                      <span key={cat.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs text-gray-500 shadow-sm">
                        <span>{cat.icon}</span>{cat.name}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => { setIsCreating(true); setIsSidebarOpen(true); }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium transition shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  새 상담 시작하기
                </button>
              </div>
            )}

            {currentRoomId && messages.length === 0 && !isRoomLoading && (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-2">무엇이 궁금하신가요?</h2>
                <p className="text-sm text-gray-500 mb-6">육아, 수면, 수유, 발달 등 무엇이든 물어보세요</p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center max-w-md">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleSend(`${cat.name}에 대해서 상담하고 싶어요.`)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-600 hover:text-pink-600 hover:bg-pink-50 hover:border-pink-200 transition shadow-sm"
                      >
                        <span>{cat.icon}</span>{cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 메시지 목록 */}
            <div className="space-y-6">
              {messages.map(msg => {
                if (msg.role === 'SYSTEM') return null;
                const isUser = msg.role === 'USER';
                return (
                  <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-sm">🩺</span>
                      </div>
                    )}
                    <div className={`${isUser ? 'max-w-[75%]' : 'flex-1 min-w-0'}`}>
                      {!isUser && (
                        <span className="text-xs font-semibold text-pink-500 mb-1.5 block">닥터 의비스</span>
                      )}
                      {isUser ? (
                        <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white bg-pink-500 whitespace-pre-wrap">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="text-gray-700 text-sm leading-7 bg-white rounded-2xl rounded-tl-sm border border-gray-100 px-4 py-3 shadow-sm
                          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-4 [&_h1]:mb-2
                          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:mt-4 [&_h2]:mb-2
                          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-3 [&_h3]:mb-1.5
                          [&_p]:my-2 [&_p]:leading-7
                          [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:space-y-1
                          [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:space-y-1
                          [&_li]:text-gray-700 [&_li]:leading-6
                          [&_strong]:text-gray-900 [&_strong]:font-semibold
                          [&_em]:text-gray-500 [&_em]:italic
                          [&_blockquote]:border-l-2 [&_blockquote]:border-pink-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 [&_blockquote]:my-3 [&_blockquote]:bg-pink-50/50 [&_blockquote]:py-1 [&_blockquote]:rounded-r
                          [&_code]:text-pink-600 [&_code]:bg-pink-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                          [&_pre]:bg-gray-50 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto
                          [&_hr]:border-gray-200 [&_hr]:my-4
                          [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
                          [&_th]:bg-pink-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-700
                          [&_td]:border [&_td]:border-gray-100 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                      <span className="text-xs text-gray-400 mt-1 block">
                        {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {isUser && (
                      <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-sm">👤</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-pink-100 border border-pink-200 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-sm">🩺</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-pink-500 mb-1.5 block">닥터 의비스</span>
                    <div className="flex items-center gap-1.5 py-2 px-4 bg-white rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm w-fit">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="border-t border-gray-200 bg-white px-4 pb-5 pt-3 flex-shrink-0 shadow-sm">
          <div className="max-w-3xl mx-auto">
            <div className="relative rounded-2xl border border-gray-200 bg-white focus-within:border-pink-400 focus-within:ring-2 focus-within:ring-pink-100 transition-all shadow-sm">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentRoomId ? '메시지를 입력하세요... (Shift+Enter 줄바꿈)' : '왼쪽 메뉴에서 상담방을 선택하거나 새 채팅을 시작하세요'}
                disabled={isLoading || !currentRoomId}
                rows={1}
                className="w-full bg-transparent text-gray-800 placeholder-gray-400 px-4 py-3.5 pr-14 resize-none outline-none text-sm leading-relaxed disabled:opacity-40"
                style={{ maxHeight: '200px' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim() || !currentRoomId}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                  input.trim() && !isLoading && currentRoomId
                    ? 'bg-pink-500 hover:bg-pink-600 text-white cursor-pointer shadow-md'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              iCare는 의료 진단을 대체할 수 없습니다. 정확한 진단은 전문의와 상담하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
