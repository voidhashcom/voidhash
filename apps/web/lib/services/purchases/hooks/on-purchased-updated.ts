import { generateId } from "@/lib/id/generate";
import { ServiceContext } from "@/lib/service-function";
import {
	purchases,
	customersUnlockedPerks,
	// No 'schema' import needed here
} from "@voidhash/db";
import {
	fromUnknownThrow,
	VoidhashError,
	VoidhashInternalServerError,
	VoidhashNotFoundError,
} from "@voidhash/lib";
import { and, eq } from "drizzle-orm";
import {
	getProductPerksByProductIdQuery,
	getProviderProductByIdQuery,
} from "../../products/raw-queries";
import { err, ok, Result, ResultAsync } from "neverthrow";

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

	const getPurchaseById = ResultAsync.fromThrowable(
		tx.query.purchases.findFirst,
		(e) => fromUnknownThrow(e)
	);
	const existingCustomerProduct = await getPurchaseById({
		where: eq(purchases.id, event.purchaseId),
	});
	if (existingCustomerProduct.isErr()) {
		return err(existingCustomerProduct.error);
	}

	if (!existingCustomerProduct.value) {
		return err({
			code: "NOT_FOUND",
			message: `Customer product with id ${event.purchaseId} not found.`,
			resource: "purchase",
			payload: {
				id: event.purchaseId,
			},
		});
	}

	// TODO: Add support other product types
	if (existingCustomerProduct.value.type !== "subscription") {
		return err({
			code: "INTERNAL_SERVER_ERROR",
			message: "Only subscription products updates are supported for now",
			originalError: new VoidhashError({
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
				originalError: new VoidhashError({
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
				const existingGrant = await tx.query.customersUnlockedPerks.findFirst({
					where: and(
						eq(
							customersUnlockedPerks.unlockedByCustomerProductId,
							existingCustomerProduct.value.id
						),
						eq(customersUnlockedPerks.perkId, productPerk.perkId)
					),
				});

				if (!existingGrant) {
					await tx.insert(customersUnlockedPerks).values({
						id: generateId("customerUnlockedPerk"),
						customerId: existingCustomerProduct.value.customerId,
						perkId: productPerk.perkId,
						unlockedByCustomerProductId: existingCustomerProduct.value.id,
					});
				}
			}
		}
		// Status changed FROM active
		else if (hadPreviousAccessToPerks && !hasNewAccessToPerks) {
			ctx.logger.info(
				`Revoking perks for customer product ${existingCustomerProduct.value.id} due to status change from active.`
			);
			// Remove perks granted specifically by this product instance
			await tx
				.delete(customersUnlockedPerks)
				.where(
					eq(
						customersUnlockedPerks.unlockedByCustomerProductId,
						existingCustomerProduct.value.id
					)
				);
		}
	}

	return ok(undefined);
}
