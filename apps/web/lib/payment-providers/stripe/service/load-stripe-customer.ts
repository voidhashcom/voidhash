// import { App } from "@/lib/api/hono/app";
// import { ServiceContext } from "@/lib/service-function";
// import { getCustomerByExternalIdentifierQuery } from "@/lib/services/customers/raw-queries";
// import { Database } from "@voidhash/db";
// import { VoidhashError } from "@voidhash/lib/constants";
// import Stripe from "stripe";
// import { stripeProviderId } from "../stripe";

// type Props = {
// 	serviceContext: ServiceContext;
// 	projectId: string;
// 	stripe: Stripe;
// 	customerId: string;
// 	db: Database;
// };
// export async function loadStripeCustomer({
// 	serviceContext,
// 	projectId,
// 	stripe,
// 	customerId,
// }: Props) {
// 	// Find existing customer
// 	const existingCustomer = await getCustomerByExternalIdentifierQuery(
// 		serviceContext,
// 		projectId,
// 		stripeProviderId,
// 		customerId
// 	);

// 	// If customer exists, we don't need to fetch from Stripe
// 	if (existingCustomer) {
// 		return existingCustomer;
// 	}

// 	const customer = await stripe.customers.retrieve(customerId);
// 	if (!customer) {
// 		throw new VoidhashError({
// 			code: "NOT_FOUND",
// 			message: "Stripe customer not found",
// 		});
// 	}

// 	if (customer.deleted) {
// 		throw new VoidhashError({
// 			code: "NOT_FOUND",
// 			message: "Stripe customer is deleted",
// 		});
// 	}

// 	const voidhashCustomerId = customer.metadata.voidhash_customer_id;
// 	const appUserId = customer.metadata.app_user_id;

// 	return {
// 		voidhashCustomerId,
// 		appUserId,
// 	};
// }
