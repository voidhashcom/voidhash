export const ProjectPermissions = {
  all: 'project:all'
} as const;

export type ProjectPermission =
  (typeof ProjectPermissions)[keyof typeof ProjectPermissions];
