import { Db } from "@/lib/effect/db";
import { eq, organization } from "@voidhash/db";
import { Effect } from "effect";

export class OrganizationRepository extends Effect.Service<OrganizationRepository>()(
	"OrganizationRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				getOrganizationBySlug: dbService.makeQuery(
					(execute, slug: string) =>
						execute(
							async (db) =>
								await db.query.organization.findFirst({
									where: eq(organization.slug, slug),
								})
						)
				),

				getOrganizationById: dbService.makeQuery(
					(execute, id: string ) =>
						execute(
							async (db) =>
								await db.query.organization.findFirst({
									where: eq(organization.id, id),
								})
						)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
