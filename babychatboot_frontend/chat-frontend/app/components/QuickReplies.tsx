'use client';

import { useEffect, useState } from 'react';
import api from '../lib/axios';

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface QuickRepliesProps {
  onSelect: (name: string) => void;
}

export default function QuickReplies({ onSelect }: QuickRepliesProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
      // 🟢 fetch 대신 api.get을 사용하면 인터셉터 처리가 되어 더 안전합니다.
      api.get('/api/categories')
        .then((res) => setCategories(res.data))
        .catch((err) => console.error('카테고리 로드 실패:', err));
  }, []);

  return (
    <div className="flex gap-2 p-4 overflow-x-auto no-scrollbar">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.name)}
          className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-full hover:bg-blue-50 hover:border-blue-200 transition-colors whitespace-nowrap shadow-sm text-sm"
        >
          <span>{cat.icon}</span>
          <span className="font-medium text-gray-700">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}