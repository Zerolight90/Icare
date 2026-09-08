"use client";

import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '../lib/axios';
import ReactMarkdown from 'react-markdown';
import { isAxiosError } from 'axios';
import { RoomRequests } from '../lib/room-requests';

const NAV_LINKS = [
  { href: '/',          icon: '🏠', label: '메인' },
  { href: '/community', icon: '💬', label: '커뮤니티' },
  { href: '/hospitals', icon: '🏥', label: '병원찾기' },
  { href: '/dailylog',  icon: '📅', label: '일과표' },
  { href: '/babies',    icon: '👶', label: '아이관리' },
  { href: '/mypage',    icon: '👤', label: '마이페이지' },
];

interface ChatRoom { id: string; title: string; contextVersion: number; contextBabyId: number | null; }
interface BabyChoice { id: number; name: string; }
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
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [babies, setBabies] = useState<BabyChoice[]>([]);
  const [newBabyId, setNewBabyId] = useState('');
  const [chatError, setChatError] = useState('');
  const requestTracker = useRef(new RoomRequests());
  const sending = useRef(false);
  const currentRoom = rooms.find(room => room.id === currentRoomId);
  const contextReady = currentRoom?.contextVersion === 1;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectRoom = useCallback((id: string) => {
    if (requestTracker.current.current() === id) return;
    requestTracker.current.select(id);
    setCurrentRoomId(id); setMessages([]); setInput(''); setChatError('');
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get<ChatRoom[]>('/api/chat/rooms');
      setRooms(res.data);
      if (res.data.length && !requestTracker.current.current()) selectRoom(res.data[0].id);
    } catch { /* The authenticated API rejects unauthenticated readers. */ }
  }, [selectRoom]);

  useEffect(() => {
    void fetchRooms();
    api.get('/api/categories').then(r => setCategories(r.data)).catch(() => {});
    api.get<BabyChoice[]>('/api/babies').then(r => setBabies(r.data)).catch(() => setBabies([]));
  }, [fetchRooms]);

  useEffect(() => {
    if (!currentRoomId) return;
    const controller = new AbortController();
    const ticket = requestTracker.current.begin(currentRoomId);
    const load = async () => {
      setIsRoomLoading(true);
      try {
        const res = await api.get(`/api/chat/rooms/${currentRoomId}/messages`, { signal: controller.signal });
        if (requestTracker.current.accepts(ticket)) setMessages(res.data);
      } catch {
        if (!controller.signal.aborted && requestTracker.current.accepts(ticket)) setChatError('대화를 불러오지 못했습니다.');
      } finally {
        if (requestTracker.current.accepts(ticket)) setIsRoomLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [currentRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`; }
  }, [input]);

  const handleCreateRoom = async () => {
    const params = new URLSearchParams({ title: newRoomTitle.trim() || '새 육아 상담' });
    if (newBabyId) params.set('babyId', newBabyId);
    try {
      const res = await api.post('/api/chat/rooms', params);
      await fetchRooms();
      selectRoom(res.data.id);
      setIsCreating(false); setNewRoomTitle(''); setNewBabyId('');
      setIsMobileSidebarOpen(false);
    } catch { alert('상담을 만들지 못했습니다. 로그인과 선택한 아이 정보를 확인해 주세요.'); }
  };

  const handleSend = async (quickMessage?: string) => {
    const question = quickMessage || input.trim();
    if (!question || sending.current || isRoomLoading || !currentRoomId || !contextReady) return;
    if (question.length > 4000) { setChatError('질문은 4,000자 이내로 입력해 주세요.'); return; }
    const roomId = currentRoomId;
    const sendTicket = requestTracker.current.begin(roomId);
    let responseTicket = sendTicket;
    let answerSaved = false;
    const tempMsg: ChatMessage = { id: Date.now(), role: 'USER', content: question, createdAt: new Date().toISOString() };
    sending.current = true; setInput(''); setChatError(''); setIsLoading(true);
    setMessages(prev => [...prev, tempMsg]);
    try {
      await api.post('/api/chat/message', new URLSearchParams({ roomId, message: question }));
      answerSaved = true;
      if (requestTracker.current.current() !== roomId) return;
      const ticket = requestTracker.current.begin(roomId);
      responseTicket = ticket;
      const res = await api.get(`/api/chat/rooms/${roomId}/messages`);
      if (requestTracker.current.accepts(ticket)) { setMessages(res.data); setIsRoomLoading(false); }
    } catch (error) {
      if (requestTracker.current.accepts(responseTicket)) {
        if (!answerSaved) {
          setMessages(prev => prev.filter(message => message.id !== tempMsg.id));
          setInput(question);
        }
        const data = isAxiosError(error) ? error.response?.data : null;
        const message = typeof data === 'string' ? data : data?.error;
        setChatError(typeof message === 'string' ? message : '응답을 확인하지 못했습니다. 대화 기록을 확인한 뒤 다시 시도해 주세요.');
      }
    } finally { sending.current = false; setIsLoading(false); }
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openNewChat = () => { setNewBabyId(''); setIsCreating(true); setIsMobileSidebarOpen(true); };

  // 사이드바 내용 컴포넌트 (모바일 오버레이 + 데스크탑 공통)
  const renderSidebar = (onClose?: () => void) => (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-gray-100 bg-gradient-to-r from-sky-50 to-white">
        <Link href="/" className="flex items-center gap-2 flex-1 min-w-0">
          <Image src="/logo.png" alt="iCare" width={32} height={32} className="rounded-xl flex-shrink-0 shadow-sm" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-800 leading-tight">iCare</p>
            <p className="text-[10px] text-gray-400 leading-tight">AI 육아 상담</p>
          </div>
        </Link>
        <button
          onClick={() => { setNewBabyId(''); setIsCreating(true); }}
          className="p-2 rounded-xl text-gray-400 hover:text-sky-500 hover:bg-sky-50 transition flex-shrink-0"
          title="새 채팅"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        {onClose && (
          <button onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition flex-shrink-0 md:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 새 채팅 입력 */}
      {isCreating && (
        <div className="px-3 py-2.5 border-b border-gray-100 bg-sky-50/50">
          <label className="block text-xs text-gray-600 mb-1" htmlFor={onClose ? 'chat-baby-mobile' : 'chat-baby-desktop'}>상담할 아이</label>
          <select id={onClose ? 'chat-baby-mobile' : 'chat-baby-desktop'} value={newBabyId} onChange={e => setNewBabyId(e.target.value)}
            className="w-full border border-sky-200 rounded-xl px-3 py-2 mb-2 text-sm bg-white text-gray-800">
            <option value="">일반 상담 · 아이 정보 사용 안 함</option>
            {babies.map(baby => <option key={baby.id} value={baby.id}>{baby.name}</option>)}
          </select>
          <input
            autoFocus value={newRoomTitle} maxLength={120}
            onChange={e => setNewRoomTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreateRoom();
              if (e.key === 'Escape') { setIsCreating(false); setNewRoomTitle(''); }
            }}
            placeholder="상담 제목 입력 후 Enter"
            className="w-full bg-white border border-sky-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition"
          />
          <button onClick={handleCreateRoom} className="mt-2 px-3 py-2 bg-sky-500 text-white rounded-xl text-xs">상담 시작</button>
        </div>
      )}

      {/* 빠른 상담 */}
      {categories.length > 0 && (
        <div className="px-3 pt-3 pb-2 border-b border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">빠른 상담</p>
          <div className="grid grid-cols-2 gap-1">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  if (currentRoomId) {
                    handleSend(`${cat.name}에 대해서 상담하고 싶어요.`);
                    if (onClose) onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:text-sky-600 hover:bg-sky-50 transition border border-gray-100 hover:border-sky-200"
              >
                <span className="text-sm">{cat.icon}</span>
                <span className="truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto p-2">
        {rooms.length > 0 && (
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 pt-1 pb-2">
            최근 상담
          </p>
        )}
        {rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-3xl mb-2">💬</span>
            <p className="text-xs text-gray-400">상담 기록이 없습니다</p>
          </div>
        )}
        <div className="space-y-0.5">
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => { selectRoom(room.id); if (onClose) onClose(); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs truncate transition-all ${
                currentRoomId === room.id
                  ? 'bg-sky-50 text-sky-700 font-semibold border border-sky-100'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <span className="mr-1.5 opacity-60">💬</span>
              {room.title}
            </button>
          ))}
        </div>
      </div>

      {/* 페이지 바로가기 */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">바로가기</p>
        <div className="grid grid-cols-3 gap-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href} href={link.href}
              className="flex flex-col items-center gap-0.5 py-2 rounded-xl text-gray-500 hover:bg-sky-50 hover:text-sky-600 transition text-center"
            >
              <span className="text-base">{link.icon}</span>
              <span className="text-[10px] leading-tight">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-50">

      {/* ── 모바일 백드롭 ── */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* ── 사이드바 (모바일: 슬라이드 오버레이 / 데스크탑: 영구 고정) ── */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full z-50 md:z-auto
        w-64 flex flex-col flex-shrink-0
        bg-white border-r border-gray-200 shadow-xl md:shadow-none
        transition-transform duration-200 ease-in-out md:translate-x-0
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {renderSidebar(() => setIsMobileSidebarOpen(false))}
      </aside>

      {/* ── 메인 채팅 영역 ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* 탑바 */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-200 bg-white flex-shrink-0 shadow-sm">
          {/* 모바일 햄버거 */}
          <button
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition md:hidden"
            onClick={() => setIsMobileSidebarOpen(true)}
            title="메뉴"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* 봇 정보 */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center shadow-sm">
                <span className="text-sm">🩺</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
            </div>
            <div>
              <span className="font-semibold text-gray-800 text-sm block leading-tight">iCare 육아 안내</span>
              <span className="text-[10px] text-green-500 font-medium">온라인</span>
            </div>
          </div>

          {/* 우측 버튼들 */}
          <div className="ml-auto flex items-center gap-2">
            {currentRoomId && (
              <span className="text-xs text-gray-400 hidden sm:block truncate max-w-36 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100">
                {rooms.find(r => r.id === currentRoomId)?.title ?? ''}
              </span>
            )}
            <Link href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-500 hover:text-sky-600 hover:bg-sky-50 border border-gray-200 hover:border-sky-200 transition"
              title="메인으로"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="hidden sm:inline">홈</span>
            </Link>
            <button
              onClick={openNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-white bg-sky-500 hover:bg-sky-600 transition shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 채팅
            </button>
          </div>
        </div>

        {/* 메시지 영역 */}
        <div className="flex-1 overflow-y-auto"
          style={{ background: 'linear-gradient(180deg, #f0f9ff 0%, #f9fafb 40%)' }}>
          <div className="max-w-3xl mx-auto px-4 py-8">

            {isRoomLoading && (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin" />
                  <p className="text-xs text-gray-400">대화를 불러오는 중...</p>
                </div>
              </div>
            )}

            {!currentRoomId && !isRoomLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-sky-50 border-2 border-sky-100 flex items-center justify-center shadow-lg shadow-sky-100">
                    <Image src="/logo.png" alt="iCare" width={72} height={72} className="rounded-2xl" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full border-2 border-sky-100 flex items-center justify-center shadow-sm">
                    <span className="text-base">🩺</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">iCare에 오신 걸 환영해요</h2>
                <p className="text-sm text-gray-500 mb-8 max-w-sm leading-relaxed">
                  iCare 육아 안내가 육아 고민을<br/>RAG 기반 최신 지식으로 도와드립니다
                </p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-sm">
                    {categories.map(cat => (
                      <span key={cat.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-sky-100 bg-white text-xs text-gray-500 shadow-sm">
                        <span>{cat.icon}</span>{cat.name}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={openNewChat}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition shadow-md shadow-sky-200 hover:shadow-lg hover:shadow-sky-200"
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
                <div className="w-16 h-16 rounded-2xl bg-white border border-sky-100 shadow-sm flex items-center justify-center mb-4">
                  <span className="text-3xl">💬</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1.5">무엇이 궁금하신가요?</h2>
                <p className="text-sm text-gray-400 mb-6">육아, 수면, 수유, 발달 등 무엇이든 물어보세요</p>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center max-w-md">
                    {categories.map(cat => (
                      <button key={cat.id}
                        onClick={() => handleSend(`${cat.name}에 대해서 상담하고 싶어요.`)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-600 hover:text-sky-600 hover:bg-sky-50 hover:border-sky-200 transition shadow-sm"
                      >
                        <span>{cat.icon}</span>{cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 메시지 목록 */}
            <div className="space-y-5">
              {messages.map(msg => {
                if (msg.role === 'SYSTEM') return null;
                const isUser = msg.role === 'USER';
                return (
                  <div key={msg.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <span className="text-sm">🩺</span>
                      </div>
                    )}
                    <div className={`${isUser ? 'max-w-[75%]' : 'flex-1 min-w-0'}`}>
                      {!isUser && (
                        <span className="text-xs font-semibold text-sky-500 mb-1.5 block">iCare 육아 안내</span>
                      )}
                      {isUser ? (
                        <div className="px-4 py-3 rounded-2xl rounded-tr-md text-sm leading-relaxed text-white bg-gradient-to-br from-sky-500 to-sky-600 whitespace-pre-wrap shadow-md shadow-sky-100">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="text-gray-700 text-sm leading-7 bg-white rounded-2xl rounded-tl-md border border-gray-100 px-4 py-3 shadow-sm
                          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-4 [&_h1]:mb-2
                          [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h2]:mt-4 [&_h2]:mb-2
                          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h3]:mt-3 [&_h3]:mb-1.5
                          [&_p]:my-2 [&_p]:leading-7
                          [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:space-y-1
                          [&_ol]:my-2 [&_ol]:pl-5 [&_ol]:space-y-1
                          [&_li]:text-gray-700 [&_li]:leading-6
                          [&_strong]:text-gray-900 [&_strong]:font-semibold
                          [&_em]:text-gray-500 [&_em]:italic
                          [&_blockquote]:border-l-2 [&_blockquote]:border-sky-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 [&_blockquote]:my-3 [&_blockquote]:bg-sky-50/50 [&_blockquote]:py-1 [&_blockquote]:rounded-r
                          [&_code]:text-sky-600 [&_code]:bg-sky-50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
                          [&_pre]:bg-gray-50 [&_pre]:border [&_pre]:border-gray-200 [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto
                          [&_hr]:border-gray-200 [&_hr]:my-4
                          [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
                          [&_th]:bg-sky-50 [&_th]:border [&_th]:border-gray-200 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-700
                          [&_td]:border [&_td]:border-gray-100 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                      <span className={`text-[10px] text-gray-400 mt-1 block ${isUser ? 'text-right' : ''}`}>
                        {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm">👤</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 로딩 애니메이션 */}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <span className="text-sm">🩺</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-sky-500 mb-1.5 block">iCare 육아 안내</span>
                    <div className="flex items-center gap-1.5 py-3 px-4 bg-white rounded-2xl rounded-tl-md border border-gray-100 shadow-sm w-fit">
                      {[0, 160, 320].map(d => (
                        <span key={d} className="w-2 h-2 bg-sky-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${d}ms` }} />
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
        <div className="border-t border-gray-200 bg-white/90 backdrop-blur-sm px-4 pb-5 pt-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {currentRoom && <p className="text-xs text-gray-500 mb-2">
              {!contextReady ? '이전 상담은 기록 조회만 가능합니다. 새 상담에서 아이 또는 일반 상담을 선택해 주세요.'
                : currentRoom.contextBabyId == null ? '일반 상담 · 등록된 아이 프로필을 사용하지 않습니다.'
                : `상담 대상: ${babies.find(baby => baby.id === currentRoom.contextBabyId)?.name ?? '선택한 아이'} · 다른 아이 상담은 새 대화에서 시작해 주세요.`}
            </p>}
            {chatError && <p role="alert" className="text-sm text-red-600 mb-2">{chatError}</p>}
            <div className={`relative rounded-2xl border bg-white transition-all shadow-sm ${
              currentRoomId && !isLoading
                ? 'border-gray-200 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-100 focus-within:shadow-md'
                : 'border-gray-100 opacity-60'
            }`}>
              <textarea
                ref={textareaRef}
                value={input}
                maxLength={4000}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentRoomId
                  ? '메시지를 입력하세요... (Shift+Enter 줄바꿈)'
                  : '새 채팅을 시작하거나 채팅방을 선택하세요'}
                disabled={isLoading || isRoomLoading || !currentRoomId || !contextReady}
                rows={1}
                className="w-full bg-transparent text-gray-800 placeholder-gray-400 px-4 py-3.5 pr-14 resize-none outline-none text-sm leading-relaxed disabled:cursor-not-allowed"
                style={{ maxHeight: '200px' }}
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || isRoomLoading || !input.trim() || !currentRoomId || !contextReady}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                  input.trim() && !isLoading && currentRoomId
                    ? 'bg-sky-500 hover:bg-sky-600 text-white cursor-pointer shadow-md'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              iCare는 의료 진단을 대체할 수 없습니다. 정확한 진단은 전문의와 상담하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
