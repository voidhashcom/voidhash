import { Effect, pipe } from "effect";
import { ProductRepository } from "./product.repository";
import { AuthSession } from "@/lib/effect/auth";
import { Environment } from "@/lib/effect/environment";
import { checkProjectPermission } from "@/lib/effect/permissions";
import { NotFoundError } from "@/lib/effect/errors";
import { createProduct } from "./actions/create-product";
import { deleteProduct } from "./actions/delete-product";
import { updateProduct } from "./actions/update-product";
import { createPaymentProviderProduct } from "./actions/create-payment-provider-product";
import { createProductPerk } from "./actions/create-product-perk";
import { updatePaymentProviderProduct } from "./actions/update-payment-provider-product";
import { setActivePaymentProviderProduct } from "./actions/set-active-payment-provider-product";
import { deleteProductPerk as deleteProductPerkAction } from "./actions/delete-product-perk";
import { PerkRepository } from "../perks/perk.repository";

export class ProductService extends Effect.Service<ProductService>()(
	"ProductService",
	{
		effect: Effect.gen(function* () {
			const productRepository = yield* ProductRepository;
			return {
				// Core actions
				createProduct,
				deleteProduct,
				updateProduct,
				createPaymentProviderProduct,
				updatePaymentProviderProduct,
				setActivePaymentProviderProduct,

				// Query methods
				getProducts: (projectId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access products for project ${projectId}`
							);

							return yield* productRepository.getProducts({
								projectId,
								environment,
							});
						}),
						Environment.withEnvironment({
							projectId,
						}),
						AuthSession.withAuthSession()
					),

				getProductById: (id: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const product = yield* productRepository.getProductById(id);
							if (!product) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access product ${id} for project ${product.projectId}`
							);

							return product;
						}),
						AuthSession.withAuthSession()
					),

				// Provider product methods
				getProviderProductsByProductId: (productId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const product = yield* productRepository.getProductById(productId);
							if (!product) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access provider products for product ${productId}`
							);

							return yield* productRepository.getProviderProductsByProductId(productId);
						}),
						AuthSession.withAuthSession()
					),

				getProviderProductByPrimaryKey: ({
					paymentProviderConfigurationId,
					providerProductKey,
				}: {
					paymentProviderConfigurationId: string;
					providerProductKey: string;
				}) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const environment = yield* Environment;

							const providerProduct = yield* productRepository.getProviderProductByPrimaryKey({
								paymentProviderConfigurationId,
								providerProductKey,
								environment,
							});

							if (!providerProduct) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Provider product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								providerProduct.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access provider product for project ${providerProduct.projectId}`
							);

							return providerProduct;
						}),
						Environment.withEnvironment(),
						AuthSession.withAuthSession()
					),

				// Product perk methods
				getProductPerksByProductId: (productId: string) =>
					pipe(
						Effect.gen(function* () {
							const session = yield* AuthSession;
							const product = yield* productRepository.getProductById(productId);
							if (!product) {
								return yield* Effect.fail(
									new NotFoundError({
										message: "Product not found",
									})
								);
							}

							// SECURITY: Authorization check
							yield* checkProjectPermission(
								product.projectId,
								"project:all",
								`User ${session?.user?.id} is not authorized to access product perks for product ${productId}`
							);

							return yield* productRepository.getProductPerksByProductId(productId);
						}),
						AuthSession.withAuthSession()
					),

				createProductPerk,
				deleteProductPerk: deleteProductPerkAction,
			};
		}),

		// Specify dependencies
		dependencies: [ProductRepository.Default, PerkRepository.Default],
	}
) {}
