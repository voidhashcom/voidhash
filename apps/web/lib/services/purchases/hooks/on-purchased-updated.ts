import { generateId } from "@/lib/id/generate";
import { ServiceContext } from "@/lib/service-function";
import {
	purchases,
	customersUnlockedPerks,
	// No 'schema' import needed here
} from "@voidhash/db";
import {
	fromUnknownThrow,
	VoidhashHTTPError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib";
import { and, eq } from "drizzle-orm";
import {
	getProductPerksByProductIdQuery,
	getProviderProductByIdQuery,
} from "../../products/raw-queries";
import { err, ok, Result } from "neverthrow";
import { getPurchaseByIdQuery } from "../raw-queries";

export type PurchaseUpdateEvent = {
	purchaseId: string; // ID of the record to update
	status: "active" | "trialing" | "canceled";
	canceledAt: Date | null;
	cancelAtPeriodEnd: boolean;
	expiresAt: Date | null;
};

type HandlePurchaseUpdatedError =
	| VoidhashInternalServerError
	| VoidhashNotFoundError;

export async function handlePurchaseUpdated(
	ctx: ServiceContext,
	event: PurchaseUpdateEvent
): Promise<Result<void, HandlePurchaseUpdatedError>> {
	const tx = ctx.tx ?? ctx.db;

	const existingCustomerProduct = await getPurchaseByIdQuery(
		ctx,
		event.purchaseId
	);
	if (existingCustomerProduct.isErr()) {
		return err(existingCustomerProduct.error);
	}

	// TODO: Add support other product types
	if (existingCustomerProduct.value.type !== "subscription") {
		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Only subscription products updates are supported for now",
			originalError: new VoidhashHTTPError({
				code: "INTERNAL_SERVER_ERROR",
				message: "Only subscription products updates are supported for now",
			}),
		});
	}

	const oldStatus = existingCustomerProduct.value.status;
	const newStatus = event.status;

	// 3. Update the customer product record
	try {
		await tx
			.update(purchases)
			.set({
				status: event.status,
				canceledAt: event.canceledAt,
				cancelAtPeriodEnd: event.cancelAtPeriodEnd,
				expiresAt: event.expiresAt,
				updatedAt: new Date(),
			})
			.where(eq(purchases.id, event.purchaseId));
	} catch (e) {
		return err(fromUnknownThrow(e));
	}

	// 4. Handle perk updates based on status change
	if (oldStatus !== newStatus) {
		const providerProduct = await getProviderProductByIdQuery(
			ctx,
			existingCustomerProduct.value.providerProductId
		);
		if (providerProduct.isErr()) {
			return err(providerProduct.error);
		}
		if (!providerProduct.value) {
			return err({
				code: "INTERNAL_SERVER_ERROR",
				message: `Provider product ${existingCustomerProduct.value.providerProductId} not found for customer product ${existingCustomerProduct.value.id}`,
				originalError: new VoidhashHTTPError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Provider product ${existingCustomerProduct.value.providerProductId} not found for customer product ${existingCustomerProduct.value.id}`,
				}),
			});
		}
		const productPerks = await getProductPerksByProductIdQuery(
			ctx,
			providerProduct.value.productId
		);
		if (productPerks.isErr()) {
			return err(productPerks.error);
		}

		const hasNewAccessToPerks =
			newStatus === "active" || newStatus === "trialing";
		const hadPreviousAccessToPerks =
			oldStatus === "active" || oldStatus === "trialing";

		// Status changed TO active (and wasn't active before)
		if (hasNewAccessToPerks && !hadPreviousAccessToPerks) {
			ctx.logger.info(
				`Granting perks for customer product ${existingCustomerProduct.value.id} due to status change to active.`
			);
			for (const productPerk of productPerks.value) {
				// Use findFirst to check if the specific grant already exists (idempotency)
				try {
					const existingGrant = await tx.query.customersUnlockedPerks.findFirst(
						{
							where: and(
								eq(
									customersUnlockedPerks.unlockedByCustomerProductId,
									existingCustomerProduct.value.id
								),
								eq(customersUnlockedPerks.perkId, productPerk.perkId)
							),
						}
					);

					if (!existingGrant) {
						await tx.insert(customersUnlockedPerks).values({
							id: generateId("customerUnlockedPerk"),
							customerId: existingCustomerProduct.value.customerId,
							perkId: productPerk.perkId,
							unlockedByCustomerProductId: existingCustomerProduct.value.id,
						});
					}
				} catch (e) {
					ctx.logger.error(
						`Error granting perk ${productPerk.perkId} to customer product ${existingCustomerProduct.value.id}: ${e}`
					);
					return err(fromUnknownThrow(e));
				}
			}
		}
		// Status changed FROM active
		else if (hadPreviousAccessToPerks && !hasNewAccessToPerks) {
			ctx.logger.info(
				`Revoking perks for customer product ${existingCustomerProduct.value.id} due to status change from active.`
			);
			// Remove perks granted specifically by this product instance
			try {
				await tx
					.delete(customersUnlockedPerks)
					.where(
						eq(
							customersUnlockedPerks.unlockedByCustomerProductId,
							existingCustomerProduct.value.id
						)
					);
			} catch (e) {
				ctx.logger.error(
					`Error revoking perks for customer product ${existingCustomerProduct.value.id}: ${e}`
				);
				return err(fromUnknownThrow(e));
			}
		}
	}

	return ok(undefined);
}
