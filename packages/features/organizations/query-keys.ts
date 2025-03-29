export const organizationsQueryKeys = {
	all: ["organizations"] as const,
	getOrganizationBySlug: (organizationSlug: string) =>
		[...organizationsQueryKeys.all, organizationSlug] as const,
};
