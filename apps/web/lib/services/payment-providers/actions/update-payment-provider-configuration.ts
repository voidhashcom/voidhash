import {
	createServiceFunction,
	hasProjectPermission,
	ServiceContext,
} from "@/lib/service-function";
import { z } from "zod";
import { paymentProviderConfigurations, Transaction } from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { eq, and, isNotNull } from "drizzle-orm";
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

			const parsedConfiguration = safeTry(
				() => {
					if (requireValidation && configurationSchema) {
						return configurationSchema.parse(input.configuration);
					}
					return input.configuration;
				},
				(error) => {
					if (error instanceof z.ZodError) {
						return {
							code: "BAD_REQUEST",
							message: "Validation error",
							validationErrors: error,
						} satisfies VoidhashBadRequestError;
					}

					return fromUnknownThrow(error);
				}
			);

			if (parsedConfiguration.isErr()) {
				return err(parsedConfiguration.error);
			}

			const res = await safeTryPromise(async () => {
				return await ctx.db.transaction(async (tx: Transaction) => {
					const key = provider.createGlobalKey(
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						parsedConfiguration.value as any
					);
					// Check key only when enabling the configuration
					if (input.enabled) {
						const isKeyAvailable = await checkIfPaymentProviderKeyIsAvailable(
							ctx,
							key,
							provider.getId(),
							existingConfiguration.value.projectId
						);
						if (!isKeyAvailable) {
							return err({
								code: "BAD_REQUEST",
								message:
									"Payment provider with similar configuration already exists.",
							} satisfies VoidhashBadRequestError);
						}
					}
					await tx
						.update(paymentProviderConfigurations)
						.set({
							configuration: parsedConfiguration.value,
							enabled: input.enabled,
							name: input.name,
						})
						.where(eq(paymentProviderConfigurations.id, input.id!));

					return ok({ id: input.id });
				});
			});

			if (res.isErr()) {
				return err(res.error);
			}

			return ok({ id: input.id });
		}
	);

async function checkIfPaymentProviderKeyIsAvailable(
	context: ServiceContext,
	key: string,
	providerId: string,
	projectId: string
) {
	const tx = context.tx ?? context.db;
	const existingConfigurations = await tx
		.select()
		.from(paymentProviderConfigurations)
		.where(
			and(
				eq(paymentProviderConfigurations.projectId, projectId),
				eq(paymentProviderConfigurations.providerId, providerId),
				eq(paymentProviderConfigurations.paymentProviderKey, key),
				isNotNull(paymentProviderConfigurations.deletedAt)
			)
		);

	if (existingConfigurations.length > 0) {
		return false;
	}

	return true;
}
