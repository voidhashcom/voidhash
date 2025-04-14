import { setEnvironment } from "@/lib/environments/utils";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

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
	// TODO: set the environment based on the state of the project
	await setEnvironment(organizationSlug, projectSlug, "testing");

	const next = searchParams.get("next");

	if (next) {
		redirect(decodeURIComponent(next));
	} else {
		redirect("/");
	}
}
