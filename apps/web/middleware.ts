import AppMiddleware from "./lib/middleware/app";
import { parse } from "./lib/middleware/utils/parse";
import { APP_HOSTNAMES } from "@voidhash/lib";
import { NextRequest } from "next/server";
export const config = {
	matcher: [
		/*
		 * Match all paths except for:
		 * 1. /api/ routes
		 * 2. /_next/ (Next.js internals)
		 * 3. /_proxy/ (proxies for third-party services)
		 * 4. Metadata files: favicon.ico, sitemap.xml, robots.txt, manifest.webmanifest
		 */
		"/((?!api/|_next/|_proxy/|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
	],
};

export default async function middleware(req: NextRequest) {
	const { domain } = parse(req);
	if (APP_HOSTNAMES.has(domain)) {
		return AppMiddleware(req);
	}
}
