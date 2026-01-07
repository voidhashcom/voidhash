export const OrganizationPermissions = {
  all: "organization:all",
} as const;

export type OrganizationPermission =
  (typeof OrganizationPermissions)[keyof typeof OrganizationPermissions];

export const ProjectPermissions = {
  all: "project:all",
} as const;

export type ProjectPermission =
  (typeof ProjectPermissions)[keyof typeof ProjectPermissions];
