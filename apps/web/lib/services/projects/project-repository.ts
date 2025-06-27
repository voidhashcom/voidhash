import { Db } from "@/lib/effect/db";
import { and, eq, projects } from "@voidhash/db";
import { Effect } from "effect";

export class ProjectRepository extends Effect.Service<ProjectRepository>()(
	"ProjectRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				getProjectBySlug: dbService.makeQuery(
					(
						execute,
						{
							projectSlug,
							organizationId,
						}: { projectSlug: string; organizationId: string }
					) =>
						execute(
							async (db) =>
								await db.query.projects.findFirst({
									where: and(
										eq(projects.slug, projectSlug),
										eq(projects.organizationId, organizationId)
									),
								})
						)
				),

				getProjectById: dbService.makeQuery((execute, id: string) =>
					execute(
						async (db) =>
							await db.query.projects.findFirst({
								where: eq(projects.id, id),
							})
					)
				),

				getProjects: dbService.makeQuery((execute, organizationId: string) =>
					execute(
						async (db) =>
							await db.query.projects.findMany({
								where: eq(projects.organizationId, organizationId),
							})
					)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
