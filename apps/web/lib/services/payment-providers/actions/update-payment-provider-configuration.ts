import {
	createServiceFunction,
	hasProjectPermission,
} from "@/lib/service-function";
import { z } from "zod";
import {
	projectPaymentProviderConfigurations,
	Transaction,
} from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { eq } from "drizzle-orm";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import { getPaymentProviderConfigurationByIdQuery } from "../raw-queries";
import { err, ok, Result } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";
import { safeTry, safeTryPromise } from "@/lib/neverthrow";

export const updatePaymentProviderConfigurationInputSchema = z.object({
	id: z.string(),
	enabled: z.boolean(),
	name: z.string().min(1).max(255).optional(),
	configuration: z.object({}).passthrough(),
});

type UpdatePaymentProviderConfigurationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const updatePaymentProviderConfiguration = createServiceFunction()
	.input(updatePaymentProviderConfigurationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<
			Result<{ id: string }, UpdatePaymentProviderConfigurationError>
		> => {
			const existingConfiguration =
				await getPaymentProviderConfigurationByIdQuery(ctx, input.id);

			if (existingConfiguration.isErr()) {
				return err(existingConfiguration.error);
			}

			if (
				!hasProjectPermission(
					ctx,
					existingConfiguration.value.projectId,
					"project:all"
				)
			) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to save this payment provider configuration",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === existingConfiguration.value.providerId
			);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: `Provider ${existingConfiguration.value.providerId} not found`,
					resource: "payment_provider",
					payload: {
						providerId: existingConfiguration.value.providerId,
					},
				});
			}

			const requireValidation = input.enabled;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const configurationSchema: z.ZodObject<any> | undefined =
				provider.getGlobalConfigurationSchema();

			if (requireValidation && !configurationSchema) {
				return err({
					code: "BAD_REQUEST",
					message: `Provider ${provider.getId()} does not have a configuration`,
				} satisfies VoidhashBadRequestError);
			}

			const parsedConfiguration = safeTry({
				try: () => {
					if (requireValidation && configurationSchema) {
						return configurationSchema.parse(input.configuration);
					}
					return input.configuration;
				},
				catch: (error) => {
					if (error instanceof z.ZodError) {
						return err({
							code: "BAD_REQUEST",
							message: "Validation error",
							validationErrors: error,
						} satisfies VoidhashBadRequestError);
					}

					return err(fromUnknownThrow(error));
				},
			});

			if (parsedConfiguration.isErr()) {
				return parsedConfiguration.error;
			}

			const res = await safeTryPromise({
				try: async () => {
					return await ctx.db.transaction(async (tx: Transaction) => {
						await tx
							.update(projectPaymentProviderConfigurations)
							.set({
								configuration: parsedConfiguration.value,
								enabled: input.enabled,
								name: input.name,
							})
							.where(eq(projectPaymentProviderConfigurations.id, input.id!));

						return ok({ id: input.id });
					});
				},
				catch: (error) => {
					return fromUnknownThrow(error);
				},
			});

			if (res.isErr()) {
				return err(res.error);
			}

			return ok({ id: input.id });
		}
	);
