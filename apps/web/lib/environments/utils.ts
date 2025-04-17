import { type Environment } from "./types";
import { CookiesAdapter } from "@/lib/cookies-adapter";

export async function getEnvironment(
	cookies: CookiesAdapter,
	organizationSlug: string,
	projectSlug: string
) {
	const projectEnvironmentCookie = await cookies.get(
		`project_environment_${organizationSlug}:${projectSlug}`
	);

	if (!projectEnvironmentCookie) {
		return null;
	}

	return projectEnvironmentCookie as Environment;
}

export async function setEnvironment(
	cookies: CookiesAdapter,
	organizationSlug: string,
	projectSlug: string,
	environment: Environment
) {
	await cookies.set(
		`project_environment_${organizationSlug}:${projectSlug}`,
		environment
	);
}
