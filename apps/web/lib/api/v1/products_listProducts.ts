import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { authenticateContext } from "@/lib/service-function";
import { productResponseSchema } from "./schema";
import { z } from "zod";
import { getProducts } from "@/lib/services/products/queries";
import { openApiErrorResponses } from "../errors/openapi_responses";
import { App } from "../hono/app";
import {
	toVoidhashHTTPError,
	VoidhashHTTPError,
} from "@voidhash/lib/constants";

const route = describeRoute({
	description: "List products",
	operationId: "listProducts",
	security: [
		{
			secretKey: [],
		},
	],
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
	tags: ["Products"],
});

export type Route = typeof route;

export const registerProductsListProducts = (app: App) =>
	app.get("/v1/products", route, async (c) => {
		const context = c.get("services");
		const authenticatedContext = await authenticateContext(context);
		if (authenticatedContext.isErr()) {
			throw toVoidhashHTTPError(authenticatedContext.error);
		}
		const projectId = authenticatedContext.value.session?.projects[0]?.id;

		if (!projectId) {
			throw new VoidhashHTTPError({
				code: "NOT_FOUND",
				message: "Project not found",
			});
		}

		const products = await getProducts({
			ctx: authenticatedContext.value,
			input: {
				projectId,
			},
		});

		if (products.isErr()) {
			throw toVoidhashHTTPError(products.error);
		}

		return c.json<z.infer<typeof productResponseSchema>[]>(
			products.value.map((product) => ({
				productId: product.id,
				name: product.name,
			}))
		);
	});

export type RouteResponse = z.infer<typeof productResponseSchema>[];
