import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { authenticateContext } from "@/lib/service-function";
import { productResponseSchema } from "./schema";
import { z } from "zod";
import { getProducts } from "@/lib/services/products/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";

const route = describeRoute({
	description: "List products",
	operationId: "listProducts",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: resolver(z.array(productResponseSchema)),
				},
			},
		},
		...openApiErrorResponses,
	},
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsListProducts = (app: App) =>
	app.get("/v1/products", route, async (c) => {
		const context = c.get("services");
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

		return c.json<z.infer<typeof productResponseSchema>[]>(
			products.map((product) => ({
				productId: product.id,
				name: product.name,
			}))
		);
	});

export type RouteResponse = z.infer<typeof productResponseSchema>[];
