import { type NextRequest, NextResponse } from 'next/server';

import { parse } from './utils/parse';

export default function AppMiddleware(req: NextRequest) {
  const { fullPath, path } = parse(req);

  const sessionCookie = req.cookies.get('better-auth.session_token');
  const secureSessionCookie = req.cookies.get(
    '__Secure-better-auth.session_token'
  );

  if (
    !(sessionCookie || secureSessionCookie) &&
    path !== '/login' &&
    path !== '/sign-up'
  ) {
    return NextResponse.redirect(
      new URL(
        `/studio/login${path === '/' ? '' : `?next=${encodeURIComponent(fullPath)}`}`,
        req.url
      )
    );
  }

  return NextResponse.next();
}
