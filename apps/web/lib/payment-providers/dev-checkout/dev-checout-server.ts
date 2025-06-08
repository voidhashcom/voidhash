import { ServiceContext } from "@/lib/service-function";
import {
	DevCheckoutPaymentProvider,
	devCheckoutPaymentProviderId,
} from "./dev-checkout";
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

	async confirmPurchase(
		ctx: ServiceContext,
		input: ConfirmPurchaseInput
	): Promise<Result<ConfirmPurchaseResult, ConfirmPurchaseError>> {
		try {
			const checkoutSession =
				await this.paymentProviderCoreService.getCheckoutSession(
					ctx,
					input.checkoutSessionId
				);

			if (checkoutSession.isErr()) {
				return err(checkoutSession.error);
			}

			if (checkoutSession.value.status === "success") {
				return ok({
					redirectUrl: checkoutSession.value.successCallbackUrl,
				});
			}

			if (checkoutSession.value.status === "error") {
				// TODO: Should log the error
				return await checkoutError(ctx, checkoutSession.value);
			}

			const productProviderConfiguration =
				await this.paymentProviderCoreService.getProductProviderConfigurationByProductId(
					ctx,
					checkoutSession.value.productId,
					devCheckoutPaymentProviderId
				);

			if (productProviderConfiguration.isErr()) {
				console.log(
					"productProviderConfiguration",
					productProviderConfiguration
				);
				// TODO: Should log the error
				return await checkoutError(ctx, checkoutSession.value);
			}

			const processSubscriptionPurchaseResult =
				await this.paymentProviderCoreService.processSubscriptionPurchase(
					ctx,
					"production",
					productProviderConfiguration.value,
					{
						providerKey: checkoutSession.value.id, // We use the checkout session id as the provider key - this is only correct for dev checkout, where there is no external id.
						customerId: checkoutSession.value.customerId,
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
				return await checkoutError(ctx, checkoutSession.value);
			}

			await ctx.db.update(checkoutSessions).set({
				status: "success",
			});

			return ok({
				redirectUrl: checkoutSession.value.successCallbackUrl,
			});
		} catch (error) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
				originalError: error,
			} satisfies VoidhashInternalServerError);
		}
	}

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
