import { constant } from "../lang/index.ts";

export const OrganizationPermissions = constant({
  all: "organization:all",
});

export type OrganizationPermission =
  (typeof OrganizationPermissions)[keyof typeof OrganizationPermissions];

export const ProjectPermissions = constant({
  all: "project:all",
});

export type ProjectPermission = (typeof ProjectPermissions)[keyof typeof ProjectPermissions];
