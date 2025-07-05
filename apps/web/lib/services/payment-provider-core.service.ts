import { Data, Effect, pipe } from "effect";
import { Db, TransactionContext } from "@/lib/effect/db";
import { CustomerRepository } from "@/lib/repositories/customer.repository";
import { PaymentProviderConfigurationProductRepository } from "@/lib/repositories/payment-provider-configuration-product.repository";
import { ProductPerkRepository } from "@/lib/repositories/product-perk.repository";
import { SubscriptionRepository } from "@/lib/repositories/subscription.repository";
import { ProviderEnvironmentValue, InsertSubscription, InsertCustomerUnlockedPerk } from "@voidhash/db";
import { SubscriptionStatus } from "@voidhash/lib/constants";
import { generateId } from "@/lib/id/generate";

export class CustomerNotFoundError extends Data.TaggedError(
	"CustomerNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError extends Data.TaggedError(
	"SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class SubscriptionWithSameInitialTransactionIdAlreadyExistsError extends Data.TaggedError(
	"SubscriptionWithSameInitialTransactionIdAlreadyExistsError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class PaymentProviderConfigurationProductNotFoundError extends Data.TaggedError(
	"PaymentProviderConfigurationProductNotFoundError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}


export class PaymentProviderCoreService extends Effect.Service<PaymentProviderCoreService>()("PaymentProviderCoreService", {
	effect: Effect.gen(function* () {
		return {
			createSubscription: (input: {
				customerId: string;
				transactionId: string;
				storeSubscriptionId: string;
				paymentProviderConfigurationProductId: string;
				isTrial: boolean;
				purchasedAt: Date;
				startsAt: Date;
				canceledAt: Date | null;
				cancelAtPeriodEnd: boolean;
				expiresAt: Date | null;
				providerEnvironment: ProviderEnvironmentValue;
			}) =>
				pipe(
					Effect.gen(function* () {
						const customerRepository = yield* CustomerRepository;
						const subscriptionRepository = yield* SubscriptionRepository;
						const paymentProviderConfigurationProductRepository =
							yield* PaymentProviderConfigurationProductRepository;
						const productPerkRepository = yield* ProductPerkRepository;
						const db = yield* Db;
			
						const [customer, paymentProviderProduct] = yield* Effect.all([
							customerRepository.getCustomerById(input.customerId),
							paymentProviderConfigurationProductRepository.getProviderProductById(
								input.paymentProviderConfigurationProductId
							),
						]);
			
						if (!customer) {
							return yield* Effect.fail(
								new CustomerNotFoundError({
									message: `Customer with id ${input.customerId} not found`,
								})
							);
						}
			
						if (!paymentProviderProduct) {
							return yield* Effect.fail(
								new PaymentProviderConfigurationProductNotFoundError({
									message: `Payment provider configuration product with id ${input.paymentProviderConfigurationProductId} not found`,
								})
							);
						}
			
						const productPerks =
							yield* productPerkRepository.getProductPerksByProductId(
								paymentProviderProduct.productId
							);
			
						const newSubscription = {
							id: generateId("subscription"),
							status: SubscriptionStatus.Active,
							customerId: input.customerId,
							initialTransactionId: input.transactionId,
							latestTransactionId: input.transactionId,
							storeSubscriptionId: input.storeSubscriptionId,
							paymentProviderConfigurationProductId:
								input.paymentProviderConfigurationProductId,
							purchasedAt: input.purchasedAt,
							startsAt: input.startsAt,
							canceledAt: input.canceledAt,
							cancelAtPeriodEnd: input.cancelAtPeriodEnd,
							providerEnvironment: input.providerEnvironment,
							expiresAt: input.expiresAt,
						} satisfies InsertSubscription;
			
						const newUnlockedPerks = productPerks.map(
							(perk) =>
								({
									id: generateId("customerUnlockedPerk"),
									customerId: input.customerId,
									perkId: perk.id,
									unlockedBySubscriptionId: newSubscription.id,
									unlockedByPurchaseId: null,
									expiresAt: input.expiresAt,
								}) satisfies InsertCustomerUnlockedPerk
						);
			
						yield* db.transaction((tx) =>
							TransactionContext.provide(tx)(
								pipe(
									assertSubscriptionDoesNotExist(
										customer.projectId,
										input.transactionId,
										input.storeSubscriptionId
									),
									Effect.andThen(
										subscriptionRepository.createSubscription(newSubscription)
									),
									Effect.andThen(
										customerRepository.createCustomerUnlockedPerks(newUnlockedPerks)
									)
								)
							)
						);
					})
				)
		};
	}),

	// Specify dependencies
	dependencies: [],
}) {}

const assertSubscriptionDoesNotExist = (
	projectId: string,
	transactionId: string,
	storeSubscriptionId: string
) =>
	Effect.gen(function* () {
		const subscriptionRepository = yield* SubscriptionRepository;
		const [
			subscriptionWithSameStoreSubscriptionId,
			subscriptionWithSameTransactionId,
		] = yield* Effect.all([
			subscriptionRepository.getSubscriptionByStoreSubscriptionId({
				storeSubscriptionId,
				projectId,
			}),
			subscriptionRepository.getSubscriptionByInitialTransactionId({
				initialTransactionId: transactionId,
				projectId,
			}),
		]);

		if (subscriptionWithSameTransactionId) {
			return yield* Effect.fail(
				new SubscriptionWithSameInitialTransactionIdAlreadyExistsError({
					message: `Subscription with initial transaction id ${transactionId} already exists`,
				})
			);
		}

		if (subscriptionWithSameStoreSubscriptionId) {
			return yield* Effect.fail(
				new SubscriptionWithSameStoreSubscriptionIdAlreadyExistsError({
					message: `Subscription with store subscription id ${storeSubscriptionId} already exists`,
				})
			);
		}
	});