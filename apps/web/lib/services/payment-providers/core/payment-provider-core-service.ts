import { ServiceContext } from "@/lib/service-function";
import {
	and,
	charges,
	CheckoutSession,
	checkoutSessions,
	customersUnlockedPerks,
	eq,
	InsertPurchase,
	outbox,
	Product,
	PaymentProviderConfigurationProduct,
	paymentProviderConfigurationProducts,
	purchases,
	Transaction,
} from "@voidhash/db";
import {
	Environment,
	fromUnknownThrow,
	ISO4217CurrencyCode,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib/constants";
import { err, ok, Result } from "neverthrow";
import { getCustomerByIdQuery } from "../../customers/raw-queries";
import { generateId } from "@/lib/id/generate";
import { getProductPerksByProductIdQuery } from "../../products/raw-queries";

type ProcessSubscriptionPurchaseError =
	| VoidhashInternalServerError
	| {
			code: "PRODUCT_NOT_FOUND";
			message: string;
	  }
	| {
			code: "UNSUPPORTED_PRODUCT_TYPE";
			message: string;
	  }
	| {
			code: "CUSTOMER_NOT_FOUND";
			message: string;
	  };

export class PaymentProviderCoreService {
	async getCheckoutSession(
		ctx: ServiceContext,
		checkoutSessionId: string
	): Promise<
		Result<CheckoutSession, VoidhashInternalServerError | VoidhashNotFoundError>
	> {
		const tx = ctx.tx ?? ctx.db;
		try {
			const checkoutSession = await tx.query.checkoutSessions.findFirst({
				where: eq(checkoutSessions.id, checkoutSessionId),
			});

			if (!checkoutSession) {
				return err({
					code: "NOT_FOUND",
					message: "Checkout session not found",
					resource: "checkoutSession",
					payload: {
						checkoutSessionId,
					},
				});
			}

			return ok(checkoutSession);
		} catch (error) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: "Internal server error",
				originalError: error,
			});
		}
	}

	async getPaymentProviderConfigurationProductById(
		ctx: ServiceContext,
		paymentProviderConfigurationProductId: string
	): Promise<
		Result<
			PaymentProviderConfigurationProduct & {
				product: Product;
			},
			VoidhashInternalServerError | VoidhashNotFoundError
		>
	> {
		const tx = ctx.tx ?? ctx.db;
		const paymentProviderConfigurationProduct =
			await tx.query.paymentProviderConfigurationProducts.findFirst({
				where: and(
					eq(
						paymentProviderConfigurationProducts.id,
						paymentProviderConfigurationProductId
					)
				),
				with: {
					product: true,
				},
			});

		if (!paymentProviderConfigurationProduct) {
			return err({
				code: "NOT_FOUND",
				message: "Product provider configuration not found",
				resource: "paymentProviderConfigurationProduct",
				payload: {
					paymentProviderConfigurationProductId,
				},
			});
		}
		return ok(paymentProviderConfigurationProduct);
	}

	async processSubscriptionPurchase(
		ctx: ServiceContext,
		environment: Environment,
		paymentProviderConfigurationProduct: PaymentProviderConfigurationProduct & {
			product: Product;
		},
		options: {
			providerKey: string; // Unique identifier for the purchase in the payment provider
			customerId: string;
			status: "active" | "trialing" | "canceled";
			purchasedAt: Date;
			startsAt: Date;
			canceledAt: Date | null;
			cancelAtPeriodEnd: boolean;
			expiresAt: Date;
			charge?: {
				amount: number;
				currency: ISO4217CurrencyCode;
			};
		}
	): Promise<Result<void, ProcessSubscriptionPurchaseError>> {
		console.log("processSubscriptionPurchase", {
			paymentProviderConfigurationProduct,
			options,
		});
		if (paymentProviderConfigurationProduct.product.type !== "subscription") {
			return err({
				code: "UNSUPPORTED_PRODUCT_TYPE",
				message: "Only subscription products are supported for now",
			});
		}

		const customer = await getCustomerByIdQuery(ctx, options.customerId);
		if (customer.isErr()) {
			if (customer.error.code === "NOT_FOUND") {
				return err({
					code: "CUSTOMER_NOT_FOUND",
					message: "Customer not found",
				});
			}
			return err(customer.error);
		}

		const purchaseEnvironment = "production";

		const purchase = {
			id: generateId("purchase"),
			status: options.status,
			type: "subscription",
			customerId: options.customerId,
			paymentProviderConfigurationProductId:
				paymentProviderConfigurationProduct.id,
			purchasedAt: options.purchasedAt,
			startsAt: options.startsAt,
			canceledAt: options.canceledAt,
			cancelAtPeriodEnd: options.cancelAtPeriodEnd,
			purchaseEnvironment: purchaseEnvironment,
			expiresAt: options.expiresAt,
			providerKey: options.providerKey,
		} satisfies InsertPurchase;

		const productPerksResult = await getProductPerksByProductIdQuery(
			ctx,
			paymentProviderConfigurationProduct.product.id
		);

		if (productPerksResult.isErr()) {
			return err(productPerksResult.error);
		}

		try {
			return await ctx.db.transaction(async (tx: Transaction) => {
				const existingPurchase = await tx.query.purchases.findFirst({
					where: and(
						eq(purchases.providerKey, options.providerKey),
						eq(purchases.customerId, options.customerId)
					),
				});

				// Indempotency check
				if (existingPurchase) {
					return ok();
				}

				await tx.insert(purchases).values(purchase);

				// Add grants
				for (const productPerk of productPerksResult.value) {
					await tx.insert(customersUnlockedPerks).values({
						id: generateId("customerUnlockedPerk"),
						customerId: options.customerId,
						perkId: productPerk.perkId,
						unlockedByPurchaseId: purchase.id,
					});
				}

				if (options.charge) {
					await tx.insert(charges).values({
						id: generateId("charge"),
						customerId: options.customerId,
						amount: options.charge.amount,
						currency: options.charge.currency,
						purchaseId: purchase.id,
						paymentProviderConfigurationProductId:
							paymentProviderConfigurationProduct.id,
						environment,
						purchaseEnvironment: purchaseEnvironment,
					});
				}

				await tx.insert(outbox).values({
					id: generateId("outbox"),
					topic: "subscription.purchased",
					payload: {
						customerId: options.customerId,
						productId: paymentProviderConfigurationProduct.product.id,
						providerKey: options.providerKey,
						providerProductId: paymentProviderConfigurationProduct.id,
						paymentProviderConfigurationId:
							paymentProviderConfigurationProduct.paymentProviderConfigurationId,
						environment,
						startsAt: options.startsAt,
					},
				});

				return ok();
			});
		} catch (error) {
			return err(fromUnknownThrow(error));
		}
	}

	// async processProductPurchase(
	// 	ctx: ServiceContext,
	// 	tx: Transaction,
	// 	environment: Environment,
	// 	options: {
	// 		customerId: string;
	// 		price: number;
	// 		currency: ISO4217CurrencyCode;
	// 		providerProductId: string;
	// 		payload: SubscriptionPurchasePayload;
	// 	}
	// ): Promise<Result<void, ProcessProductPurchaseError>> {
	// 	try {
	// 		if (product.value.type !== "subscription") {
	// 			return err({
	// 				code: "UNSUPPORTED_PRODUCT_TYPE",
	// 				message: "Only subscription products are supported for now",
	// 			});
	// 		}

	// 		const customer = await getCustomerByIdQuery(ctx, options.customerId);
	// 		if (customer.isErr()) {
	// 			if (customer.error.code === "NOT_FOUND") {
	// 				return err({
	// 					code: "CUSTOMER_NOT_FOUND",
	// 					message: "Customer not found",
	// 				});
	// 			}
	// 			return err(customer.error);
	// 		}

	// 		const customerProduct = {
	// 			id: generateId("customerProduct"),
	// 			providerKey: options.providerKey,
	// 			status: options.payload.status,
	// 			type: "subscription",
	// 			customerId: options.customerId,
	// 			providerProductId: options.providerProductKey,
	// 			purchasedAt: options.payload.purchasedAt,
	// 			startsAt: options.payload.startsAt,
	// 			canceledAt: options.payload.canceledAt,
	// 			cancelAtPeriodEnd: options.payload.cancelAtPeriodEnd,
	// 			environment: environment,
	// 			expiresAt: options.payload.expiresAt,
	// 		};
	// 		try {
	// 			await (ctx.tx ?? ctx.db).insert(purchases).values(customerProduct);
	// 		} catch (error) {
	// 			return err(fromUnknownThrow(error));
	// 		}

	// 		// Add grants
	// 		const hasAccessToPerks =
	// 			event.status === "active" || event.status === "trialing";
	// 		if (hasAccessToPerks) {
	// 			const productPerks = await getProductPerksByProductIdQuery(
	// 				ctx,
	// 				providerProduct.value.productId
	// 			);

	// 			if (productPerks.isErr()) {
	// 				return err(productPerks.error);
	// 			}

	// 			for (const productPerk of productPerks.value) {
	// 				await db.insert(customersUnlockedPerks).values({
	// 					id: generateId("customerUnlockedPerk"),
	// 					customerId: event.customerId,
	// 					perkId: productPerk.perkId,
	// 					unlockedByCustomerProductId: customerProduct.id,
	// 				});
	// 			}
	// 		}
	// 	} catch (error) {
	// 		return err({
	// 			code: "INTERNAL_SERVER_ERROR",
	// 			message: "Internal server error",
	// 			originalError: error,
	// 		});
	// 	}
	// }
}

export function createPaymentProviderCoreService() {
	return new PaymentProviderCoreService();
}
