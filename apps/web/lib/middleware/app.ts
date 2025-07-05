import { getEnvironment } from "../core/environments/utils";
import { NextMiddlewareCookiesAdapter } from "../nextjs/utils/next-middleware-cookie-adapter";
import { parse } from "./utils/parse";
import { NextRequest, NextResponse } from "next/server";

export default async function AppMiddleware(req: NextRequest) {
	const { fullPath, path, organizationSlug, projectSlug } = parse(req);

	const sessionCookie = req.cookies.get("better-auth.session_token");
	const secureSessionCookie = req.cookies.get(
		"__Secure-better-auth.session_token"
	);

	// Prevent infinite redirect loop
	if (
		!sessionCookie &&
		!secureSessionCookie &&
		path !== "/login" &&
		path !== "/sign-up"
	) {
		return NextResponse.redirect(
			new URL(
				`/login${path === "/" ? "" : `?next=${encodeURIComponent(fullPath)}`}`,
				req.url
			)
		);
	}

	if (
		organizationSlug &&
		projectSlug &&
		!path.includes("/environment-redirect")
	) {
		const environmentResult = await getEnvironment(
			new NextMiddlewareCookiesAdapter(req),
			organizationSlug,
			projectSlug
		);
		if (environmentResult.isErr()) {
			console.log(environmentResult.error);
			if (environmentResult.error.code === "NOT_FOUND") {
				return NextResponse.redirect(
					new URL(
						`/${organizationSlug}/${projectSlug}/environment-redirect?next=${encodeURIComponent(fullPath)}`,
						req.url
					)
				);
			}
			return NextResponse.redirect(new URL(`/error`, req.url));
		}
	}

	// otherwise, rewrite the path to /app
	return NextResponse.rewrite(new URL(`/app.voidhash.com${fullPath}`, req.url));
}
