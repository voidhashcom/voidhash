import { ServiceContext } from "@/lib/service-function";
import { DevCheckoutPaymentProvider } from "./dev-checkout";
import {
	CheckoutSession,
	checkoutSessions,
	eq,
	paymentProviderConfigurationProducts,
} from "@voidhash/db";
import {
	VoidhashBadRequestError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import { processSubscriptionCreation } from "../core/process-subscription-creation";

type ConfirmPurchaseInput = {
	checkoutSessionId: string;
};

type ConfirmPurchaseError =
	| VoidhashNotFoundError
	| VoidhashInternalServerError
	| VoidhashBadRequestError;

type CancelPurchaseError = VoidhashInternalServerError | VoidhashNotFoundError;

type CancelPurchaseInput = {
	checkoutSessionId: string;
};

export class DevCheckoutPaymentProviderServer extends DevCheckoutPaymentProvider {
	confirmPurchase = async (
		ctx: ServiceContext,
		input: ConfirmPurchaseInput
	): Promise<Result<{ redirectUrl: string }, ConfirmPurchaseError>> => {
		const checkoutSession = await ctx.db.query.checkoutSessions.findFirst({
			where: eq(checkoutSessions.id, input.checkoutSessionId),
		});

		if (!checkoutSession) {
			return err({
				code: "NOT_FOUND",
				message: "Checkout session not found",
				resource: "checkoutSession",
				payload: {
					checkoutSessionId: input.checkoutSessionId,
				},
			} satisfies VoidhashNotFoundError);
		}

		if (checkoutSession.status === "success") {
			return ok({
				redirectUrl: checkoutSession.successCallbackUrl,
			});
		}

		if (checkoutSession.status === "error") {
			// TODO: Should log the error
			return await checkoutError(ctx, checkoutSession);
		}

		const paymentProviderConfigurationProduct =
			await ctx.db.query.paymentProviderConfigurationProducts.findFirst({
				where: eq(
					paymentProviderConfigurationProducts.id,
					checkoutSession.paymentProviderConfigurationProductId
				),
				with: {
					product: true,
				},
			});

		if (!paymentProviderConfigurationProduct) {
			return err({
				code: "NOT_FOUND",
				message: "Payment provider configuration product not found",
				resource: "paymentProviderConfigurationProduct",
				payload: {
					paymentProviderConfigurationProductId:
						checkoutSession.paymentProviderConfigurationProductId,
				},
			} satisfies VoidhashNotFoundError);
		}

		const processSubscriptionPurchaseResult = await processSubscriptionCreation(
			ctx,
			paymentProviderConfigurationProduct,
			{
				storeSubscriptionId: checkoutSession.id, // We use the checkout session id as the provider key - this is only correct for dev checkout, where there is no external id.
				customerId: checkoutSession.customerId,
				isTrial: false,
				providerEnvironment: "production",
				purchasedAt: new Date(),
				startsAt: new Date(),
				canceledAt: null,
				cancelAtPeriodEnd: false,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day
				transaction: {
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
			return await checkoutError(ctx, checkoutSession);
		}

		await ctx.db.update(checkoutSessions).set({
			status: "success",
		});

		return ok({
			redirectUrl: checkoutSession.successCallbackUrl,
		});
	};

	cancelPurchase = async (
		ctx: ServiceContext,
		input: CancelPurchaseInput
	): Promise<Result<{ redirectUrl: string }, CancelPurchaseError>> => {
		try {
			const checkoutSession = await ctx.db.query.checkoutSessions.findFirst({
				where: eq(checkoutSessions.id, input.checkoutSessionId),
			});

			if (!checkoutSession) {
				return err({
					code: "NOT_FOUND",
					message: "Checkout session not found",
					resource: "checkoutSession",
					payload: {
						checkoutSessionId: input.checkoutSessionId,
					},
				} satisfies VoidhashNotFoundError);
			}

			if (checkoutSession.status === "success") {
				return ok({
					redirectUrl: checkoutSession.successCallbackUrl,
				});
			}

			await ctx.db.update(checkoutSessions).set({
				status: "cancelled",
			});

			return ok({
				redirectUrl: checkoutSession.errorCallbackUrl,
			});
		} catch (error) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
				originalError: error,
			} satisfies VoidhashInternalServerError);
		}
	};
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
