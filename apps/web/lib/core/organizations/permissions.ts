export const OrganizationPermissions = {
	all: "organization:all",
} as const;

export type OrganizationPermission =
	(typeof OrganizationPermissions)[keyof typeof OrganizationPermissions];
