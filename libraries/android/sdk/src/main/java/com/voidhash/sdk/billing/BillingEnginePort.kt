package com.voidhash.sdk.billing

import android.app.Activity
import com.android.billingclient.api.BillingClient
import com.voidhash.core.billing.BillingAcknowledgeResult
import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingEngine
import com.voidhash.core.billing.BillingEngineException
import com.voidhash.core.billing.BillingInAppMessageResult
import com.voidhash.core.billing.BillingProductQuery
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingPurchase
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.VoidhashPurchaseException
import kotlinx.coroutines.CancellationException
import java.util.Locale

/**
 * The slice of [BillingEngine] the SDK depends on.
 *
 * Kept as an interface so the purchase orchestration can be exercised on the
 * JVM without Google Play Billing.
 */
interface BillingEnginePort {
    /**
     * Connects to the store, registering [onPurchase] for out-of-band purchases. Returns `true`
     * once connected; a connection that cannot be opened throws [VoidhashException].
     */
    suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)?): Boolean

    /** Tears the store connection down and fails anything still in flight. */
    suspend fun endConnection(): Boolean

    /** Queries store metadata for [productIds] of [type], and which of them the store did not return. */
    suspend fun queryProducts(type: BillingProductType, productIds: List<String>): BillingProductQuery

    /** Launches the billing flow and suspends until the store reports its purchases. */
    suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase>

    /** Acknowledges a non-consumable purchase. */
    suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult

    /** Consumes a consumable purchase so it can be bought again. */
    suspend fun consumeProduct(token: String): BillingAcknowledgeResult

    /**
     * Returns the purchases of [type] the signed-in store account still owns. With
     * [includeSuspended], subscriptions the store suspended are listed too.
     */
    suspend fun getAvailableItemsByType(type: BillingProductType, includeSuspended: Boolean = false): Array<BillingPurchase>

    /**
     * Records [purchases] — purchases this SDK started, found among the ones the store lists — as
     * unfinished, like a buy with [BillingBuyItemParams.recordUnfinished] records what it bought:
     * the store then acknowledges them on the device before it would refund them. Never throws
     * for a record it could not keep. A store that keeps no such record does nothing.
     */
    suspend fun recordUnfinished(purchases: List<BillingPurchase>) {}

    /** Shows the store's transactional messages above [activity]. A store without any shows nothing. */
    suspend fun showInAppMessages(activity: Activity): BillingInAppMessageResult = BillingInAppMessageResult.NoActionNeeded

    /** The ISO 3166-1 alpha-2 country the store bills the user in; the device's region for a store without one. */
    suspend fun getBillingCountryCode(): String = Locale.getDefault().country

    /** Whether the store supports [feature], one of `BillingClient.FeatureType`. */
    suspend fun isFeatureSupported(feature: String): Boolean = false
}

/**
 * [BillingEnginePort] backed by the shared [BillingEngine].
 *
 * Every store failure leaves this port as a [VoidhashException], so a host that catches the
 * SDK's documented type (or any `Exception`) handles it. Connection, product and purchase-query
 * failures carry the operation's code (`BILLING_CONNECTION_FAILED`, `FAILED_TO_GET_PRODUCTS`,
 * `STORE_UNAVAILABLE`); purchase, acknowledge and consume failures keep the store's own code,
 * because the caller branches on it: `USER_CANCELLED`, `ITEM_ALREADY_OWNED` for a product the
 * user owns already, `STORE_UNAVAILABLE` for a purchase Google Play could not be reached for,
 * `BILLING_ERROR` for the rest; one Play gave a sub-response code for is a [VoidhashPurchaseException]
 * with it as its [VoidhashPurchaseException.reason]. The
 * [BillingEngineException] with Play's response code stays the cause. Cancellation passes through.
 */
class DefaultBillingEnginePort(private val engine: BillingEngine) : BillingEnginePort {
    override suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)?): Boolean =
        mapStoreFailures("BILLING_CONNECTION_FAILED", "Could not connect to Google Play Billing") {
            engine.initConnection(onPurchase)
        }

    override suspend fun endConnection(): Boolean =
        mapStoreFailures(null, "Could not end the Google Play Billing connection") { engine.endConnection() }

    override suspend fun queryProducts(type: BillingProductType, productIds: List<String>): BillingProductQuery =
        mapStoreFailures("FAILED_TO_GET_PRODUCTS", "Could not load products from Google Play") {
            engine.queryProducts(type, productIds)
        }

    override suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase> =
        mapStoreFailures(null, "The Google Play purchase failed") { engine.buyItemByType(params) }

    override suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult =
        mapStoreFailures(null, "Could not acknowledge the Google Play purchase") {
            engine.acknowledgePurchase(token)
        }

    override suspend fun consumeProduct(token: String): BillingAcknowledgeResult =
        mapStoreFailures(null, "Could not consume the Google Play purchase") { engine.consumeProduct(token) }

    override suspend fun getAvailableItemsByType(type: BillingProductType, includeSuspended: Boolean): Array<BillingPurchase> =
        mapStoreFailures("STORE_UNAVAILABLE", "Could not read purchases from Google Play") {
            engine.getAvailableItemsByType(type, includeSuspended)
        }

    override suspend fun recordUnfinished(purchases: List<BillingPurchase>) = engine.recordUnfinished(purchases)

    override suspend fun showInAppMessages(activity: Activity): BillingInAppMessageResult =
        mapStoreFailures(null, "Google Play could not show its messages") { engine.showInAppMessages(activity) }

    override suspend fun getBillingCountryCode(): String =
        mapStoreFailures("STORE_UNAVAILABLE", "Could not read the Google Play billing country") {
            engine.getBillingCountryCode()
        }

    override suspend fun isFeatureSupported(feature: String): Boolean =
        mapStoreFailures("STORE_UNAVAILABLE", "Could not ask Google Play which features it supports") {
            engine.isFeatureSupported(feature)
        }

    /**
     * Runs one store call so that nothing but a [VoidhashException] or a cancellation leaves it.
     *
     * With an operation [code] every failure is reported under it, the store's own code staying
     * in the message and the cause. Without one, a [BillingEngineException] keeps its code and
     * anything else becomes `BILLING_ERROR`.
     */
    private suspend inline fun <T> mapStoreFailures(
        code: String?,
        description: String,
        block: () -> T,
    ): T = try {
        block()
    } catch (error: CancellationException) {
        throw error
    } catch (error: VoidhashException) {
        throw error
    } catch (error: Throwable) {
        val detail = error.message ?: error.javaClass.simpleName
        throw when {
            code != null -> VoidhashException(code, "$description ($detail)", error)
            error is BillingEngineException -> purchaseFailureReasonOf(error.subResponseCode)
                ?.let { reason -> VoidhashPurchaseException(error.code, error.description, error, reason) }
                ?: VoidhashException(error.code, error.description, error)
            else -> VoidhashException("BILLING_ERROR", "$description ($detail)", error)
        }
    }
}

/** The reason Play's sub-response code [subResponseCode] gives a failed purchase. */
internal fun purchaseFailureReasonOf(subResponseCode: Int?): PurchaseFailureReason? = when (subResponseCode) {
    BillingClient.OnPurchasesUpdatedSubResponseCode.PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS -> PurchaseFailureReason.PAYMENT_DECLINED
    BillingClient.OnPurchasesUpdatedSubResponseCode.USER_INELIGIBLE -> PurchaseFailureReason.INELIGIBLE_FOR_OFFER
    else -> null
}
