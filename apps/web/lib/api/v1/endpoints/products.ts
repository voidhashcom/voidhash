import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { createServerServiceContext } from "../../utils/create-server-service-context";
import { authenticateContext } from "@/lib/service-function";
import {
	attachProviderProductBodySchema,
	attachProviderProductParamsSchema,
	createProductBodySchema,
	customerResponseSchema,
	deleteProductParamsSchema,
	deleteProviderProductParamsSchema,
	getProductByIdParamsSchema,
	getProviderProductsParamsSchema,
	productResponseSchema,
	providerProductResponseSchema,
	updateProductBodySchema,
	updateProductParamsSchema,
	updateProviderProductBodySchema,
	updateProviderProductParamsSchema,
} from "./schema";
import { z } from "zod";
import { createProduct } from "@/lib/services/products/create-product";
import {
	getProductById,
	getProducts,
	getProviderProductsByProductId,
} from "@/lib/services/products/queries";
import { updateProduct } from "@/lib/services/products/update-product";
import { deleteProduct } from "@/lib/services/products/delete-product";
import { createPaymentProviderProduct } from "@/lib/services/products/create-payment-provider-product";
import { updatePaymentProviderProduct } from "@/lib/services/products/update-payment-provider-product";
import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { deletePaymentProviderProduct } from "@/lib/services/products/delete-payment-provider-product";

const app = new Hono()
	.post(
		"/",
		describeRoute({
			description: "Create a new product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(customerResponseSchema) },
					},
				},
			},
		}),
		zValidator("json", createProductBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const createdProduct = await createProduct({
				ctx: authenticatedContext,
				input: {
					name: c.req.valid("json").name,
					projectId,
				},
			});
			const response: z.infer<typeof productResponseSchema> = {
				productId: createdProduct.id,
				name: createdProduct.name,
			};
			return c.json(response);
		}
	)
	.get(
		"/",
		describeRoute({
			description: "List products",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(z.array(productResponseSchema)),
						},
					},
				},
			},
		}),

		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const products = await getProducts({
				ctx: authenticatedContext,
				input: {
					projectId,
				},
			});

			const response: z.infer<typeof productResponseSchema>[] = products.map(
				(product) => ({
					productId: product.id,
					name: product.name,
				})
			);

			return c.json(response);
		}
	)
	.get(
		"/:productId",
		describeRoute({
			description: "Get a product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(productResponseSchema) },
					},
				},
			},
		}),
		zValidator("param", getProductByIdParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");

			const product = await getProductById({
				ctx: authenticatedContext,
				input: {
					id: productId,
				},
			});

			if (!product) {
				return c.json({ error: "Product not found" }, 404);
			}

			const response: z.infer<typeof productResponseSchema> = {
				productId: product.id,
				name: product.name,
			};

			return c.json(response);
		}
	)
	.put(
		"/:productId",
		describeRoute({
			description: "Update a product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(productResponseSchema) },
					},
				},
			},
		}),
		zValidator("param", updateProductParamsSchema),
		zValidator("json", updateProductBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const name = c.req.valid("json").name;

			const updatedProduct = await updateProduct({
				ctx: authenticatedContext,
				input: {
					productId: productId,
					name,
				},
			});

			const response: z.infer<typeof productResponseSchema> = {
				productId: updatedProduct.id,
				name: updatedProduct.name,
			};

			return c.json(response);
		}
	)
	.delete(
		"/:productId",
		describeRoute({
			description: "Delete a product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(z.object({ message: z.string() })),
						},
					},
				},
			},
		}),
		zValidator("param", deleteProductParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");

			await deleteProduct({
				ctx: authenticatedContext,
				input: {
					productId,
				},
			});

			return c.json({ message: "Product deleted" });
		}
	)
	.post(
		"/:productId/provider-products",
		describeRoute({
			description: "Attach a new provider product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(providerProductResponseSchema),
						},
					},
				},
			},
		}),
		zValidator("param", attachProviderProductParamsSchema),
		zValidator("json", attachProviderProductBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const providerId = c.req.valid("json").providerId;
			if (!providerId) {
				return c.json({ error: "Provider ID is required" }, 400);
			}
			if (!paymentProviders.find((p) => p.id === providerId)) {
				return c.json({ error: "Provider not found" }, 404);
			}

			const providerProduct = await createPaymentProviderProduct({
				ctx: authenticatedContext,
				input: {
					productId,
					providerId: providerId as string,
					configuration: c.req.valid("json").configuration,
				},
			});

			const response: z.infer<typeof providerProductResponseSchema> = {
				providerProductId: providerProduct.providerProductKey,
				providerConfiguration: {
					providerId: providerProduct.providerId,
					configuration: providerProduct.configuration,
				},
			};

			return c.json(response);
		}
	)
	.get(
		"/:productId/provider-products",
		describeRoute({
			description: "Get all provider products for a product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(z.array(providerProductResponseSchema)),
						},
					},
				},
			},
		}),
		zValidator("param", getProviderProductsParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");

			const providerProducts = await getProviderProductsByProductId({
				ctx: authenticatedContext,
				input: {
					productId,
				},
			});

			const response: z.infer<typeof providerProductResponseSchema>[] =
				providerProducts.map((providerProduct) => ({
					providerProductId: providerProduct.providerProductKey,
					providerConfiguration: {
						providerId: providerProduct.providerId,
						configuration: providerProduct.configuration,
					},
				}));

			return c.json(response);
		}
	)
	.put(
		"/:productId/provider-products/:providerId/:providerProductKey",
		describeRoute({
			description: "Update a provider product",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(providerProductResponseSchema),
						},
					},
				},
			},
		}),
		zValidator("param", updateProviderProductParamsSchema),
		zValidator("json", updateProviderProductBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const providerId = c.req.param("providerId");
			const providerProductKey = c.req.param("providerProductKey");
			const configuration = c.req.valid("json").configuration;

			const updatedProviderProduct = await updatePaymentProviderProduct({
				ctx: authenticatedContext,
				input: {
					productId,
					providerId,
					configuration,
					providerProductKey,
				},
			});

			const response: z.infer<typeof providerProductResponseSchema> = {
				providerProductId: updatedProviderProduct.providerProductKey,
				providerConfiguration: updatedProviderProduct.configuration,
			};

			return c.json(response);
		}
	)
	.delete(
		"/:productId/provider-products/:providerId/:providerProductKey",
		describeRoute({
			description: "Delete a provider product",
			responses: {
				200: {
					description: "Successful response",
				},
			},
		}),
		zValidator("param", deleteProviderProductParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const productId = c.req.param("productId");
			const providerId = c.req.param("providerId");
			const providerProductKey = c.req.param("providerProductKey");

			await deletePaymentProviderProduct({
				ctx: authenticatedContext,
				input: {
					productId,
					providerId,
					providerProductKey,
				},
			});

			return c.json({ message: "Provider product deleted" });
		}
	);
export default app;
