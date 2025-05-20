import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { authenticateContext } from "@/lib/service-function";
import {
	createProductBodySchema,
	customerResponseSchema,
	productResponseSchema,
} from "./schema";
import { z } from "zod";
import { createProduct } from "@/lib/services/products/actions/create-product";
import { openApiErrorResponses } from "../../errors/openapi_responses";
import { App } from "../../hono/app";

const route = describeRoute({
	description: "Create a new product",
	operationId: "createProduct",
	responses: {
		200: {
			description: "Successful response",
			content: {
				// TODO: This response schema seems incorrect, should be productResponseSchema
				"application/json": { schema: resolver(customerResponseSchema) },
			},
		},
		...openApiErrorResponses,
	},
	tags: ["products"],
});

export type Route = typeof route;

export const registerProductsCreateProduct = (app: App) =>
	app.post(
		"/v1/products",
		route,
		zValidator("json", createProductBodySchema),
		async (c) => {
			const context = c.get("services");
			const authenticatedContext = await authenticateContext(context);
			const projectId = authenticatedContext.session?.projects[0]?.id;

			if (!projectId) {
				return c.json({ error: "Project not found" }, 404);
			}

			const createdProduct = await createProduct.invoke({
				ctx: authenticatedContext,
				input: {
					name: c.req.valid("json").name,
					projectId,
				},
			});

			return c.json<z.infer<typeof productResponseSchema>>({
				productId: createdProduct.id,
				name: createdProduct.name,
			});
		}
	);

export type RouteResponse = z.infer<typeof productResponseSchema>;
export type RouteRequest = z.infer<typeof createProductBodySchema>;
