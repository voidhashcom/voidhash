import {
	createServiceFunction,
	hasProjectPermission,
	ServiceContext,
} from "@/lib/service-function";
import { z } from "zod";
import {
	projectPaymentProviderConfigurations,
	Transaction,
} from "@voidhash/db";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { and, eq } from "drizzle-orm";
import {
	fromUnknownThrow,
	VoidhashBadRequestError,
	VoidhashForbiddenError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
	VoidhashUnauthorizedError,
} from "@voidhash/lib";
import {
	getExistingPaymentProviderConfigurationByIdQuery,
	getPaymentProviderConfigurationByIdQuery,
} from "../raw-queries";
import { generateId } from "@/lib/id/generate";
import { err, ok, Result } from "neverthrow";
import { isAuthenticated } from "@/lib/middlewares";
import { PaymentProvider } from "../core/payment-provider";

export const savePaymentProviderConfigurationInputSchema = z.object({
	id: z.string().optional(),
	providerId: z.enum(
		paymentProviders.map((p) => p.getId()) as [string, ...string[]]
	),
	projectId: z.string(),
	enabled: z.boolean(),
	name: z.string().min(1).max(255).optional(),
	configuration: z.object({}).passthrough(),
});

type SavePaymentProviderConfigurationError =
	| VoidhashUnauthorizedError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashNotFoundError
	| VoidhashBadRequestError;

export const savePaymentProviderConfiguration = createServiceFunction()
	.input(savePaymentProviderConfigurationInputSchema)
	.use(isAuthenticated)
	.function(
		async ({
			input,
			ctx,
		}): Promise<Result<void, SavePaymentProviderConfigurationError>> => {
			if (!hasProjectPermission(ctx, input.projectId, "project:all")) {
				return err({
					code: "FORBIDDEN",
					message:
						"You are not authorized to save this payment provider configuration",
				});
			}

			const provider = paymentProviders.find(
				(p) => p.getId() === input.providerId
			);
			if (!provider) {
				return err({
					code: "NOT_FOUND",
					message: `Provider ${input.providerId} not found`,
					resource: "payment_provider",
					payload: {
						providerId: input.providerId,
					},
				});
			}

			if (provider.getType() === "native") {
				return storeAppStorePaymentProviderConfiguration(
					ctx,
					input.id ?? null,
					input.projectId,
					provider,
					input.enabled,
					input.name ?? provider.getTitle(),
					input.configuration
				);
			}

			if (provider.getType() === "web-checkout") {
				return storeWebCheckoutPaymentProviderConfiguration(
					ctx,
					input.projectId,
					provider,
					input.enabled,
					input.name ?? provider.getTitle(),
					input.configuration
				);
			}

			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Unknown payment provider type",
				originalError: new Error("Unknown payment provider type"),
			});
		}
	);

async function storeAppStorePaymentProviderConfiguration(
	ctx: ServiceContext,
	id: string | null,
	projectId: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	paymentProvider: PaymentProvider<any, any, any>,
	enabled: boolean,
	name: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configuration: any
): Promise<Result<void, SavePaymentProviderConfigurationError>> {
	// If enabled - we need to validate the configuration

	const requireValidation = enabled;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const configurationSchema: z.ZodObject<any> | undefined =
		paymentProvider.getGlobalConfigurationSchema();

	if (requireValidation && !configurationSchema) {
		return err({
			code: "BAD_REQUEST",
			message: `Provider ${paymentProvider.getId()} does not have a configuration`,
		} satisfies VoidhashBadRequestError);
	}
	try {
		const parsedConfiguration =
			requireValidation && configurationSchema
				? configurationSchema.parse(configuration)
				: configuration;

		return await ctx.db.transaction(async (tx: Transaction) => {
			if (id) {
				const existingConfiguration =
					await getPaymentProviderConfigurationByIdQuery(
						{
							...ctx,
							tx,
						},
						id
					);
				if (existingConfiguration.isErr()) {
					return err(existingConfiguration.error);
				}
				await tx
					.update(projectPaymentProviderConfigurations)
					.set({
						configuration: parsedConfiguration,
						enabled: enabled,
						name: name,
					})
					.where(eq(projectPaymentProviderConfigurations.id, id));

				return ok(undefined);
			} else {
				await ctx.db.insert(projectPaymentProviderConfigurations).values({
					id: generateId("projectPaymentProviderConfiguration"),
					providerId: paymentProvider.getId(),
					projectId: projectId,
					enabled: enabled,
					name: name,
					configuration: parsedConfiguration,
				});

				return ok(undefined);
			}
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return err({
				code: "BAD_REQUEST",
				message: "Validation error",
				validationErrors: error,
			} satisfies VoidhashBadRequestError);
		}

		return err(fromUnknownThrow(error));
	}
}

async function storeWebCheckoutPaymentProviderConfiguration(
	ctx: ServiceContext,
	projectId: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	paymentProvider: PaymentProvider<any, any, any>,
	enabled: boolean,
	name: string,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	configuration: any
): Promise<Result<void, SavePaymentProviderConfigurationError>> {
	try {
		if (enabled) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const configurationSchema: z.ZodObject<any> | undefined =
				paymentProvider.getGlobalConfigurationSchema();
			if (!configurationSchema) {
				return err({
					code: "BAD_REQUEST",
					message: `Provider ${paymentProvider.getId()} does not have a configuration`,
				} satisfies VoidhashBadRequestError);
			}
			const parsedConfiguration = configurationSchema.parse(configuration);

			const existingConfiguration =
				await getExistingPaymentProviderConfigurationByIdQuery(
					ctx,
					projectId,
					paymentProvider.getId()
				);

			// Update if exists
			if (existingConfiguration.isOk()) {
				await ctx.db
					.update(projectPaymentProviderConfigurations)
					.set({
						configuration: parsedConfiguration,
						enabled: enabled,
						name: name,
					})
					.where(
						and(
							eq(
								projectPaymentProviderConfigurations.providerId,
								paymentProvider.getId()
							),
							eq(projectPaymentProviderConfigurations.projectId, projectId)
						)
					);
				return ok(undefined);
			}

			// Create if not found
			if (existingConfiguration.error.code === "NOT_FOUND") {
				try {
					await ctx.db.insert(projectPaymentProviderConfigurations).values({
						id: generateId("projectPaymentProviderConfiguration"),
						providerId: paymentProvider.getId(),
						projectId: projectId,
						enabled: enabled,
						name: name ?? paymentProvider.getTitle(),
						configuration: parsedConfiguration,
					});
					return ok(undefined);
				} catch (e) {
					return err(fromUnknownThrow(e));
				}
			}

			return err(existingConfiguration.error);
		}

		await ctx.db
			.update(projectPaymentProviderConfigurations)
			.set({
				enabled: false,
			})
			.where(
				and(
					eq(
						projectPaymentProviderConfigurations.providerId,
						paymentProvider.getId()
					),
					eq(projectPaymentProviderConfigurations.projectId, projectId)
				)
			);
		return ok(undefined);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return err({
				code: "BAD_REQUEST",
				message: "Validation error",
				validationErrors: error,
			} satisfies VoidhashBadRequestError);
		}
		return err(fromUnknownThrow(error));
	}
}
