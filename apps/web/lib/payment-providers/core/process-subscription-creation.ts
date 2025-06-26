import { generateId } from "@/lib/id/generate";
import { safeTryPromise } from "@/lib/neverthrow";
import { ServiceContext } from "@/lib/service-function";
import { getCustomerByIdQuery } from "@/lib/services/customers/raw-q	ueries";
import { getProductPerksByProductIdQuery } from "@/lib/services/products/raw-queries";
import {
	Transaction,
	customersUnlockedPerks,
	transactions,
	Product,
	PaymentProviderConfigurationProduct,
	InsertSubscription,
	subscriptions,
	InsertTransaction,
} from "@voidhash/db";
import {
	ISO4217CurrencyCode,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { and, eq } from "drizzle-orm";
import { Result, err, ok } from "neverthrow";

type CustomerNotFoundError = {
	code: "CUSTOMER_NOT_FOUND";
	message: string;
};

type PaymentProviderConfigurationTypeNotSupported = {
	code: "PAYMENT_PROVIDER_CONFIGURATION_TYPE_NOT_SUPPORTED";
	message: string;
};

type SubscriptionAlreadyExists = {
	code: "SUBSCRIPTION_ALREADY_EXISTS";
	message: string;
};

type ProcessSubscriptionCreationOptions = {
	customerId: string;
	isTrial: boolean;
	purchasedAt: Date;
	startsAt: Date;
	canceledAt: Date | null;
	cancelAtPeriodEnd: boolean;
	expiresAt: Date | null;
	providerEnvironment: "production" | "sandbox";
	storeSubscriptionId: string;
	transaction: {
		amount: number;
		currency: ISO4217CurrencyCode;
		storeTransactionId?: string;
	};
};

export const processSubscriptionCreation = async (
	ctx: ServiceContext,
	paymentProviderConfigurationProduct: PaymentProviderConfigurationProduct & {
		product: Product;
	},
	options: ProcessSubscriptionCreationOptions
): Promise<
	Result<
		InsertSubscription,
		| CustomerNotFoundError
		| PaymentProviderConfigurationTypeNotSupported
		| SubscriptionAlreadyExists
		| VoidhashInternalServerError
	>
> => {
	const res = await safeTryPromise(async () => {
		if (!ctx.tx) {
			const res = await ctx.db.transaction(async (tx: Transaction) => {
				return await processSubscriptionCreationInner(
					{ ...ctx, tx },
					paymentProviderConfigurationProduct,
					options
				);
			});

			return res;
		}
		return await processSubscriptionCreationInner(
			ctx,
			paymentProviderConfigurationProduct,
			options
		);
	});

	if (res.isErr()) {
		return err(res.error);
	}

	return ok(res.value);
};

const processSubscriptionCreationInner = async (
	ctx: ServiceContext,
	paymentProviderConfigurationProduct: PaymentProviderConfigurationProduct & {
		product: Product;
	},
	options: ProcessSubscriptionCreationOptions
): Promise<
	Result<
		InsertSubscription,
		| CustomerNotFoundError
		| PaymentProviderConfigurationTypeNotSupported
		| SubscriptionAlreadyExists
		| VoidhashInternalServerError
	>
> => {
	const tx = ctx.tx ?? ctx.db;
	if (paymentProviderConfigurationProduct.product.type !== "subscription") {
		return err({
			code: "PAYMENT_PROVIDER_CONFIGURATION_TYPE_NOT_SUPPORTED",
			message:
				"Attempting to create a subscription for a non-subscription product. Change the product type to subscription or use different subscription product.",
		} satisfies PaymentProviderConfigurationTypeNotSupported);
	}

	const customer = await getCustomerByIdQuery(ctx, options.customerId);
	if (customer.isErr()) {
		if (customer.error.code === "NOT_FOUND") {
			return err({
				code: "CUSTOMER_NOT_FOUND",
				message: "Customer not found",
			} satisfies CustomerNotFoundError);
		}
		return err(customer.error);
	}

	const transactionId = generateId("transaction");
	const transaction = {
		id: transactionId,
		customerId: options.customerId,
		amount: options.transaction.amount,
		currency: options.transaction.currency,
		storeTransactionId: options.transaction.storeTransactionId,
		paymentProviderConfigurationProductId:
			paymentProviderConfigurationProduct.id,
		providerEnvironment: options.providerEnvironment,
		occurredAt: options.purchasedAt,
	} satisfies InsertTransaction;
	await tx.insert(transactions).values(transaction);

	const existingSubscription = await tx.query.subscriptions.findFirst({
		where: and(
			eq(subscriptions.storeSubscriptionId, options.storeSubscriptionId),
			eq(subscriptions.customerId, options.customerId)
		),
	});

	if (existingSubscription) {
		return err({
			code: "SUBSCRIPTION_ALREADY_EXISTS",
			message: "Subscription already exists",
		} satisfies SubscriptionAlreadyExists);
	}

	const productPerksResult = await getProductPerksByProductIdQuery(
		ctx,
		paymentProviderConfigurationProduct.product.id
	);

	if (productPerksResult.isErr()) {
		return err(productPerksResult.error);
	}

	const subscription = {
		id: generateId("subscription"),
		status: "active",
		customerId: options.customerId,
		initialTransactionId: transactionId,
		latestTransactionId: transactionId,
		storeSubscriptionId: options.storeSubscriptionId,
		paymentProviderConfigurationProductId:
			paymentProviderConfigurationProduct.id,
		purchasedAt: options.purchasedAt,
		startsAt: options.startsAt,
		canceledAt: options.canceledAt,
		cancelAtPeriodEnd: options.cancelAtPeriodEnd,
		providerEnvironment: options.providerEnvironment,
		expiresAt: options.expiresAt,
	} satisfies InsertSubscription;

	await tx.insert(subscriptions).values(subscription);

	// Add grants
	for (const productPerk of productPerksResult.value) {
		await tx.insert(customersUnlockedPerks).values({
			id: generateId("customerUnlockedPerk"),
			customerId: options.customerId,
			perkId: productPerk.perkId,
			unlockedBySubscriptionId: subscription.id,
			unlockedByPurchaseId: null,
			expiresAt: options.expiresAt,
		});
	}

	// TODO: Send outbox message
	// await tx.insert(outbox).values({
	// 	id: generateId("outbox"),
	// 	topic: "subscription.purchased",
	// 	payload: {
	// 		customerId: options.customerId,
	// 		productId: paymentProviderConfigurationProduct.product.id,
	// 		storeSubscriptionId: options.storeSubscriptionId,
	// 		providerProductId: paymentProviderConfigurationProduct.id,
	// 		paymentProviderConfigurationId:
	// 			paymentProviderConfigurationProduct.paymentProviderConfigurationId,
	// 		providerEnvironment: options.providerEnvironment,
	// 		environment: customer.value.environment,
	// 		startsAt: options.startsAt,
	// 	},
	// });

	return ok(subscription);
};
