import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 프록시(Proxy) 설정!
  async rewrites() {
    return [
      {
        source: "/api/:path*", // 프론트에서 /api/... 로 시작하는 모든 요청을
        //destination: "http://backend:8080/api/:path*", // 도커 내부의 진짜 백엔드로 몰래 전달해라!
        destination: "http://localhost:8080/api/:path*", // 도커 내부의 진짜 백엔드로 몰래 전달해라!
      },
    ];
  },
};

export default nextConfig;
