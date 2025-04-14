import { getEnvironment } from "../environments/utils";
import { parse } from "./utils/parse";
import { NextRequest, NextResponse } from "next/server";

export default async function AppMiddleware(req: NextRequest) {
	const { fullPath, path, organizationSlug, projectSlug } = parse(req);
	console.log(`/app.voidhash.com${fullPath}`);

	console.log(req.headers);

	const sessionCookie = req.cookies.get("better-auth.session_token");

	// Prevent infinite redirect loop
	if (!sessionCookie && path !== "/login" && path !== "/sign-up") {
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
		const environment = await getEnvironment(organizationSlug, projectSlug);
		if (!environment) {
			return NextResponse.redirect(
				new URL(
					`/${organizationSlug}/${projectSlug}/environment-redirect?next=${encodeURIComponent(fullPath)}`,
					req.url
				)
			);
		}
	}

	// otherwise, rewrite the path to /app
	return NextResponse.rewrite(new URL(`/app.voidhash.com${fullPath}`, req.url));
}
