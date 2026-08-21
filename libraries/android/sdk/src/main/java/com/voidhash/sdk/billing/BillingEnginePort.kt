package com.voidhash.sdk.billing

import com.voidhash.core.billing.BillingAcknowledgeResult
import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingEngine
import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingPurchase

/**
 * The slice of [BillingEngine] the SDK depends on.
 *
 * Kept as an interface so the purchase orchestration can be exercised on the
 * JVM without Google Play Billing.
 */
interface BillingEnginePort {
    /** Connects to the store, registering [onPurchase] for out-of-band purchases. */
    suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)?): Boolean

    /** Tears the store connection down and fails anything still in flight. */
    suspend fun endConnection(): Boolean

    /** Queries store metadata for [skus] of [type]. */
    suspend fun getItemsByType(type: BillingProductType, skus: Array<String>): Array<BillingProductDetail>

    /** Launches the billing flow and suspends until the store reports its purchases. */
    suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase>

    /** Acknowledges a non-consumable purchase. */
    suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult

    /** Consumes a consumable purchase so it can be bought again. */
    suspend fun consumeProduct(token: String): BillingAcknowledgeResult

    /** Returns the purchases of [type] the signed-in store account still owns. */
    suspend fun getAvailableItemsByType(type: BillingProductType): Array<BillingPurchase>
}

/** [BillingEnginePort] backed by the shared [BillingEngine]. */
class DefaultBillingEnginePort(private val engine: BillingEngine) : BillingEnginePort {
    override suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)?): Boolean =
        engine.initConnection(onPurchase)

    override suspend fun endConnection(): Boolean = engine.endConnection()

    override suspend fun getItemsByType(
        type: BillingProductType,
        skus: Array<String>,
    ): Array<BillingProductDetail> = engine.getItemsByType(type, skus)

    override suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase> =
        engine.buyItemByType(params)

    override suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult =
        engine.acknowledgePurchase(token)

    override suspend fun consumeProduct(token: String): BillingAcknowledgeResult =
        engine.consumeProduct(token)

    override suspend fun getAvailableItemsByType(type: BillingProductType): Array<BillingPurchase> =
        engine.getAvailableItemsByType(type)
}
