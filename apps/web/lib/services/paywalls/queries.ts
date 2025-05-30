import {
	authenticateContext,
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import { cache } from "react";
import {
	getPaywallByIdQuery,
	getPaywallProductsQuery,
	getPaywallsQuery,
} from "./raw-queries";
import {
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib/constants";
import { Paywall, PaywallProduct } from "@voidhash/db";
import { err, ok, Result } from "neverthrow";

export const getPaywallsInputSchema = z.object({
	projectId: z.string(),
});

type GetPaywallsError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError;

export const getPaywalls = cache(
	createServiceFunction()
		.input(getPaywallsInputSchema)
		.function(
			async ({ input, ctx }): Promise<Result<Paywall[], GetPaywallsError>> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						input.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access paywalls.",
					});
				}

				const paywalls = await getPaywallsQuery(
					authenticatedContext.value,
					input.projectId
				);

				if (paywalls.isErr()) {
					return err(paywalls.error);
				}

				return ok(paywalls.value);
			}
		).invoke
);

type GetPaywallByIdError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export type GetPaywallByIdResult = Paywall;
export const getPaywallById = cache(
	createServiceFunction()
		.input(z.object({ id: z.string() }))
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<GetPaywallByIdResult, GetPaywallByIdError>> => {
				const authenticatedContext = await authenticateContext(ctx);

				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const paywallResult = await getPaywallByIdQuery(
					authenticatedContext.value,
					input.id
				);

				if (paywallResult.isErr()) {
					return err(paywallResult.error);
				}

				if (!paywallResult.value) {
					return err({
						code: "NOT_FOUND",
						message: "Paywall not found.",
						resource: "paywall",
						payload: { id: input.id },
					});
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						paywallResult.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access paywall.",
					});
				}

				return ok(paywallResult.value);
			}
		).invoke
);

type GetPaywallProductsError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export type GetPaywallProductsResult = (PaywallProduct & {
	product: {
		name: string;
	};
})[];
export const getPaywallProducts = cache(
	createServiceFunction()
		.input(z.object({ paywallId: z.string() }))
		.function(
			async ({
				input,
				ctx,
			}): Promise<
				Result<GetPaywallProductsResult, GetPaywallProductsError>
			> => {
				const authenticatedContext = await authenticateContext(ctx);
				if (authenticatedContext.isErr()) {
					return err(authenticatedContext.error);
				}

				const paywall = await getPaywallById({
					ctx: authenticatedContext.value,
					input: { id: input.paywallId },
				});
				if (paywall.isErr()) {
					if (paywall.error.code === "BAD_REQUEST") {
						return err({
							code: "INTERNAL_SERVER_ERROR",
							message: "Invalid paywall id.",
							originalError: new Error(paywall.error.message),
						});
					}
					return err(paywall.error);
				}

				if (
					!hasProjectPermission(
						authenticatedContext.value,
						paywall.value.projectId,
						"project:all"
					)
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access paywall products.",
					});
				}

				const paywallProducts = await getPaywallProductsQuery(
					authenticatedContext.value,
					input.paywallId
				);

				if (paywallProducts.isErr()) {
					return err(paywallProducts.error);
				}

				return ok(paywallProducts.value);
			}
		).invoke
);
