
import { Card } from "@voidhash/ui";
import { PerkRecord } from "./perk-record";
import { PerksPageEmptyState } from "./perks-page-empty-state";
import { CreatePerkModalButton } from "./create-perk-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { Effect } from "effect";
import { PerkService } from "@/lib/services/perks/perk.service";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { ProjectService } from "@/lib/services/projects/project.service";
import { NotFoundError } from "@/lib/effect/errors";

export async function PerksPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const data = await runServerEffect(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const perkService = yield* PerkService;
		const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
			organizationSlug,
			projectSlug,
		});
		if (!project) {
			return yield* Effect.fail(new NotFoundError({
				message: "Project not found",
			}));
		}
		const perks = yield* perkService.getPerks(project.id);
		return { project, perks };
	}));

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { project, perks } = data.value;

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
