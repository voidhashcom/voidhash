import { Effect } from "effect";
import { OrganizationPermission } from "../services/organizations/permissions";
import { ProjectPermission } from "../services/projects/permissions";
import { AuthSession } from "./auth";

export const hasProjectPermission = (
	projectId: string,
	permission: ProjectPermission
) =>
	AuthSession.pipe(
		Effect.map((session) => {
			return session?.projects.some(
				(p) => p.id === projectId && p.permissions.includes(permission)
			);
		})
	);

export const hasOrganizationPermission = (
	organizationId: string,
	permission: OrganizationPermission
) =>
	AuthSession.pipe(
		Effect.map((session) => {
			return session?.organizations.some(
				(o) => o.id === organizationId && o.permissions.includes(permission)
			);
		})
	);
