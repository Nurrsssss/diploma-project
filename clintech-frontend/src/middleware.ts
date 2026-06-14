import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // только audio
  if (!request.nextUrl.pathname.startsWith('/api/analysis/audio')) {
    return NextResponse.next()
  }

  // если тебе надо просто пропустить дальше — этого достаточно
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/analysis/audio/:path*'],
}
