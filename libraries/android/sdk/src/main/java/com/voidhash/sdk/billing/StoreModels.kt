package com.voidhash.sdk.billing

import com.voidhash.core.billing.BillingPurchase

/**
 * A store transaction as the purchase machinery tracks it: delivered to Voidhash, finished with the
 * store and remembered across restarts by [processingKey]. The app sees it as [VoidhashTransaction]
 * (see [toPublic]).
 *
 * @property transactionId the Play order id, or the purchase token when Play gave none.
 * @property productId the Play product id the purchase reports first.
 * @property productSlug the Studio product, when the purchase that made it knew it.
 * @property externallyManaged true when the host app keeps acknowledging and consuming it.
 */
internal data class StoreTransaction(
    val id: String,
    val transactionId: String,
    val productId: String,
    val purchaseDate: Double,
    val quantity: Int,
    val isAcknowledged: Boolean,
    val purchaseState: String,
    val purchaseToken: String?,
    val appAccountToken: String?,
    val receipt: String?,
    val isAutoRenewing: Boolean?,
    /** Which provider produced the transaction; `development` marks a simulated one. */
    val store: String = "google-play",
    val externallyManaged: Boolean = false,
    val productIds: List<String> = listOfNotNull(productId.takeIf { it.isNotEmpty() }),
    val orderId: String? = null,
    val obfuscatedProfileId: String? = null,
    val isSuspended: Boolean = false,
    val productSlug: String? = null,
) {
    /** Stable store identity, independent of optional purchase metadata. */
    val processingKey: String get() = if (isDevelopment) {
        "android:$transactionId:${purchaseDate.toLongIfWhole()}"
    } else {
        "android:${purchaseToken ?: transactionId}"
    }

    /** Cache key written by releases that included the order ID and purchase timestamp. */
    val legacyProcessingKey: String get() =
        "android:$transactionId:${purchaseDate.toLongIfWhole()}"

    /** True when the transaction came from the development (mock) store. */
    val isDevelopment: Boolean get() = store == "development"

    /** The transaction as the app sees it, with [offer] when the purchase that made it knows it. */
    fun toPublic(offer: VoidhashTransactionOffer? = null): VoidhashTransaction = VoidhashTransaction(
        id = if (isDevelopment) transactionId else purchaseToken ?: transactionId,
        originalId = null,
        productSlug = productSlug,
        storeProductId = productId,
        store = if (isDevelopment) VoidhashStore.DEVELOPMENT else VoidhashStore.GOOGLE_PLAY,
        purchasedAt = purchaseDate.toLong(),
        expiresAt = null,
        quantity = quantity,
        isRenewal = null,
        offer = offer,
        environment = if (isDevelopment) VoidhashEnvironment.DEVELOPMENT else VoidhashEnvironment.UNKNOWN,
        googlePlay = if (isDevelopment) {
            null
        } else {
            GooglePlayTransactionInfo(
                orderId = orderId,
                purchaseToken = purchaseToken ?: transactionId,
                productIds = productIds,
                purchaseState = when (purchaseState) {
                    "purchased" -> GooglePlayPurchaseState.PURCHASED
                    "pending" -> GooglePlayPurchaseState.PENDING
                    else -> GooglePlayPurchaseState.UNKNOWN
                },
                isAcknowledged = isAcknowledged,
                isAutoRenewing = isAutoRenewing,
                obfuscatedAccountId = appAccountToken,
                obfuscatedProfileId = obfuscatedProfileId,
                isSuspended = isSuspended,
            )
        },
    )
}

/** Builds the synthetic transaction the development (mock) store returns. */
internal fun mapDevelopmentPurchaseToTransaction(
    productId: String,
    devTransactionId: String,
    purchaseDate: Double,
    quantity: Int,
    productSlug: String? = null,
): StoreTransaction = StoreTransaction(
    id = devTransactionId,
    transactionId = devTransactionId,
    productId = productId,
    purchaseDate = purchaseDate,
    quantity = quantity,
    // Dev purchases have nothing to acknowledge — the backend records them directly.
    isAcknowledged = true,
    purchaseState = "purchased",
    purchaseToken = null,
    appAccountToken = null,
    receipt = null,
    isAutoRenewing = null,
    store = "development",
    productSlug = productSlug,
)

private fun Double.toLongIfWhole(): Any = if (this % 1.0 == 0.0) toLong() else this

/** Maps a Play Billing purchase onto the transaction the purchase machinery tracks. */
internal fun mapBillingPurchaseToTransaction(purchase: BillingPurchase): StoreTransaction =
    StoreTransaction(
        id = purchase.id,
        transactionId = purchase.orderId?.takeIf { it.isNotEmpty() } ?: purchase.purchaseToken,
        productId = purchase.id,
        purchaseDate = purchase.purchaseTime,
        quantity = purchase.quantity,
        isAcknowledged = purchase.isAcknowledged,
        purchaseState = when (purchase.purchaseState) {
            1.0 -> "purchased"
            2.0 -> "pending"
            else -> "unspecified"
        },
        purchaseToken = purchase.purchaseToken,
        appAccountToken = purchase.obfuscatedAccountId,
        receipt = purchase.originalJson,
        isAutoRenewing = purchase.isAutoRenewing,
        productIds = purchase.ids.toList(),
        orderId = purchase.orderId?.takeIf { it.isNotEmpty() },
        obfuscatedProfileId = purchase.obfuscatedProfileId,
        isSuspended = purchase.isSuspended,
    )
