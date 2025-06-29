import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { Card } from "@voidhash/ui";
import { PerkRecord } from "./perk-record";
import { PerksPageEmptyState } from "./perks-page-empty-state";
import { CreatePerkModalButton } from "./create-perk-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { NextjsRuntime } from "@/lib/effect/runtimes/nextjs";
import { Effect, pipe } from "effect";
import { PerkService } from "@/lib/services/perks/perk.service";
import { tryCatch } from "@/lib/try-catch";

export async function PerksPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const projectResult = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (projectResult.isErr()) {
		const error = projectResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const project = projectResult.value;

	const perksResult = await tryCatch(
		NextjsRuntime.runPromise(
			pipe(
				PerkService,
				Effect.flatMap((perkService) => perkService.getPerks(project.id))
			)
		)
	);

	if (perksResult.error) {
		return <VoidhashErrorCard error={perksResult.error} />;
	}
	const perks = perksResult.data;

	return (
		<div>
			<div className="flex flex-row items-center justify-between pt-6">
				<div>
					<h2 className="text-xl font-normal tracking-right">Perks</h2>
					<p className="text-muted-foreground mt-1">
						List of unlockable features / perks.
					</p>
				</div>
				{perks.length > 0 && <CreatePerkModalButton projectId={project.id} />}
			</div>

			<div className="mt-8">
				{perks.length === 0 ? (
					<PerksPageEmptyState projectId={project.id} />
				) : (
					<Card className="divide-y grid p-0 gap-0">
						{perks.map((perk) => (
							<PerkRecord key={perk.id} perk={perk} />
						))}
					</Card>
				)}
			</div>
		</div>
	);
}
