import { Page } from "@/features/shell";
import { Card } from "@voidhash/ui";
import { PaywallRecord } from "./paywall-record";
import { PaywallsPageEmptyState } from "./paywalls-page-empty-state";
import { CreatePaywallModalButton } from "./create-paywall-modal-button";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { ProjectService } from "@/lib/services/projects/project.service";
import { Effect } from "effect";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { NotFoundError } from "@/lib/effect/errors";
import { PaywallService } from "@/lib/services/paywalls/paywall.service";

export async function PaywallsPage({
	organizationSlug,
	projectSlug,
}: {
	organizationSlug: string;
	projectSlug: string;
}) {
	const data = await runServerEffect(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const paywallService = yield* PaywallService;
		const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
			organizationSlug,
			projectSlug,
		});
		if (!project) {
			return yield* Effect.fail(new NotFoundError({
				message: "Project not found",
			}));
		}
		const paywalls = yield* paywallService.getPaywalls(project.id);
		return { project, paywalls };
	}));

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}	

	const { project, paywalls } = data.value;

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
