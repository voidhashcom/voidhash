import { cookies } from "next/headers";
import { type Environment } from "./types";

export async function getEnvironment(
	organizationSlug: string,
	projectSlug: string
) {
	const cookiesAwaited = await cookies();
	const projectEnvironmentCookie = cookiesAwaited.get(
		`project_environment_${organizationSlug}:${projectSlug}`
	);

	if (!projectEnvironmentCookie) {
		return null;
	}

	return projectEnvironmentCookie.value as Environment;
}

export async function setEnvironment(
	organizationSlug: string,
	projectSlug: string,
	environment: Environment
) {
	const cookiesAwaited = await cookies();
	cookiesAwaited.set(
		`project_environment_${organizationSlug}:${projectSlug}`,
		environment
	);
}
