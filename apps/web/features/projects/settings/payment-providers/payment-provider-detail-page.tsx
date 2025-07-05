import { Page } from "@/features/shell";
import { VoidhashErrorCard } from "@/features/shell/components/voidhash-error-card";
import { PaymentProviderDetailConfiguration } from "./payment-provider-detail-configuration";
import { runServerEffect } from "@/lib/effect/runtimes/nextjs";
import { PaymentProviderService } from "@/lib/services/payment-provider.service";
import { ProjectService } from "@/lib/services/project.service";
import { Effect } from "effect";
import { NotFoundError } from "@/lib/effect/errors";
import { AuthSession } from "@/lib/effect/auth";

export async function PaymentProviderDetailPage({
	paramsPromise,
}: {
	paramsPromise: Promise<{
		paymentProviderConfigurationId: string;
		organizationSlug: string;
		projectSlug: string;
	}>;
}) {
	const { organizationSlug, projectSlug, paymentProviderConfigurationId } =
		await paramsPromise;

	const data = await runServerEffect(AuthSession.withAuthSession()(Effect.gen(function* () {
		const projectService = yield* ProjectService;
		const paymentProviderService = yield* PaymentProviderService;
		const project = yield* projectService.getProjectBySlugAndOrganizationSlug({
			organizationSlug,
			projectSlug,
		});
		if (!project) {
			return yield* Effect.fail(new NotFoundError({
				message: "Project not found",
			}));
		}
		const paymentProviderConfiguration = yield* paymentProviderService.getPaymentProviderConfigurationById(paymentProviderConfigurationId);
		return { project, paymentProviderConfiguration };
	})));

	if (data.isErr()) {
		const error = data._unsafeUnwrapErr();
		return <VoidhashErrorCard error={error} />;
	}

	const { project, paymentProviderConfiguration } = data.value;

	return (
		<Page
			className="p-0 pb-0  pt-3 flex flex-col flex-1"
			breadcrumbs={[
				{
					title: "Payment Providers",
					url: `/${organizationSlug}/${projectSlug}/settings/payment-providers`,
				},
				{
					title: paymentProviderConfiguration.name,
					url: `/${organizationSlug}/${projectSlug}/settings/payment-providers/${paymentProviderConfiguration.id}`,
				},
			]}
		>
			<PaymentProviderDetailConfiguration
				organizationSlug={organizationSlug}
				projectSlug={projectSlug}
				paymentProviderConfiguration={paymentProviderConfiguration}
				project={project}
			/>
		</Page>
	);
}
