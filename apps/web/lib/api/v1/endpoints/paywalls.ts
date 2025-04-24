import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { createServerServiceContext } from "../../utils/create-server-service-context";
import { authenticateContext } from "@/lib/service-function";
import {
	attachProductToPaywallBodySchema,
	attachProductToPaywallParamsSchema,
	createPaywallBodySchema,
	deletePaywallParamsSchema,
	deletePaywallProductParamsSchema,
	getPaywallByIdParamsSchema,
	getPaywallProductsParamsSchema,
	paywallProductResponseSchema,
	paywallResponseSchema,
} from "./schema";
import { createPaywall } from "@/lib/services/paywalls/create-paywall";
import {
	getPaywallById,
	getPaywallProducts,
	getPaywalls,
} from "@/lib/services/paywalls/queries";
import { deletePaywall } from "@/lib/services/paywalls/delete-paywall";
import { createPaywallProduct } from "@/lib/services/paywalls/create-paywall-product";
import { deletePaywallProduct } from "@/lib/services/paywalls/delete-paywall-product";

const app = new Hono()
	// Create Paywall
	.post(
		"/",
		describeRoute({
			description: "Create a new paywall",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(paywallResponseSchema) },
					},
				},
			},
			tags: ["paywalls"],
		}),
		zValidator("json", createPaywallBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const createdPaywall = await createPaywall({
				ctx: authenticatedContext,
				input: {
					name: c.req.valid("json").name,
					projectId,
				},
			});
			const response: z.infer<typeof paywallResponseSchema> = {
				paywallId: createdPaywall.id,
				name: createdPaywall.name,
			};
			return c.json(response);
		}
	)
	// List Paywalls
	.get(
		"/",
		describeRoute({
			description: "List paywalls",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(z.array(paywallResponseSchema)),
						},
					},
				},
			},
			tags: ["paywalls"],
		}),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const paywalls = await getPaywalls({
				ctx: authenticatedContext,
				input: {
					projectId,
				},
			});

			const response: z.infer<typeof paywallResponseSchema>[] = paywalls.map(
				(paywall) => ({
					paywallId: paywall.id,
					name: paywall.name,
					projectId: paywall.projectId,
				})
			);

			return c.json(response);
		}
	)
	// Get Paywall by ID
	.get(
		"/:paywallId",
		describeRoute({
			description: "Get a paywall",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": { schema: resolver(paywallResponseSchema) },
					},
				},
			},
			tags: ["paywalls"],
		}),
		zValidator("param", getPaywallByIdParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");

			const paywall = await getPaywallById({
				ctx: authenticatedContext,
				input: {
					id: paywallId,
				},
			});

			if (!paywall) {
				return c.json({ error: "Paywall not found" }, 404);
			}

			const response: z.infer<typeof paywallResponseSchema> = {
				paywallId: paywall.id,
				name: paywall.name,
			};

			return c.json(response);
		}
	)
	// Delete Paywall
	.delete(
		"/:paywallId",
		describeRoute({
			description: "Delete a paywall",
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
			tags: ["paywalls"],
		}),
		zValidator("param", deletePaywallParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");

			await deletePaywall({
				ctx: authenticatedContext,
				input: {
					paywallId,
				},
			});

			return c.json({ message: "Paywall deleted" });
		}
	)
	// Attach Product to Paywall
	.post(
		"/:paywallId/products",
		describeRoute({
			description: "Attach a product to a paywall",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(paywallProductResponseSchema),
						},
					},
				},
			},
			tags: ["paywalls"],
		}),
		zValidator("param", attachProductToPaywallParamsSchema),
		zValidator("json", attachProductToPaywallBodySchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");
			const productId = c.req.valid("json").productId;

			const paywallProduct = await createPaywallProduct({
				ctx: authenticatedContext,
				input: {
					paywallId,
					productId,
				},
			});

			// Note: createPaywallProduct returns { paywallId, productId }, but the query for productName is separate.
			// We'll return what we have for now.
			const response: z.infer<typeof paywallProductResponseSchema> = {
				paywallId: paywallProduct.paywallId,
				productId: paywallProduct.productId,
				productName: null, // productName is not directly available here
			};

			return c.json(response);
		}
	)
	// List Products for Paywall
	.get(
		"/:paywallId/products",
		describeRoute({
			description: "Get all products for a paywall",
			responses: {
				200: {
					description: "Successful response",
					content: {
						"application/json": {
							schema: resolver(z.array(paywallProductResponseSchema)),
						},
					},
				},
			},
			tags: ["paywalls"],
		}),
		zValidator("param", getPaywallProductsParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");

			const paywallProducts = await getPaywallProducts({
				ctx: authenticatedContext,
				input: {
					paywallId,
				},
			});

			const response: z.infer<typeof paywallProductResponseSchema>[] =
				paywallProducts.map((pp) => ({
					paywallId: pp.paywallId,
					productId: pp.productId,
					productName: pp.product.name ?? null,
				}));

			return c.json(response);
		}
	)
	// Remove Product from Paywall
	.delete(
		"/:paywallId/products/:productId",
		describeRoute({
			description: "Remove a product from a paywall",
			responses: {
				200: {
					description: "Successful response",
				},
			},
			tags: ["paywalls"],
		}),
		zValidator("param", deletePaywallProductParamsSchema),
		async (c) => {
			const context = await createServerServiceContext(c);
			const authenticatedContext = await authenticateContext(context);
			const paywallId = c.req.param("paywallId");
			const productId = c.req.param("productId");

			await deletePaywallProduct({
				ctx: authenticatedContext,
				input: {
					paywallId,
					productId,
				},
			});

			return c.json({ message: "Product removed from paywall" });
		}
	);

export default app;
