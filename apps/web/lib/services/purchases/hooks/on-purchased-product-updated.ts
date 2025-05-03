import { generateId } from "@/lib/id/generate";
import { ServiceContext } from "@/lib/service-function";
import {
	purchases,
	customersUnlockedPerks,
	// No 'schema' import needed here
} from "@voidhash/db";
import { VoidhashError } from "@voidhash/lib";
import { and, eq } from "drizzle-orm";
import {
	getProductPerksByProductIdQuery,
	getProviderProductByIdQuery,
} from "../../products/raw-queries";

export type PurchasedProductUpdateEvent = {
	customerProductId: string; // ID of the record to update
	status: "active" | "trialing" | "canceled";
	canceledAt: Date | null;
	cancelAtPeriodEnd: boolean;
	expiresAt: Date | null;
};

export async function handlePurchasedProductUpdated(
	ctx: ServiceContext,
	event: PurchasedProductUpdateEvent
) {
	const tx = ctx.tx ?? ctx.db;

	const existingCustomerProduct = await tx.query.purchases.findFirst({
		where: eq(purchases.id, event.customerProductId),
	});

	console.log("existingCustomerProduct");
	console.log(existingCustomerProduct);
	if (!existingCustomerProduct) {
		throw new VoidhashError({
			code: "NOT_FOUND",
			message: `Customer product with id ${event.customerProductId} not found.`,
		});
	}

	// TODO: Add support other product types
	if (existingCustomerProduct.type !== "subscription") {
		throw new VoidhashError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Only subscription products updates are supported for now",
		});
	}

	const oldStatus = existingCustomerProduct.status;
	const newStatus = event.status;

	// 3. Update the customer product record
	await tx
		.update(purchases)
		.set({
			status: event.status,
			canceledAt: event.canceledAt,
			cancelAtPeriodEnd: event.cancelAtPeriodEnd,
			expiresAt: event.expiresAt,
			updatedAt: new Date(),
		})
		.where(eq(purchases.id, event.customerProductId));

	// 4. Handle perk updates based on status change
	if (oldStatus !== newStatus) {
		const providerProduct = await getProviderProductByIdQuery(
			ctx,
			existingCustomerProduct.providerProductId
		);
		if (!providerProduct) {
			throw new VoidhashError({
				code: "INTERNAL_SERVER_ERROR",
				message: `Provider product ${existingCustomerProduct.providerProductId} not found for customer product ${existingCustomerProduct.id}`,
			});
		}
		const productPerks = await getProductPerksByProductIdQuery(
			ctx,
			providerProduct.productId
		);

		const hasNewAccessToPerks =
			newStatus === "active" || newStatus === "trialing";
		const hadPreviousAccessToPerks =
			oldStatus === "active" || oldStatus === "trialing";

		// Status changed TO active (and wasn't active before)
		if (hasNewAccessToPerks && !hadPreviousAccessToPerks) {
			ctx.logger.info(
				`Granting perks for customer product ${existingCustomerProduct.id} due to status change to active.`
			);
			for (const productPerk of productPerks) {
				// Use findFirst to check if the specific grant already exists (idempotency)
				const existingGrant = await tx.query.customersUnlockedPerks.findFirst({
					where: and(
						eq(
							customersUnlockedPerks.unlockedByCustomerProductId,
							existingCustomerProduct.id
						),
						eq(customersUnlockedPerks.perkId, productPerk.perkId)
					),
				});

				if (!existingGrant) {
					await tx.insert(customersUnlockedPerks).values({
						id: generateId("customerUnlockedPerk"),
						customerId: existingCustomerProduct.customerId,
						perkId: productPerk.perkId,
						unlockedByCustomerProductId: existingCustomerProduct.id,
					});
				}
			}
		}
		// Status changed FROM active
		else if (hadPreviousAccessToPerks && !hasNewAccessToPerks) {
			ctx.logger.info(
				`Revoking perks for customer product ${existingCustomerProduct.id} due to status change from active.`
			);
			// Remove perks granted specifically by this product instance
			await tx
				.delete(customersUnlockedPerks)
				.where(
					eq(
						customersUnlockedPerks.unlockedByCustomerProductId,
						existingCustomerProduct.id
					)
				);
		}
	}
}
