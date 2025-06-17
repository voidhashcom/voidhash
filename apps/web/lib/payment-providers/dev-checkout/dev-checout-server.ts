import { ServiceContext } from "@/lib/service-function";
import { DevCheckoutPaymentProvider } from "./dev-checkout";
import { CheckoutSession, checkoutSessions } from "@voidhash/db";
import {
	VoidhashBadRequestError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import {
	createPaymentProviderCoreService,
	PaymentProviderCoreService,
} from "../../services/payment-providers/core/payment-provider-core-service";
import { asfn } from "@/lib/neverthrow";

type ConfirmPurchaseInput = {
	checkoutSessionId: string;
};

type ConfirmPurchaseError =
	| VoidhashNotFoundError
	| VoidhashInternalServerError
	| VoidhashBadRequestError;

type ConfirmPurchaseResult = {
	redirectUrl: string;
};

type CancelPurchaseError = VoidhashInternalServerError;

type CancelPurchaseInput = {
	checkoutSessionId: string;
};

type CancelPurchaseResult = {
	redirectUrl: string;
};

export class DevCheckoutPaymentProviderServer extends DevCheckoutPaymentProvider {
	private readonly paymentProviderCoreService: PaymentProviderCoreService;
	constructor() {
		super();
		this.paymentProviderCoreService = createPaymentProviderCoreService();
	}

	confirmPurchase = asfn<ConfirmPurchaseError>()(
		(assert) => async (ctx: ServiceContext, input: ConfirmPurchaseInput) => {
			const checkoutSession = assert(
				await this.paymentProviderCoreService.getCheckoutSession(
					ctx,
					input.checkoutSessionId
				)
			);

			if (checkoutSession.status === "success") {
				return {
					redirectUrl: checkoutSession.successCallbackUrl,
				};
			}

			if (checkoutSession.status === "error") {
				// TODO: Should log the error
				return assert(await checkoutError(ctx, checkoutSession));
			}

			const paymentProviderConfigurationProduct =
				await this.paymentProviderCoreService.getPaymentProviderConfigurationProductById(
					ctx,
					checkoutSession.paymentProviderConfigurationProductId
				);

			if (paymentProviderConfigurationProduct.isErr()) {
				console.log(
					"paymentProviderConfigurationProduct",
					paymentProviderConfigurationProduct
				);
				// TODO: Should log the error
				return assert(await checkoutError(ctx, checkoutSession));
			}

			const processSubscriptionPurchaseResult =
				await this.paymentProviderCoreService.processSubscriptionPurchase(
					ctx,
					"production",
					paymentProviderConfigurationProduct.value,
					{
						providerKey: checkoutSession.id, // We use the checkout session id as the provider key - this is only correct for dev checkout, where there is no external id.
						customerId: checkoutSession.customerId,
						status: "active",
						purchasedAt: new Date(),
						startsAt: new Date(),
						canceledAt: null,
						cancelAtPeriodEnd: false,
						expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day
						charge: {
							amount: 100,
							currency: "USD",
						},
					}
				);

			if (processSubscriptionPurchaseResult.isErr()) {
				console.log(
					"processSubscriptionPurchaseResult",
					processSubscriptionPurchaseResult
				);
				// TODO: Should log the error
				return assert(await checkoutError(ctx, checkoutSession));
			}

			await ctx.db.update(checkoutSessions).set({
				status: "success",
			});

			return {
				redirectUrl: checkoutSession.successCallbackUrl,
			};
		}
	);

	async cancelPurchase(
		ctx: ServiceContext,
		input: CancelPurchaseInput
	): Promise<Result<CancelPurchaseResult, CancelPurchaseError>> {
		try {
			const checkoutSession =
				await this.paymentProviderCoreService.getCheckoutSession(
					ctx,
					input.checkoutSessionId
				);

			if (checkoutSession.isErr()) {
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Internal server error",
					originalError: new Error(checkoutSession.error.message),
				} satisfies VoidhashInternalServerError);
			}

			if (checkoutSession.value.status === "success") {
				return ok({
					redirectUrl: checkoutSession.value.successCallbackUrl,
				});
			}

			await ctx.db.update(checkoutSessions).set({
				status: "cancelled",
			});

			return ok({
				redirectUrl: checkoutSession.value.errorCallbackUrl,
			});
		} catch (error) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
				originalError: error,
			} satisfies VoidhashInternalServerError);
		}
	}
}

export function createDevCheckoutPaymentProviderServer() {
	return new DevCheckoutPaymentProviderServer();
}

async function checkoutError(
	ctx: ServiceContext,
	checkoutSession: CheckoutSession
) {
	await ctx.db.update(checkoutSessions).set({
		status: "error",
	});
	return ok({
		redirectUrl: checkoutSession.errorCallbackUrl,
	});
}
