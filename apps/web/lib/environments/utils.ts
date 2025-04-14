import { cookies } from "next/headers";
import { type Environment, Environments } from "./types";

export async function getEnvironment(
	organizationSlug: string,
	projectSlug: string
) {
	const cookiesAwaited = await cookies();
	const projectEnvironmentCookie = cookiesAwaited.get(
		`project_environment_${organizationSlug}:${projectSlug}`
	);

	if (!projectEnvironmentCookie) {
		// TODO: If not set, check if the project is configured and running
		// If cookie does not exist, set it to testing
		const environment = Environments.Testing;
		cookiesAwaited.set(
			`project_environment_${organizationSlug}:${projectSlug}`,
			environment
		);
		return environment;
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
