import { generateId } from "@/lib/id/generate";
import { safeTryPromise } from "@/lib/neverthrow";
import { ServiceContext } from "@/lib/service-function";
import {
	Transaction,
	customersUnlockedPerks,
	transactions,
	subscriptions,
	InsertTransaction,
} from "@voidhash/db";
import {
	ISO4217CurrencyCode,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { and, eq } from "drizzle-orm";
import { Result, err, ok } from "neverthrow";

type SubscriptionNotFoundError = {
	code: "SUBSCRIPTION_NOT_FOUND";
	message: string;
};

type ProcessSubscriptionRenewalOptions = {
	subscriptionId: string;
	renewedAt: Date;
	expiresAt: Date | null;
	transaction: {
		amount: number;
		currency: ISO4217CurrencyCode;
		storeTransactionId?: string;
	};
};

export const processSubscriptionRenewal = async (
	ctx: ServiceContext,
	options: ProcessSubscriptionRenewalOptions
): Promise<
	Result<void, SubscriptionNotFoundError | VoidhashInternalServerError>
> => {
	const res = await safeTryPromise(async () => {
		if (!ctx.tx) {
			const res = await ctx.db.transaction(async (tx: Transaction) => {
				return await processSubscriptionRenewalInner({ ...ctx, tx }, options);
			});

			return res;
		}
		return await processSubscriptionRenewalInner(ctx, options);
	});

	if (res.isErr()) {
		return err(res.error);
	}

	return ok();
};

const processSubscriptionRenewalInner = async (
	ctx: ServiceContext,
	options: ProcessSubscriptionRenewalOptions
): Promise<
	Result<void, SubscriptionNotFoundError | VoidhashInternalServerError>
> => {
	const tx = ctx.tx ?? ctx.db;

	const subscriptionResult = await safeTryPromise(async () => {
		const res = await tx.query.subscriptions.findFirst({
			where: eq(subscriptions.id, options.subscriptionId),
		});
		return ok(res);
	});

	if (subscriptionResult.isErr()) {
		return err(subscriptionResult.error);
	}

	if (!subscriptionResult.value) {
		return err({
			code: "SUBSCRIPTION_NOT_FOUND",
			message: "Subscription not found",
		} satisfies SubscriptionNotFoundError);
	}

	const subscription = subscriptionResult.value;

	const transactionId = generateId("transaction");
	const transaction = {
		id: transactionId,
		customerId: subscription.customerId,
		amount: options.transaction.amount,
		currency: options.transaction.currency,
		storeTransactionId: options.transaction.storeTransactionId,
		paymentProviderConfigurationProductId:
			subscription.paymentProviderConfigurationProductId,
		providerEnvironment: subscription.providerEnvironment,
		occurredAt: options.renewedAt,
	} satisfies InsertTransaction;
	await tx.insert(transactions).values(transaction);

	// Update subscription
	await tx
		.update(subscriptions)
		.set({
			expiresAt: options.expiresAt,
			status: "active",
			latestTransactionId: transactionId,
		})
		.where(eq(subscriptions.id, subscription.id));

	const customerUnlockedPerksResult = await safeTryPromise(async () => {
		return ok(
			await tx.query.customersUnlockedPerks.findMany({
				where: and(
					eq(customersUnlockedPerks.customerId, subscription.customerId),
					eq(customersUnlockedPerks.unlockedBySubscriptionId, subscription.id)
				),
			})
		);
	});

	if (customerUnlockedPerksResult.isErr()) {
		return err(customerUnlockedPerksResult.error);
	}

	// Update unlocked perks
	for (const customerUnlockedPerk of customerUnlockedPerksResult.value) {
		await tx
			.update(customersUnlockedPerks)
			.set({
				expiresAt: options.expiresAt,
				status: "active",
			})
			.where(eq(customersUnlockedPerks.id, customerUnlockedPerk.id));
	}

	// TODO: Send outbox message

	return ok();
};
