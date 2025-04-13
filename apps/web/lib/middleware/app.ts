import { parse } from "./utils/parse";
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export default async function AppMiddleware(req: NextRequest) {
	const { fullPath, path } = parse(req);
	console.log(`/app.voidhash.com${fullPath}`);

	const sessionCookie = getSessionCookie(req);

	console.log(sessionCookie);

	// Prevent infinite redirect loop
	if (!sessionCookie && path !== "/login" && path !== "/sign-up") {
		return NextResponse.redirect(
			new URL(
				`/login${path === "/" ? "" : `?next=${encodeURIComponent(fullPath)}`}`,
				req.url
			)
		);
	}

	// otherwise, rewrite the path to /app
	return NextResponse.rewrite(new URL(`/app.voidhash.com${fullPath}`, req.url));
}
