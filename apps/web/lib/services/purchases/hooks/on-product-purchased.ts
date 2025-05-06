import { generateId } from "@/lib/id/generate";
import { ServiceContext } from "@/lib/service-function";
import { purchases, customersUnlockedPerks, db } from "@voidhash/db";
import { PRODUCT_TYPES, VoidhashError } from "@voidhash/lib";
import { getCustomerByIdQuery } from "../../customers/raw-queries";
import {
	getProductPerksByProductIdQuery,
	getProviderProductByIdQuery,
} from "../../products/raw-queries";

export type PurchaseEvent = {
	type: (typeof PRODUCT_TYPES)[number];
	providerKey: string;
	status: "active" | "trialing" | "canceled";
	customerId: string;
	providerProductId: string;
	purchasedAt: Date;
	startsAt: Date;
	cancelAtPeriodEnd: boolean;
	canceledAt: Date | null;
	environment: "production" | "sandbox";
	expiresAt: Date;
};

export async function handleProductPurchase(
	ctx: ServiceContext,
	event: PurchaseEvent
) {
	// TODO: Support other product types
	if (event.type !== "subscription") {
		throw new VoidhashError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Only subscription products are supported for now",
		});
	}

	const customer = await getCustomerByIdQuery(ctx, event.customerId);
	if (!customer) {
		throw new VoidhashError({
			code: "NOT_FOUND",
			message: "Customer not found",
		});
	}

	const providerProduct = await getProviderProductByIdQuery(
		ctx,
		event.providerProductId
	);
	console.log("event", event);
	console.log("providerProduct", providerProduct);
	if (!providerProduct) {
		throw new VoidhashError({
			code: "NOT_FOUND",
			message: "Provider product not found",
		});
	}

	const customerProduct = {
		id: generateId("customerProduct"),
		providerKey: event.providerKey,
		status: event.status,
		type: event.type,
		customerId: event.customerId,
		providerProductId: event.providerProductId,
		purchasedAt: event.purchasedAt,
		startsAt: event.startsAt,
		canceledAt: event.canceledAt,
		cancelAtPeriodEnd: event.cancelAtPeriodEnd,
		environment: event.environment,
		expiresAt: event.expiresAt,
	};
	await (ctx.tx ?? ctx.db).insert(purchases).values(customerProduct);

	// Add grants
	const hasAccessToPerks =
		event.status === "active" || event.status === "trialing";
	if (hasAccessToPerks) {
		const productPerks = await getProductPerksByProductIdQuery(
			ctx,
			providerProduct.productId
		);
		for (const productPerk of productPerks) {
			await db.insert(customersUnlockedPerks).values({
				id: generateId("customerUnlockedPerk"),
				customerId: event.customerId,
				perkId: productPerk.perkId,
				unlockedByCustomerProductId: customerProduct.id,
			});
		}
	}

	return customerProduct;
}
