import { Effect, Layer } from "effect";

import { PaymentProviderProductService } from "../payment-provider-products";
import { PerkService } from "../perks";
import { ProductPerkService } from "../product-perks";
import { ProductService } from "../products";
import { deployChangeset } from "./deploy-changeset";
import { DeployChangesetWorkflowLayer } from "./workflows/deploy-changeset-workflow";

// The workflow layer needs these services to be provided
const DeployChangesetWorkflowLayerWithDependencies =
	DeployChangesetWorkflowLayer.pipe(
		Layer.provide(PerkService.Default),
		Layer.provide(ProductService.Default),
		Layer.provide(ProductPerkService.Default),
		Layer.provide(PaymentProviderProductService.Default),
	);

export class ChangesetDeploymentService extends Effect.Service<ChangesetDeploymentService>()(
	"ChangesetDeploymentService",
	{
		dependencies: [DeployChangesetWorkflowLayer],
		effect: Effect.gen(function* effect() {
			return {
				deployChangeset: yield* deployChangeset,
			} as const;
		}),
	},
) {}
