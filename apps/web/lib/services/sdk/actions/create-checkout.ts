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
import { generateId } from "@/lib/id/generate";
import {
	and,
	checkoutSessions,
	eq,
	InsertCheckoutSession,
	paymentProviderConfigurations,
	Transaction,
} from "@voidhash/db";
import { getCustomerByAppUserIdQuery } from "../../customers/raw-queries";
import { devCheckoutPaymentProviderId } from "@/lib/payment-providers/dev-checkout/dev-checkout";
import { isAnonymousId } from "../utils";
import { createAnonymousCustomer } from "../create-anonymous-customer";
import { getProviderProductByIdQuery } from "../../products/raw-queries";

export const createCheckoutInputSchema = z.object({
	paymentProviderConfigurationProductId: z.string().min(1),
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

			const paymentProviderConfigurationProduct =
				await getProviderProductByIdQuery(
					ctx,
					input.paymentProviderConfigurationProductId
				);

			if (paymentProviderConfigurationProduct.isErr()) {
				console.log(
					"paymentProviderConfigurationProduct error",
					paymentProviderConfigurationProduct.error
				);
				return err(paymentProviderConfigurationProduct.error);
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

			try {
				const devCheckoutPaymentProviderConfiguration =
					await ctx.db.query.paymentProviderConfigurations.findFirst({
						where: and(
							eq(paymentProviderConfigurations.projectId, projectId),
							eq(
								paymentProviderConfigurations.providerId,
								devCheckoutPaymentProviderId
							)
						),
					});

				if (!devCheckoutPaymentProviderConfiguration) {
					return err({
						code: "INTERNAL_SERVER_ERROR",
						message: "Dev checkout payment provider configuration not found",
						originalError: new Error(
							"Dev checkout payment provider configuration not found"
						),
					});
				}

				return await ctx.db.transaction(async (tx: Transaction) => {
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
						} else {
							return err(customerResult.error);
						}
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
						paymentProviderConfigurationProductId:
							paymentProviderConfigurationProduct.value.id,
						successCallbackUrl: input.successCallbackUrl,
						errorCallbackUrl: input.errorCallbackUrl,
						createdAt: new Date(),
						updatedAt: new Date(),
					} satisfies InsertCheckoutSession;

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
