import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // .env.local에서 읽어옴
  withCredentials: true, // 필요한 경우 쿠키 포함
});

// 요청 인터셉터: 로컬 스토리지에서 토큰을 꺼내서 헤더에 붙여줌
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;