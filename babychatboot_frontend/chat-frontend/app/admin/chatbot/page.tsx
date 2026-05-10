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
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get('/api/admin/chatbot/configs')
      .then(res => setConfigs(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  const isLongText = (key: string) =>
    key === 'system_prompt' || key === 'off_topic_response' || key === 'welcome_message';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">챗봇 관리</h1>
        <p className="text-sm text-gray-500 mt-1">AI 챗봇 동작 설정 및 프롬프트 관리</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />
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
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-pink-400 resize-y"
                    />
                  ) : (
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-400"
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
                      className="px-3 py-1.5 rounded-lg bg-pink-500 text-white text-xs font-medium hover:bg-pink-600 disabled:opacity-50"
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
  );
}
