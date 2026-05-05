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
    api.get('/api/categories')
      .then((res) => setCategories(res.data))
      .catch((err) => console.error('카테고리 로드 실패:', err));
  }, []);

  if (categories.length === 0) return null;

  return (
    <div className="flex gap-2 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.name)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 text-xs text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
        >
          <span>{cat.icon}</span>
          <span className="font-medium">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
