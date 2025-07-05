import { setEnvironment } from "@/lib/core/environments/utils";
import { NextCookiesAdapter } from "@/lib/nextjs/utils/next-cookies-adapter";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { Environment as EnvironmentEnum } from "@voidhash/lib/index";

export async function GET(
	request: NextRequest,
	{
		params,
	}: {
		params: Promise<{ organizationSlug: string; projectSlug: string }>;
	}
) {
	const searchParams = request.nextUrl.searchParams;
	const { organizationSlug, projectSlug } = await params;

	await setEnvironment(
		new NextCookiesAdapter(),
		organizationSlug,
		projectSlug,
		EnvironmentEnum.Production
	);

	const next = searchParams.get("next");

	if (next) {
		redirect(decodeURIComponent(next));
	} else {
		redirect("/");
	}
}
