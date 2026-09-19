'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Script from 'next/script';

export default function AddressSearch({ onSelect }: { onSelect: (address: string) => void }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const selectAddress = useEffectEvent((address: string) => onSelect(address));

  useEffect(() => {
    if (!open || !ready || !container.current || !window.daum?.Postcode) return;
    const target = container.current;
    new window.daum.Postcode({
      width: '100%', height: 400, minWidth: 200,
      oncomplete: data => { selectAddress(data.address); setOpen(false); },
    }).embed(target);

    return () => { target.replaceChildren(); };
  }, [open, ready]);

  return <>
    <Script src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
      onReady={() => setReady(true)}
      onError={() => setError('주소 검색을 불러오지 못했습니다. 새로고침하거나 주소를 직접 입력해 주세요.')} />
    <button type="button" aria-expanded={open} aria-controls="signup-address-search"
      onClick={() => setOpen(value => !value)}
      className="px-4 py-2 rounded-xl bg-sky-100 text-sky-700 font-semibold hover:bg-sky-200">
      {open ? '주소 검색 닫기' : '주소 검색'}
    </button>
    {error && <p role="status" className="text-sm text-amber-700">{error}</p>}
    <div id="signup-address-search" hidden={!open} className="w-full basis-full border border-gray-200 rounded-xl overflow-hidden">
      {!ready && <p role="status" className="p-3 text-sm text-gray-500">주소 검색을 불러오는 중입니다.</p>}
      <div ref={container} />
    </div>
  </>;
}
