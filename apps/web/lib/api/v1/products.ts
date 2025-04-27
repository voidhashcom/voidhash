// import { Hono } from "hono";
// import { describeRoute } from "hono-openapi";
// import { resolver, validator as zValidator } from "hono-openapi/zod";
// import { createServerServiceContext } from "../../utils/create-server-service-context";
// import { authenticateContext } from "@/lib/service-function";
// import {
// 	attachProviderProductBodySchema,
// 	attachProviderProductParamsSchema,
// 	createProductBodySchema,
// 	customerResponseSchema,
// 	deleteProductParamsSchema,
// 	deleteProviderProductParamsSchema,
// 	getProductByIdParamsSchema,
// 	getProviderProductsParamsSchema,
// 	productResponseSchema,
// 	providerProductResponseSchema,
// 	updateProductBodySchema,
// 	updateProductParamsSchema,
// 	updateProviderProductBodySchema,
// 	updateProviderProductParamsSchema,
// } from "./schema";
// import { z } from "zod";
// import { createProduct } from "@/lib/services/products/create-product";
// import {
// 	getProductById,
// 	getProducts,
// 	getProviderProductsByProductId,
// } from "@/lib/services/products/queries";
// import { updateProduct } from "@/lib/services/products/update-product";
// import { deleteProduct } from "@/lib/services/products/delete-product";
// import { createPaymentProviderProduct } from "@/lib/services/products/create-payment-provider-product";
// import { updatePaymentProviderProduct } from "@/lib/services/products/update-payment-provider-product";
// import { paymentProviders } from "@/lib/payment-providers/payment-providers";
// import { deletePaymentProviderProduct } from "@/lib/services/products/delete-payment-provider-product";
// import { openApiErrorResponses } from "../../errors/openapi_responses";

// const app = new Hono()
// 	.post(
// 		"/",
// 		describeRoute({
// 			description: "Create a new product",
// 			operationId: "createProduct",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": { schema: resolver(customerResponseSchema) },
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("json", createProductBodySchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const projectId = authenticatedContext.session?.projects[0]?.id;

// 			if (!projectId) {
// 				return c.json({ error: "Project not found" }, 404);
// 			}

// 			const createdProduct = await createProduct.invoke({
// 				ctx: authenticatedContext,
// 				input: {
// 					name: c.req.valid("json").name,
// 					projectId,
// 				},
// 			});

// 			return c.json<z.infer<typeof productResponseSchema>>({
// 				productId: createdProduct.id,
// 				name: createdProduct.name,
// 			});
// 		}
// 	)
// 	.get(
// 		"/",
// 		describeRoute({
// 			description: "List products",
// 			operationId: "listProducts",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": {
// 							schema: resolver(z.array(productResponseSchema)),
// 						},
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),

// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const projectId = authenticatedContext.session?.projects[0]?.id;

// 			if (!projectId) {
// 				return c.json({ error: "Project not found" }, 404);
// 			}

// 			const products = await getProducts({
// 				ctx: authenticatedContext,
// 				input: {
// 					projectId,
// 				},
// 			});

// 			return c.json<z.infer<typeof productResponseSchema>[]>(
// 				products.map((product) => ({
// 					productId: product.id,
// 					name: product.name,
// 				}))
// 			);
// 		}
// 	)
// 	.get(
// 		"/:productId",
// 		describeRoute({
// 			description: "Get a product",
// 			operationId: "getProductById",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": { schema: resolver(productResponseSchema) },
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", getProductByIdParamsSchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");

// 			const product = await getProductById({
// 				ctx: authenticatedContext,
// 				input: {
// 					id: productId,
// 				},
// 			});

// 			if (!product) {
// 				return c.json({ error: "Product not found" }, 404);
// 			}

// 			return c.json<z.infer<typeof productResponseSchema>>({
// 				productId: product.id,
// 				name: product.name,
// 			});
// 		}
// 	)
// 	.put(
// 		"/:productId",
// 		describeRoute({
// 			description: "Update a product",
// 			operationId: "updateProduct",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": { schema: resolver(productResponseSchema) },
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", updateProductParamsSchema),
// 		zValidator("json", updateProductBodySchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");
// 			const name = c.req.valid("json").name;

// 			const updatedProduct = await updateProduct.invoke({
// 				ctx: authenticatedContext,
// 				input: {
// 					productId: productId,
// 					name,
// 				},
// 			});

// 			return c.json<z.infer<typeof productResponseSchema>>({
// 				productId: updatedProduct.id,
// 				name: updatedProduct.name,
// 			});
// 		}
// 	)
// 	.delete(
// 		"/:productId",
// 		describeRoute({
// 			description: "Delete a product",
// 			operationId: "deleteProduct",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": {
// 							schema: resolver(z.object({ message: z.string() })),
// 						},
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", deleteProductParamsSchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");

// 			await deleteProduct.invoke({
// 				ctx: authenticatedContext,
// 				input: {
// 					productId,
// 				},
// 			});

// 			return c.json({ message: "Product deleted" });
// 		}
// 	)
// 	.post(
// 		"/:productId/provider-products",
// 		describeRoute({
// 			description: "Attach a new provider product",
// 			operationId: "attachProviderProduct",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": {
// 							schema: resolver(providerProductResponseSchema),
// 						},
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", attachProviderProductParamsSchema),
// 		zValidator("json", attachProviderProductBodySchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");
// 			const providerId = c.req.valid("json").providerId;
// 			if (!providerId) {
// 				return c.json({ error: "Provider ID is required" }, 400);
// 			}
// 			if (!paymentProviders.find((p) => p.id === providerId)) {
// 				return c.json({ error: "Provider not found" }, 404);
// 			}

// 			const providerProduct = await createPaymentProviderProduct.invoke({
// 				ctx: authenticatedContext,
// 				input: {
// 					productId,
// 					providerId: providerId as string,
// 					configuration: c.req.valid("json").configuration,
// 				},
// 			});

// 			return c.json<z.infer<typeof providerProductResponseSchema>>({
// 				providerProductKey: providerProduct.providerProductKey,
// 				providerConfiguration: {
// 					providerId: providerProduct.providerId,
// 					configuration: providerProduct.configuration,
// 				},
// 			});
// 		}
// 	)
// 	.get(
// 		"/:productId/provider-products",
// 		describeRoute({
// 			description: "Get all provider products for a product",
// 			operationId: "getProviderProductsByProductId",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": {
// 							schema: resolver(z.array(providerProductResponseSchema)),
// 						},
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", getProviderProductsParamsSchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");

// 			const providerProducts = await getProviderProductsByProductId({
// 				ctx: authenticatedContext,
// 				input: {
// 					productId,
// 				},
// 			});

// 			return c.json<z.infer<typeof providerProductResponseSchema>[]>(
// 				providerProducts.map((providerProduct) => ({
// 					providerProductKey: providerProduct.providerProductKey,
// 					providerConfiguration: {
// 						providerId: providerProduct.providerId,
// 						configuration: providerProduct.configuration,
// 					},
// 				}))
// 			);
// 		}
// 	)
// 	.put(
// 		"/:productId/provider-products/:providerId/:providerProductKey",
// 		describeRoute({
// 			description: "Update a provider product",
// 			operationId: "updateProviderProduct",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 					content: {
// 						"application/json": {
// 							schema: resolver(providerProductResponseSchema),
// 						},
// 					},
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", updateProviderProductParamsSchema),
// 		zValidator("json", updateProviderProductBodySchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");
// 			const providerId = c.req.param("providerId");
// 			const providerProductKey = c.req.param("providerProductKey");
// 			const configuration = c.req.valid("json").configuration;

// 			const updatedProviderProduct = await updatePaymentProviderProduct.invoke({
// 				ctx: authenticatedContext,
// 				input: {
// 					productId,
// 					providerId,
// 					configuration,
// 					providerProductKey,
// 				},
// 			});

// 			return c.json<z.infer<typeof providerProductResponseSchema>>({
// 				providerProductKey: updatedProviderProduct.providerProductKey,
// 				providerConfiguration: updatedProviderProduct.configuration,
// 			});
// 		}
// 	)
// 	.delete(
// 		"/:productId/provider-products/:providerId/:providerProductKey",
// 		describeRoute({
// 			description: "Delete a provider product",
// 			operationId: "deleteProviderProduct",
// 			responses: {
// 				200: {
// 					description: "Successful response",
// 				},
// 				...openApiErrorResponses,
// 			},
// 			tags: ["products"],
// 		}),
// 		zValidator("param", deleteProviderProductParamsSchema),
// 		async (c) => {
// 			const context = c.get("services");
// 			const authenticatedContext = await authenticateContext(context);
// 			const productId = c.req.param("productId");
// 			const providerId = c.req.param("providerId");
// 			const providerProductKey = c.req.param("providerProductKey");

// 			await deletePaymentProviderProduct.invoke({
// 				ctx: authenticatedContext,
// 				input: {
// 					productId,
// 					providerId,
// 					providerProductKey,
// 				},
// 			});

// 			return c.json({ message: "Provider product deleted" });
// 		}
// 	);
// export default app;
