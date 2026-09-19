import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  deploymentId: process.env.NEXT_DEPLOYMENT_ID,
};
export default nextConfig;
