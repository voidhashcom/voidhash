import {
  DOCS_DOMAIN,
  STUDIO_DOMAIN,
  WWW_DOMAIN
} from '@voidhash/lib/constants';
import { type NextRequest, NextResponse } from 'next/server';
import AppMiddleware from './lib/middleware/app';
import { parse } from './lib/middleware/utils/parse';
// import { parse } from './lib/middleware/utils/parse';
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes (except /api/auth)
     * 2. /_next/ (Next.js internals)
     * 3. /_proxy/ (proxies for third-party services)
     * 4. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    '/((?!api/(?!auth)|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|manifest.json).*)'
  ]
};

const checkIsAllowedOrigin = (domain: string) => {
  const allowedOrigins = [WWW_DOMAIN, STUDIO_DOMAIN, DOCS_DOMAIN];
  return allowedOrigins.includes(domain);
};

export default function middleware(req: NextRequest) {
  const { path } = parse(req);

  if (path.startsWith('/api')) {
    const res = NextResponse.next();

    const origin = req.headers.get('Origin') ?? '';
    const isDevelopment = process.env.NEXT_PUBLIC_VERCEL_ENV === 'development';
    const isAllowedOrigin = isDevelopment || checkIsAllowedOrigin(origin);
    if (!isAllowedOrigin) {
      return res;
    }
    // add the CORS headers to the response
    res.headers.append('Access-Control-Allow-Credentials', 'true');
    res.headers.append('Access-Control-Allow-Origin', origin);
    res.headers.append(
      'Access-Control-Allow-Methods',
      'GET,DELETE,PATCH,POST,PUT'
    );
    res.headers.append(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    return res;
  }

  return AppMiddleware(req);
}
