import {
  API_HOSTNAMES,
  APP_HOSTNAMES,
  CHECKOUT_HOSTNAMES
} from '@voidhash/lib';
import type { NextRequest } from 'next/server';
import ApiMiddleware from './lib/middleware/api';
import AppMiddleware from './lib/middleware/app';
import CheckoutMiddleware from './lib/middleware/checkout';
import { parse } from './lib/middleware/utils/parse';
export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/ routes
     * 2. /_next/ (Next.js internals)
     * 3. /_proxy/ (proxies for third-party services)
     * 4. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
     */
    '/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|manifest.json).*)'
  ]
};

export default function middleware(req: NextRequest) {
  const { domain, path } = parse(req);

  if (
    APP_HOSTNAMES.has(domain) &&
    !path.startsWith('/checkout.voidhash.com') &&
    path !== '/api' &&
    !path.startsWith('/docs')
  ) {
    return AppMiddleware(req);
  }

  // for API
  if (API_HOSTNAMES.has(domain)) {
    return ApiMiddleware(req);
  }

  // for checkout
  if (CHECKOUT_HOSTNAMES.has(domain)) {
    return CheckoutMiddleware(req);
  }
}
