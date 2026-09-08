import { NextRequest, NextResponse } from 'next/server';
import { forwardApi } from '../../lib/server/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const response = await forwardApi(request, path);
  return new NextResponse(response.body, { status: response.status, headers: response.headers });
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as HEAD };
