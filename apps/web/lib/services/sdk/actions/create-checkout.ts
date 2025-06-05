import { createServiceFunction } from "@/lib/service-function";
import {
	CHECKOUT_DOMAIN,
	fromUnknownThrow,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { z } from "zod";
import { err, ok, Result } from "neverthrow";
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";
import { getPaywallProductByIdQuery } from "../raw-queries";
import { generateId } from "@/lib/id/generate";
import { checkoutSessions } from "@voidhash/db";
import { getCustomerByAppUserIdQuery } from "../../customers/raw-queries";
import { devCheckoutPaymentProviderId } from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { isAnonymousId } from "../utils";
import { createAnonymousCustomer } from "../create-anonymous-customer";

export const createCheckoutInputSchema = z.object({
	paywallProductId: z.string().min(1),
	successCallbackUrl: z.string().min(1).includes("://"),
	errorCallbackUrl: z.string().min(1).includes("://"),
});

type CreateCheckoutError =
	| VoidhashUnauthorizedError
	| VoidhashNotFoundError
	| VoidhashInternalServerError;

type CreateCheckoutResponse = {
	checkoutSessionId: string;
	checkoutUrl: string;
};

// TODO: Maybe add ratelimit?
export const createCheckoutSession = createServiceFunction()
	.input(createCheckoutInputSchema)
	.use(isAuthenticated)
	.use(hasEnvironment)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<CreateCheckoutResponse, CreateCheckoutError>> => {
			console.log("createCheckoutSession", input);
			const appUserId = ctx.session?.customer?.appUserId;

			if (!appUserId) {
				return err({
					code: "UNAUTHORIZED",
					message: "App user ID not found",
				});
			}

			const paywallProduct = await getPaywallProductByIdQuery(
				ctx,
				input.paywallProductId
			);

			if (paywallProduct.isErr()) {
				console.log("paywallProduct error", paywallProduct.error);
				return err(paywallProduct.error);
			}

			const projectId = ctx.session.projects[0]?.id;
			if (!projectId) {
				console.log("projectId not found");
				return err({
					code: "INTERNAL_SERVER_ERROR",
					message: "Project not found",
					originalError: new Error("Project not found"),
				});
			}

			// TODO: Uncomment this when we have a way to get payment providers
			// const paymentProviders = await getAvailablePaymentProviders(
			// 	ctx,
			// 	projectId,
			// 	ctx.session.environment
			// );

			// if (paymentProviders.isErr()) {
			// 	return err(paymentProviders.error);
			// }

			// const paymentProvider = paymentProviders.value[0];
			// if (!paymentProvider) {
			// 	return err({
			// 		code: "INTERNAL_SERVER_ERROR",
			// 		message: "No payment provider found",
			// 		originalError: new Error("No payment provider found"),
			// 	});
			// }

			try {
				return await ctx.db.transaction(async (tx) => {
					const customerResult = await getCustomerByAppUserIdQuery(
						{
							...ctx,
							tx: tx,
						},
						appUserId,
						ctx.session.environment
					);

					let customer = customerResult.isOk() ? customerResult.value : null;

					if (customerResult.isErr()) {
						// When not found, we should check if the id is anonymous. If it is, we should create a new customer.
						if (
							customerResult.error.code === "NOT_FOUND" &&
							isAnonymousId(appUserId)
						) {
							const createAnonymousCustomerResult =
								await createAnonymousCustomer(
									{
										...ctx,
										tx: tx,
									},
									{
										projectId,
										appUserId: appUserId,
										origin: "ios", // TODO: Make this dynamic
										environment: ctx.session.environment,
									}
								);

							if (createAnonymousCustomerResult.isErr()) {
								return err(createAnonymousCustomerResult.error);
							}

							customer = createAnonymousCustomerResult.value;
						}

						return err(customerResult.error);
					}

					if (!customer) {
						return err({
							code: "INTERNAL_SERVER_ERROR",
							message: "Customer not found",
							originalError: new Error("Customer not found"),
						} satisfies VoidhashInternalServerError);
					}

					const sessionInsert = {
						id: generateId("checkoutSession"),
						customerId: customer.id,
						productId: paywallProduct.value.product.id,
						successCallbackUrl: input.successCallbackUrl,
						errorCallbackUrl: input.errorCallbackUrl,
						// TODO: Replace with real payment provider id
						paymentProviderId: devCheckoutPaymentProviderId,
						createdAt: new Date(),
						updatedAt: new Date(),
					};

					await tx.insert(checkoutSessions).values(sessionInsert);

					return ok({
						checkoutSessionId: sessionInsert.id,
						// TODO: SHOULD BE DYNAMIC
						checkoutUrl: `${CHECKOUT_DOMAIN}/dev-checkout/${sessionInsert.id}`,
					});
				});
			} catch (e) {
				return err(fromUnknownThrow(e));
			}
		}
	);
