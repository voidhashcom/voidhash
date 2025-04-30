import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { Card } from "@voidhash/ui";
import { PerkRecord } from "./perk-record";
import { PerksPageEmptyState } from "./perks-page-empty-state";
import { CreatePerkModalButton } from "./create-perk-modal-button";
import { getPerks } from "@/lib/services/perks/queries";

export async function PerksPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { projectSlug: projectSlug, organizationSlug },
	});

	if (!project) {
		return notFound();
	}

	const perks = await getPerks({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Perks</h1>
					{perks.length > 0 && <CreatePerkModalButton projectId={project.id} />}
				</div>

				<div className="mt-8">
					{perks.length === 0 ? (
						<PerksPageEmptyState projectId={project.id} />
					) : (
						<Card className="divide-y grid p-0 gap-0">
							{perks.map((perk) => (
								<PerkRecord
									key={perk.id}
									perk={perk}
									organizationSlug={organizationSlug}
									projectSlug={projectSlug}
								/>
							))}
						</Card>
					)}
				</div>
			</div>
		</Page>
	);
}
