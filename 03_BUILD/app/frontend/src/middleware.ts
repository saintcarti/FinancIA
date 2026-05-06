import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Routing simple:
 * - / → /landing (público, sin auth)
 * - /dashboard/** → requiere session Supabase (manejado client-side en layout)
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/']
};
