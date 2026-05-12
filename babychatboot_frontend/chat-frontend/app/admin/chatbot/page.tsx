'use client';

import { useEffect, useState } from 'react';
import api from '../../lib/axios';

interface Config {
  id: number;
  configKey: string;
  configValue: string;
  description: string;
  updatedAt: string;
}

interface ChatRoomResult {
  id: string;
  title: string;
  userId: number;
  userNickname: string;
  userName: string;
  createdAt: string;
  messageCount: number;
}

interface ChatMsg {
  id: number;
  role: string;
  content: string;
  createdAt: string;
}

const CONFIG_LABELS: Record<string, string> = {
  system_prompt:      '시스템 프롬프트',
  bot_name:           '챗봇 이름',
  rag_top_k:          'RAG 검색 문서 수',
  welcome_message:    '웰컴 메시지',
  off_topic_response: '관련 없는 질문 거절 메시지',
  rag_chunk_size:     '청킹 크기 (토큰)',
  rag_chunk_overlap:  '청크 겹침 크기 (토큰)',
};

export default function AdminChatbotPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'chat'>('config');

  // ── 챗봇 설정 상태 ──
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  // ── RAG 슬라이더 상태 ──
  const [ragTopK, setRagTopK] = useState(5);
  const [ragChunkSize, setRagChunkSize] = useState(512);
  const [ragChunkOverlap, setRagChunkOverlap] = useState(64);
  const [ragSaving, setRagSaving] = useState(false);
  const [ragSaved, setRagSaved] = useState(false);

  // ── 채팅 검색 상태 ──
  const [searchType, setSearchType] = useState('nickname');
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chatResults, setChatResults] = useState<ChatRoomResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null);
  const [roomMessages, setRoomMessages] = useState<Record<string, ChatMsg[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  const loadConfigs = () => {
    setLoading(true);
    api.get('/api/admin/chatbot/configs')
      .then(res => {
        setConfigs(res.data);
        const map: Record<string, string> = {};
        (res.data as Config[]).forEach(c => { map[c.configKey] = c.configValue; });
        if (map.rag_top_k)       setRagTopK(parseInt(map.rag_top_k) || 5);
        if (map.rag_chunk_size)  setRagChunkSize(parseInt(map.rag_chunk_size) || 512);
        if (map.rag_chunk_overlap) setRagChunkOverlap(parseInt(map.rag_chunk_overlap) || 64);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadConfigs(); }, []);

  const saveRagSettings = async () => {
    setRagSaving(true);
    try {
      await Promise.all([
        api.put('/api/admin/chatbot/configs', { key: 'rag_top_k',       value: String(ragTopK) }),
        api.put('/api/admin/chatbot/configs', { key: 'rag_chunk_size',   value: String(ragChunkSize) }),
        api.put('/api/admin/chatbot/configs', { key: 'rag_chunk_overlap', value: String(ragChunkOverlap) }),
      ]);
      setRagSaved(true);
      setTimeout(() => setRagSaved(false), 2000);
      loadConfigs();
    } catch (e) { console.error(e); }
    finally { setRagSaving(false); }
  };

  const startEdit = (config: Config) => {
    setEditKey(config.configKey);
    setEditValue(config.configValue);
  };

  const handleSave = async (key: string) => {
    setSaving(true);
    try {
      await api.put('/api/admin/chatbot/configs', { key, value: editValue });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
      setEditKey(null);
      loadConfigs();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    setExpandedRoom(null);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) {
        params.append('searchType', searchType);
        params.append('keyword', keyword.trim());
      }
      if (startDate) params.append('startDate', startDate);
      if (endDate)   params.append('endDate', endDate);
      const res = await api.get(`/api/admin/chats?${params.toString()}`);
      setChatResults(res.data);
    } catch (e) {
      console.error(e);
      alert('채팅 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleRoom = async (roomId: string, nickname: string) => {
    if (expandedRoom === roomId) { setExpandedRoom(null); return; }
    if (roomMessages[roomId]) { setExpandedRoom(roomId); return; }
    setLoadingMessages(roomId);
    try {
      const res = await api.get(`/api/admin/chats/${roomId}/messages`);
      setRoomMessages(prev => ({ ...prev, [roomId]: res.data }));
      setExpandedRoom(roomId);
    } catch {
      alert('메시지를 불러올 수 없습니다.');
    } finally {
      setLoadingMessages(null);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const isLongText = (key: string) =>
    key === 'system_prompt' || key === 'off_topic_response' || key === 'welcome_message';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">챗봇 관리</h1>
        <p className="text-sm text-gray-500 mt-1">AI 챗봇 동작 설정 및 채팅 내역 검색</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('config')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'config'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          ⚙️ 챗봇 설정
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
            activeTab === 'chat'
              ? 'border-sky-500 text-sky-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          💬 채팅 검색
        </button>
      </div>

      {/* ── 챗봇 설정 탭 ── */}
      {activeTab === 'config' && (
        <div>
          {/* RAG / 청킹 설정 슬라이더 카드 */}
          {!loading && (
            <div className="bg-white rounded-2xl border border-sky-100 shadow-sm p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-gray-800">RAG / 청킹 설정</p>
                  <p className="text-xs text-gray-400 mt-0.5">검색 품질과 응답 정확도를 조절합니다</p>
                </div>
                <div className="flex items-center gap-2">
                  {ragSaved && <span className="text-xs text-green-600 font-medium">저장됨 ✓</span>}
                  <button
                    onClick={saveRagSettings} disabled={ragSaving}
                    className="px-4 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 disabled:opacity-50 transition"
                  >
                    {ragSaving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm text-gray-700 font-medium">검색 문서 수 (rag_top_k)</label>
                    <span className="text-sm font-bold text-sky-500 w-8 text-right">{ragTopK}</span>
                  </div>
                  <input type="range" min={1} max={20} step={1} value={ragTopK}
                    onChange={e => setRagTopK(Number(e.target.value))}
                    className="w-full h-2 rounded-full accent-sky-500 cursor-pointer" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>권장: 3–10</span><span>20</span></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm text-gray-700 font-medium">청킹 크기 (rag_chunk_size)</label>
                    <span className="text-sm font-bold text-sky-500 w-12 text-right">{ragChunkSize}</span>
                  </div>
                  <input type="range" min={128} max={2048} step={64} value={ragChunkSize}
                    onChange={e => setRagChunkSize(Number(e.target.value))}
                    className="w-full h-2 rounded-full accent-sky-500 cursor-pointer" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>128</span><span>권장: 512</span><span>2048</span></div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-sm text-gray-700 font-medium">청크 겹침 (rag_chunk_overlap)</label>
                    <span className="text-sm font-bold text-sky-500 w-12 text-right">{ragChunkOverlap}</span>
                  </div>
                  <input type="range" min={0} max={512} step={32} value={ragChunkOverlap}
                    onChange={e => setRagChunkOverlap(Number(e.target.value))}
                    className="w-full h-2 rounded-full accent-sky-500 cursor-pointer" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0</span><span>권장: 64</span><span>512</span></div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map(config => (
                <div key={config.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {CONFIG_LABELS[config.configKey] ?? config.configKey}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {saved === config.configKey && (
                        <span className="text-xs text-green-600 font-medium">저장됨 ✓</span>
                      )}
                      <span className="text-xs text-gray-400">{fmtDate(config.updatedAt)}</span>
                      {editKey !== config.configKey && (
                        <button
                          onClick={() => startEdit(config)}
                          className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs hover:bg-gray-200 transition"
                        >
                          편집
                        </button>
                      )}
                    </div>
                  </div>

                  {editKey === config.configKey ? (
                    <div>
                      {isLongText(config.configKey) ? (
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-sky-400 resize-y"
                        />
                      ) : (
                        <input
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-sky-400"
                        />
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setEditKey(null)}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleSave(config.configKey)}
                          disabled={saving}
                          className="px-3 py-1.5 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 disabled:opacity-50"
                        >
                          {saving ? '저장 중...' : '저장'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap ${
                      isLongText(config.configKey) ? 'bg-gray-50 font-mono max-h-40 overflow-y-auto' : 'bg-gray-50'
                    }`}>
                      {config.configValue}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-sm font-medium text-blue-700 mb-1">현재 챗봇 설정 안내</p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li>• <strong>시스템 프롬프트</strong>: AI의 역할과 답변 규칙을 정의합니다. 변경 후 새 채팅방에 적용됩니다.</li>
              <li>• <strong>RAG 검색 문서 수</strong>: 질문당 참고할 지식 문서 개수입니다. (권장: 3~10)</li>
              <li>• <strong>변경 사항</strong>: 새로운 채팅 세션부터 적용됩니다. 기존 채팅방은 영향받지 않습니다.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── 채팅 검색 탭 ── */}
      {activeTab === 'chat' && (
        <div>
          {/* 기간 설정 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">기간 설정</p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
              />
              <span className="text-gray-400 font-medium">~</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="px-3 py-2 rounded-xl text-xs text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                >
                  기간 초기화
                </button>
              )}
            </div>
          </div>

          {/* 검색 필드 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">검색</p>
            <div className="flex flex-wrap gap-2">
              <select
                value={searchType}
                onChange={e => setSearchType(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-400 bg-white text-gray-700"
              >
                <option value="nickname">닉네임</option>
                <option value="userId">유저 아이디</option>
                <option value="babyName">아기 이름</option>
              </select>
              <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                placeholder={
                  searchType === 'userId'   ? '유저 아이디 번호 입력' :
                  searchType === 'babyName' ? '아기 이름 입력' : '닉네임 입력'
                }
                className="flex-1 min-w-48 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-5 py-2 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 disabled:opacity-50 transition flex items-center gap-2"
              >
                {isSearching ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> 검색 중</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    검색
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">검색어 없이 기간만 설정해도 검색 가능합니다.</p>
          </div>

          {/* 검색 결과 */}
          {hasSearched && !isSearching && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                {chatResults.length > 0
                  ? `${chatResults.length}개의 채팅방을 찾았습니다`
                  : '검색 결과가 없습니다'}
              </p>

              {chatResults.length === 0 ? (
                <div className="text-center py-16 text-gray-300">
                  <p className="text-5xl mb-4">💬</p>
                  <p className="text-sm">조건에 맞는 채팅방이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatResults.map(room => (
                    <div key={room.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      {/* 채팅방 요약 */}
                      <div className="flex items-center justify-between px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 truncate">{room.title}</p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                            <span className="text-xs text-gray-500">
                              <span className="text-gray-400">ID</span> {room.userId}
                            </span>
                            <span className="text-xs text-gray-500">
                              <span className="text-gray-400">닉네임</span> {room.userNickname}
                            </span>
                            <span className="text-xs text-gray-500">
                              <span className="text-gray-400">이름</span> {room.userName}
                            </span>
                            <span className="text-xs text-gray-400">{fmtDate(room.createdAt)}</span>
                            <span className="text-xs text-gray-400">메시지 {room.messageCount}개</span>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleRoom(room.id, room.userNickname)}
                          disabled={loadingMessages === room.id}
                          className="ml-4 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5 flex-shrink-0"
                        >
                          {loadingMessages === room.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                          ) : expandedRoom === room.id ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              접기
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              대화 보기
                            </>
                          )}
                        </button>
                      </div>

                      {/* 메시지 펼치기 */}
                      {expandedRoom === room.id && roomMessages[room.id] && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 max-h-96 overflow-y-auto space-y-3">
                          {roomMessages[room.id].filter(m => m.role !== 'SYSTEM').length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">메시지가 없습니다</p>
                          ) : (
                            roomMessages[room.id]
                              .filter(m => m.role !== 'SYSTEM')
                              .map(msg => (
                                <div
                                  key={msg.id}
                                  className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div className={`max-w-[80%] ${msg.role === 'USER' ? '' : ''}`}>
                                    <p className={`text-[10px] mb-1 ${msg.role === 'USER' ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                                      {msg.role === 'USER' ? room.userNickname : '🩺 닥터 의비스'}
                                      {' · '}
                                      {new Date(msg.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <div className={`px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                                      msg.role === 'USER'
                                        ? 'bg-sky-500 text-white rounded-tr-sm'
                                        : 'bg-white text-gray-700 border border-gray-200 rounded-tl-sm shadow-sm'
                                    }`}>
                                      {msg.content}
                                    </div>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hasSearched && (
            <div className="text-center py-16 text-gray-300">
              <p className="text-5xl mb-4">🔍</p>
              <p className="text-sm text-gray-400">기간이나 검색어를 입력하고 검색하세요</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
