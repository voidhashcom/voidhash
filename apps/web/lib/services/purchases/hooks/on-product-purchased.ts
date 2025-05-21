import { generateId } from "@/lib/id/generate";
import { ServiceContext } from "@/lib/service-function";
import { purchases, customersUnlockedPerks, db } from "@voidhash/db";
import {
	fromUnknownThrow,
	PRODUCT_TYPES,
	VoidhashHTTPError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib";
import { getCustomerByIdQuery } from "../../customers/raw-queries";
import {
	getProductPerksByProductIdQuery,
	getProviderProductByIdQuery,
} from "../../products/raw-queries";
import { err, ok, Result } from "neverthrow";

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

type HandleProductPurchaseError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export async function handleProductPurchase(
	ctx: ServiceContext,
	event: PurchaseEvent
): Promise<Result<{ id: string }, HandleProductPurchaseError>> {
	// TODO: Support other product types
	if (event.type !== "subscription") {
		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Only subscription products are supported for now",
			originalError: new VoidhashHTTPError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Only subscription products are supported for now",
			}),
		});
	}

	const customer = await getCustomerByIdQuery(ctx, event.customerId);
	if (customer.isErr()) {
		return err(customer.error);
	}

	const providerProduct = await getProviderProductByIdQuery(
		ctx,
		event.providerProductId
	);

	if (providerProduct.isErr()) {
		return err(providerProduct.error);
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
	try {
		await (ctx.tx ?? ctx.db).insert(purchases).values(customerProduct);
	} catch (error) {
		return err(fromUnknownThrow(error));
	}

	// Add grants
	const hasAccessToPerks =
		event.status === "active" || event.status === "trialing";
	if (hasAccessToPerks) {
		const productPerks = await getProductPerksByProductIdQuery(
			ctx,
			providerProduct.value.productId
		);

		if (productPerks.isErr()) {
			return err(productPerks.error);
		}

		for (const productPerk of productPerks.value) {
			await db.insert(customersUnlockedPerks).values({
				id: generateId("customerUnlockedPerk"),
				customerId: event.customerId,
				perkId: productPerk.perkId,
				unlockedByCustomerProductId: customerProduct.id,
			});
		}
	}

	return ok({
		id: customerProduct.id,
	});
}
