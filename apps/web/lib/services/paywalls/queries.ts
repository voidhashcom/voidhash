import {
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
import { hasEnvironment, isAuthenticated } from "@/lib/middlewares";

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
		.use(isAuthenticated)
		.use(hasEnvironment)
		.function(
			async ({ input, ctx }): Promise<Result<Paywall[], GetPaywallsError>> => {
				if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access paywalls.",
					});
				}

				const paywalls = await getPaywallsQuery(
					ctx,
					input.projectId,
					ctx.session.environment
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
		.use(isAuthenticated)
		.use(hasEnvironment)
		.function(
			async ({
				input,
				ctx,
			}): Promise<Result<GetPaywallByIdResult, GetPaywallByIdError>> => {
				const paywallResult = await getPaywallByIdQuery(ctx, input.id);

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
						ctx,
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
		.use(isAuthenticated)
		.use(hasEnvironment)
		.function(
			async ({
				input,
				ctx,
			}): Promise<
				Result<GetPaywallProductsResult, GetPaywallProductsError>
			> => {
				const paywall = await getPaywallByIdQuery(ctx, input.paywallId);
				if (paywall.isErr()) {
					return err(paywall.error);
				}

				if (
					!hasProjectPermission(ctx, paywall.value.projectId, "project:all")
				) {
					return err({
						code: "FORBIDDEN",
						message: "No permission to access paywall products.",
					});
				}

				const paywallProducts = await getPaywallProductsQuery(
					ctx,
					input.paywallId
				);

				if (paywallProducts.isErr()) {
					return err(paywallProducts.error);
				}

				return ok(paywallProducts.value);
			}
		).invoke
);
