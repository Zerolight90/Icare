'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import api from '../lib/axios';
import Header from '../components/Header';

/* ── 도메인 타입 ── */
interface Hospital {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  phone: string;
  place_url: string;
  distance: string;
  x: string;
  y: string;
}

interface Location { x: number; y: number; }

/* ── 상수 ── */
const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1km',  value: 1000 },
  { label: '2km',  value: 2000 },
  { label: '5km',  value: 5000 },
];

const QUERY_OPTIONS = [
  { label: '소아청소년과', value: '소아청소년과' },
  { label: '소아과',       value: '소아과' },
  { label: '산부인과',     value: '산부인과' },
  { label: '어린이병원',   value: '어린이병원' },
];

const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? '';

export default function HospitalsPage() {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInst     = useRef<unknown>(null);
  const markers     = useRef<unknown[]>([]);
  const openInfo    = useRef<unknown>(null);

  const [hospitals,        setHospitals]        = useState<Hospital[]>([]);
  const [selected,         setSelected]         = useState<Hospital | null>(null);
  const [location,         setLocation]         = useState<Location | null>(null);
  const [locationLabel,    setLocationLabel]    = useState('');
  const [radius,           setRadius]           = useState(2000);
  const [query,            setQuery]            = useState('소아청소년과');
  const [sdkReady,         setSdkReady]         = useState(false);
  const [isLoading,        setIsLoading]        = useState(false);
  const [error,            setError]            = useState('');

  /* ── 지도 초기화 ── */
  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const center = new window.kakao.maps.LatLng(lat, lng);
    if (!mapInst.current) {
      mapInst.current = new window.kakao.maps.Map(mapRef.current, { center, level: 5 });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapInst.current as any).setCenter(center);
    }
  }, []);

  /* ── 마커 초기화 ── */
  const clearMarkers = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    markers.current.forEach(m => (m as any).setMap(null));
    markers.current = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (openInfo.current) (openInfo.current as any).close();
  };

  /* ── 마커 표시 ── */
  const addMarkers = useCallback((list: Hospital[], loc: Location | null) => {
    if (!mapInst.current || !window.kakao?.maps) return;
    clearMarkers();

    list.forEach((h, idx) => {
      const pos    = new window.kakao.maps.LatLng(Number(h.y), Number(h.x));
      const marker = new window.kakao.maps.Marker({ position: pos, map: mapInst.current });

      const infoContent = `
        <div style="padding:8px 12px;font-size:13px;min-width:140px">
          <strong>${h.place_name}</strong>
          ${h.phone ? `<br><span style="font-size:11px;color:#888">${h.phone}</span>` : ''}
        </div>`;
      const infoWin = new window.kakao.maps.InfoWindow({ content: infoContent });

      window.kakao.maps.event.addListener(marker, 'click', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (openInfo.current) (openInfo.current as any).close();
        infoWin.open(mapInst.current, marker);
        openInfo.current = infoWin;
        setSelected(h);
        document.getElementById(`h-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      markers.current.push(marker);
    });

    if (list.length > 0) {
      const bounds = new window.kakao.maps.LatLngBounds();
      list.forEach(h => bounds.extend(new window.kakao.maps.LatLng(Number(h.y), Number(h.x))));
      if (loc) bounds.extend(new window.kakao.maps.LatLng(loc.y, loc.x));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mapInst.current as any).setBounds(bounds);
    }
  }, []);

  /* ── 병원 검색 ── */
  const searchHospitals = useCallback(async (loc: Location) => {
    setIsLoading(true);
    setError('');
    setHospitals([]);
    try {
      const res = await api.get(
        `/api/hospitals?x=${loc.x}&y=${loc.y}&radius=${radius}&query=${encodeURIComponent(query)}`
      );
      const list: Hospital[] = res.data?.documents ?? [];
      setHospitals(list);
      addMarkers(list, loc);
      if (list.length === 0) setError('검색 결과가 없어요. 반경을 넓혀보세요.');
    } catch (e: unknown) {
      const err = e as { response?: { data?: string } };
      setError(err.response?.data ?? '병원 검색에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [radius, query, addMarkers]);

  /* ── Kakao SDK 로드 완료 ── */
  const handleSdkLoad = () => {
    window.kakao.maps.load(() => {
      setSdkReady(true);
      initMap(37.5665, 126.9780); // 기본: 서울 시청
    });
    if (!document.getElementById('daum-postcode')) {
      const s = document.createElement('script');
      s.id  = 'daum-postcode';
      s.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
      document.head.appendChild(s);
    }
  };

  /* ── 현재 위치 ── */
  const handleCurrentLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('이 브라우저는 위치 기능을 지원하지 않습니다. 주소를 직접 검색해주세요.');
      return;
    }
    // 모바일 브라우저는 HTTPS가 아니면 Geolocation을 허용하지 않음
    if (!window.isSecureContext) {
      setError('현재 위치 기능은 보안 연결(HTTPS)에서만 사용할 수 있습니다. 주소 검색을 이용해주세요.');
      return;
    }
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc: Location = { x: pos.coords.longitude, y: pos.coords.latitude };
        setLocation(loc);
        setLocationLabel('현재 위치');
        initMap(loc.y, loc.x);
        searchHospitals(loc);
      },
      err => {
        setIsLoading(false);
        if (err.code === 1) {
          setError('위치 권한이 거부됐습니다. 브라우저 설정에서 이 사이트의 위치 권한을 허용한 뒤 다시 시도하거나, 주소를 직접 검색해주세요.');
        } else if (err.code === 2) {
          setError('현재 위치를 가져올 수 없습니다. 주소를 직접 검색해주세요.');
        } else {
          setError('위치 요청이 시간 초과됐습니다. 주소를 직접 검색해주세요.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  /* ── 주소 검색 (Daum → Kakao Geocoder) ── */
  const handleAddressSearch = () => {
    if (!window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        const addr = data.roadAddress || data.address;
        setLocationLabel(addr);
        if (!window.kakao?.maps?.services) return;
        const geocoder = new window.kakao.maps.services.Geocoder();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geocoder.addressSearch(addr, (result: any[], status: string) => {
          if (status === window.kakao.maps.services.Status.OK) {
            const loc: Location = { x: Number(result[0].x), y: Number(result[0].y) };
            setLocation(loc);
            initMap(loc.y, loc.x);
            searchHospitals(loc);
          } else {
            setError('주소 좌표 변환에 실패했습니다.');
          }
        });
      },
    }).open();
  };

  /* ── 반경/유형 변경 시 재검색 ── */
  useEffect(() => {
    if (location) searchHospitals(location);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, query]);

  const fmtDist = (d: string) =>
    Number(d) >= 1000 ? `${(Number(d) / 1000).toFixed(1)}km` : `${d}m`;

  return (
    <div className="min-h-screen bg-gray-50">
      {KAKAO_MAP_KEY && (
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&libraries=services&autoload=false`}
          strategy="afterInteractive"
          onLoad={handleSdkLoad}
        />
      )}
      <Header />

      <div className="max-w-6xl mx-auto px-4 pt-24 pb-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">🏥 주변 병원 찾기</h1>

        {/* ── 검색 컨트롤 ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="space-y-3">

            {/* 위치 입력 — 모바일: 세로 배치, 데스크탑: 가로 배치 */}
            <div>
              <label className={lbl}>위치</label>
              <input
                value={locationLabel}
                readOnly
                placeholder="주소 검색 또는 현재 위치 사용"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 text-gray-700 placeholder-gray-400 cursor-default focus:outline-none mb-2"
              />
              <div className="flex gap-2">
                <button onClick={handleAddressSearch}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition">
                  🔍 주소 검색
                </button>
                <button onClick={handleCurrentLocation}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition">
                  📍 현재위치
                </button>
              </div>
            </div>

            {/* 병원 유형 + 검색 반경 */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[140px]">
                <label className={lbl}>병원 유형</label>
                <select value={query} onChange={e => setQuery(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-sky-400 transition bg-white">
                  {QUERY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-[160px]">
                <label className={lbl}>검색 반경</label>
                <div className="flex gap-1">
                  {RADIUS_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setRadius(o.value)}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition border ${
                        radius === o.value
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => location && searchHospitals(location)}
                disabled={isLoading || !location}
                className="px-5 py-2.5 rounded-xl bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition disabled:opacity-40 whitespace-nowrap w-full sm:w-auto">
                {isLoading ? '검색 중...' : '🔍 검색'}
              </button>
            </div>
          </div>

          {/* 안내 메시지 */}
          {error && <p className="text-sm text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
          {!KAKAO_MAP_KEY && (
            <p className="text-xs text-amber-500 mt-3 bg-amber-50 px-3 py-2 rounded-lg">
              ⚠️ Kakao 지도 API 키 미설정 — .env.local에{' '}
              <code className="font-mono">NEXT_PUBLIC_KAKAO_MAP_KEY</code>를 추가해주세요.
            </p>
          )}
        </div>

        {/* ── 지도 + 목록 ── */}
        <div className="flex flex-col lg:flex-row gap-4">

          {/* 지도 — 모바일: 300px, 데스크탑: 520px */}
          <div className="lg:flex-1 rounded-2xl overflow-hidden shadow-sm border border-gray-100 bg-gray-200 relative h-[300px] sm:h-[400px] lg:h-[520px]">
            <div ref={mapRef} className="w-full h-full" />
            {!sdkReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-gray-500">
                {KAKAO_MAP_KEY ? (
                  <>
                    <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-sm">지도 로딩 중...</p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl mb-3">🗺️</p>
                    <p className="text-sm font-medium text-gray-600">Kakao 지도 API 키가 필요합니다</p>
                    <p className="text-xs text-gray-400 mt-1">.env.local 설정 후 사용 가능합니다</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 병원 목록 */}
          <div className="lg:w-80 flex flex-col">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[300px] sm:h-[400px] lg:h-[520px]">

              {/* 헤더 */}
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800 text-sm">
                  검색 결과{' '}
                  <span className="text-sky-500 font-bold">{hospitals.length}</span>개
                </h2>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* 목록 */}
              <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {hospitals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center px-6">
                    <p className="text-4xl mb-3">🏥</p>
                    <p className="text-sm font-medium text-gray-500">
                      {location ? '검색 결과가 없어요' : '위치를 설정하고 검색하세요'}
                    </p>
                    {!location && (
                      <p className="text-xs mt-1">주소 검색 또는 현재 위치 버튼을 이용하세요</p>
                    )}
                  </div>
                ) : (
                  hospitals.map((h, idx) => (
                    <div
                      key={h.id}
                      id={`h-${idx}`}
                      onClick={() => {
                        setSelected(h);
                        if (mapInst.current && window.kakao?.maps) {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (mapInst.current as any).setCenter(
                            new window.kakao.maps.LatLng(Number(h.y), Number(h.x))
                          );
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (mapInst.current as any).setLevel(3);
                        }
                      }}
                      className={`px-4 py-3.5 cursor-pointer transition-colors ${
                        selected?.id === h.id
                          ? 'bg-sky-50 border-l-4 border-l-sky-500'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm leading-snug truncate">
                            {h.place_name}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {h.road_address_name || h.address_name}
                          </p>
                          {h.phone && (
                            <a href={`tel:${h.phone}`}
                              onClick={e => e.stopPropagation()}
                              className="text-xs text-blue-500 hover:underline mt-1 block">
                              📞 {h.phone}
                            </a>
                          )}
                        </div>
                        <span className="text-xs font-bold text-sky-500 flex-shrink-0 mt-0.5">
                          {fmtDist(h.distance)}
                        </span>
                      </div>

                      {/* 카카오맵 링크 */}
                      <div className="mt-2 flex gap-3">
                        <a href={h.place_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-gray-400 hover:text-sky-500 transition">
                          카카오맵 상세 →
                        </a>
                        {h.phone && (
                          <a href={`tel:${h.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-gray-400 hover:text-blue-500 transition">
                            전화 걸기 →
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const lbl = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5';
