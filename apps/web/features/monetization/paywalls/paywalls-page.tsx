import { Page } from "@/features/shell";
import { getProjectBySlugAndOrganizationSlug } from "@/lib/services/projects/queries";
import { createNextServiceContext } from "@/lib/nextjs/utils/create-next-service-context";
import { getPaywalls } from "@/lib/services/paywalls/queries";
import { Card } from "@voidhash/ui";
import { PaywallRecord } from "./paywall-record";
import { PaywallsPageEmptyState } from "./paywalls-page-empty-state";
import { CreatePaywallModalButton } from "./create-paywall-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";

export async function PaywallsPage({
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

	const paywallsResult = await getPaywalls({
		ctx: serviceContext,
		input: { projectId: project.id },
	});

	if (paywallsResult.isErr()) {
		const error = paywallsResult._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const paywalls = paywallsResult.value;

	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<div className="flex flex-row items-center justify-between">
					<h1 className="text-3xl font-normal tracking-right">Paywalls</h1>
					{paywalls.length > 0 && (
						<CreatePaywallModalButton projectId={project.id} />
					)}
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
