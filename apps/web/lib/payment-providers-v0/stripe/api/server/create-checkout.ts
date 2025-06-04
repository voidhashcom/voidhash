// import { App } from "@/lib/api/hono/app";
// import { authenticateContext } from "@/lib/service-function";
// import { zValidator } from "@hono/zod-validator";
// import { createCheckoutBodySchema } from "./schema";
// import { getCustomerByAppUserIdQuery } from "@/lib/services/customers/raw-queries";
// import { VoidhashError } from "@voidhash/lib/constants";
// import { getProviderProductByPrimaryKeyQuery } from "@/lib/services/products/raw-queries";
// import { stripeProviderId } from "../../stripe";

// export const registerStripeCheckout = (app: App) => {
// 	app.post(
// 		"/payment-providers/stripe/checkout",
// 		zValidator("json", createCheckoutBodySchema),
// 		// Note: Hono needs the raw body for signature verification.
// 		async (c) => {
// 			const ctx = c.get("services");
// 			const authenticatedContext = await authenticateContext(ctx);

// 			const projectId = authenticatedContext.session?.projects[0]?.id;
// 			if (!projectId) {
// 				throw new VoidhashError({
// 					code: "NOT_FOUND",
// 					message: "Project not found",
// 				});
// 			}

// 			const { productId, appUserId } = c.req.valid("json");
// 			const customer = await getCustomerByAppUserIdQuery(
// 				authenticatedContext,
// 				appUserId
// 			);

// 			if (!customer) {
// 				throw new VoidhashError({
// 					code: "NOT_FOUND",
// 					message: "Customer not found",
// 				});
// 			}

// 			const stripeProduct = await getProviderProductByPrimaryKeyQuery(
// 				authenticatedContext,
// 				projectId,
// 				stripeProviderId,
// 				productId
// 			);

// 			if (!stripeProduct) {
// 				throw new VoidhashError({
// 					code: "BAD_REQUEST",
// 					message: "This product is not configured to be purchased via Stripe",
// 				});
// 			}

// 			const stripe = new Stripe(stripeProduct.providerSecret);

// 		}
// 	);
// };
