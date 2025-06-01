import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { Card } from "@voidhash/ui";
import { PerkRecord } from "./perk-record";
import { PerksPageEmptyState } from "./perks-page-empty-state";
import { CreatePerkModalButton } from "./create-perk-modal-button";
import { getPerks } from "@/lib/services/perks/queries";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

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

	const perksResult = await getPerks({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	if (perksResult.isErr()) {
		const error = perksResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const perks = perksResult.value;

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Perks</h1>
					{perks.length > 0 && <CreatePerkModalButton projectId={project.id} />}
				</div>
				<p className="text-muted-foreground mt-3">
					List of unlockable features / perks.
				</p>
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
		</Page>
	);
}
