import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { notFound } from "next/navigation";
import { getPaywalls } from "@/lib/services/paywalls/queries";
import { Card } from "@voidhash/ui";
import { PaywallRecord } from "./paywall-record";
import { PaywallsPageEmptyState } from "./paywalls-page-empty-state";

export async function PaywallsPage({
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

	const paywalls = await getPaywalls({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Paywalls</h1>
					{/* <CreateProductModalButton projectId={project.id} /> */}
				</div>

				<div className="mt-8">
					{paywalls.length === 0 ? (
						<PaywallsPageEmptyState projectId={project.id} />
					) : (
						<Card className="divide-y grid p-0 gap-0">
							{paywalls.map((paywall) => (
								<PaywallRecord
									key={paywall.id}
									paywall={paywall}
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
