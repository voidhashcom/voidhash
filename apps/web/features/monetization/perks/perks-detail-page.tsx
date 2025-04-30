import { Page } from "@/features/shell";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { getPerkById } from "@/lib/services/perks/queries";

export async function PerksDetailPage({
	organizationSlug,
	projectSlug,
	id,
}: {
	organizationSlug: string;
	projectSlug: string;
	id: string;
}) {
	const serviceContext = await createNextServiceContext();
	const project = await getProjectBySlugAndOrganizationSlug({
		ctx: serviceContext,
		input: { organizationSlug: organizationSlug, projectSlug: projectSlug },
	});
	if (!project) {
		return notFound();
	}
	const perkPromise = getPerkById({
		ctx: serviceContext,
		input: { id },
	});

	const [perk] = await Promise.all([perkPromise]);

	if (!perk) {
		return notFound();
	}

	return (
		<Page
			breadcrumbs={[
				{
					title: "Perks",
					url: `/${organizationSlug}/${projectSlug}/monetization/perks`,
				},
				{
					title: perk.name,
					url: `/${organizationSlug}/${projectSlug}/monetization/perks/${id}`,
				},
			]}
		>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">{perk.name}</h1>
					{/* <CreateProductModalButton projectId={project.id} /> */}
				</div>

				<div className="mt-8"></div>
			</div>
		</Page>
	);
}
