import { layerMemory as WorkflowEngineLayerMemory } from "@effect/workflow/WorkflowEngine";
import { Db } from "@voidhash/db/effect";
import { type Effect, Layer, ManagedRuntime, pipe } from "effect";
import { PaymentProviderProductService, ProductPerkService } from "./services";
import { BetterAuth } from "./better-auth/better-auth-effect";
import { BillingService, UsageService } from "./services";
import { ApiKeyService } from "./services/api-keys";
import { ChangesetDeploymentService } from "./services/changeset-deployment";
import { CustomerService } from "./services/customers";
import { OrganizationService } from "./services/organizations";
import { PaymentProviderConfigurationService } from "./services/payment-provider-configurations";
import { PerkService } from "./services/perks";
import { ProductService } from "./services/products";
import { ProjectService } from "./services/projects";
import { SdkService } from "./services/sdk";
import { UserService } from "./services/users";

import { MockBillingProviderLive } from "./testing/__mocks__/billing.mock";

const DbLive = Db.Default;

// Use in-memory workflow engine for tests (no cluster/socket dependencies)
const WorkflowEngineLayer = WorkflowEngineLayerMemory;

const RuntimeLayer = () => {
	const CoreLayer = pipe(BetterAuth.Default, Layer.provideMerge(DbLive));

	const ServiceLayer = pipe(
		ApiKeyService.Default,
		Layer.provideMerge(ChangesetDeploymentService.Default),
		Layer.provideMerge(CustomerService.Default),
		Layer.provideMerge(OrganizationService.Default),
		Layer.provideMerge(PaymentProviderConfigurationService.Default),
		Layer.provideMerge(PerkService.Default),
		Layer.provideMerge(ProductService.Default),
		Layer.provideMerge(PaymentProviderProductService.Default),
		Layer.provideMerge(ProductPerkService.Default),
		Layer.provideMerge(ProjectService.Default),
		Layer.provideMerge(SdkService.Default),
		Layer.provideMerge(UserService.Default),
		Layer.provideMerge(BillingService.Default),
		Layer.provideMerge(UsageService.Default),
		Layer.provideMerge(MockBillingProviderLive),
	);

	return pipe(
		ServiceLayer,
		Layer.provideMerge(WorkflowEngineLayer),
		Layer.provideMerge(CoreLayer),
	);
};

export const createIntegrationTestRuntime = () =>
	ManagedRuntime.make(RuntimeLayer());

type AvailableServices = Layer.Layer.Success<ReturnType<typeof RuntimeLayer>>;

export const createIntegrationTestRunner =
	() =>
	async <T, C extends AvailableServices>(
		// biome-ignore lint/suspicious/noExplicitAny: is ok
		effect: Effect.Effect<T, any, C>,
	) => {
		const runtime = createIntegrationTestRuntime();
		const result = await runtime.runPromiseExit(pipe(effect));
		// Dispose the runtime but don't throw if fibers are interrupted during cleanup
		try {
			await runtime.dispose();
		} catch {
			// Ignore interruption errors during cleanup - this is expected
			// when the ClusterWorkflowEngine background fibers are stopped
		}
		return result;
	};
