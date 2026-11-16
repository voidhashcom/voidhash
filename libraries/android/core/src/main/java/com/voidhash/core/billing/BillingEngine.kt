package com.voidhash.core.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingFlowParams.ProductDetailsParams.SubscriptionProductReplacementParams
import com.android.billingclient.api.BillingFlowParams.SubscriptionUpdateParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.GetBillingConfigParams
import com.android.billingclient.api.InAppMessageParams
import com.android.billingclient.api.InAppMessageResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.launch
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * A Google Play Billing failure.
 *
 * The message is always `"CODE: description"`, the format every Voidhash SDK parses to branch
 * on [code], so callers that only see the message still get the code.
 *
 * @property code stable failure code, for example `USER_CANCELLED` or
 *   `GOOGLE_BILLING_NOT_INITIALIZED`.
 * @property description human-readable detail, without the code prefix.
 * @property responseCode the Play Billing response code behind the failure, when Play reported one.
 * @property subResponseCode Play's `BillingClient.OnPurchasesUpdatedSubResponseCode` for a failed
 *   purchase, when Play gave one: 1 payment declined for insufficient funds, 2 the user is not
 *   eligible for the offer.
 */
class BillingEngineException(
    val code: String,
    val description: String,
    val responseCode: Int? = null,
    cause: Throwable? = null,
    val subResponseCode: Int? = null,
) : RuntimeException("$code: $description", cause)

/**
 * Shared Google Play Billing engine used by every Voidhash Android SDK flavour.
 *
 * The hosting SDK supplies the Android context and the current activity through
 * providers, so the engine always resolves them lazily at call time instead of
 * relying on setters that may never fire.
 *
 * Every store failure is raised as a [BillingEngineException], never as a `java.lang.Error`.
 * A connection attempt is bounded by [SETUP_TIMEOUT_MS], and a query, an acknowledgement and a
 * consumption by [STORE_CALL_TIMEOUT_MS]. The billing flow is launched on the main thread, whatever
 * thread the buyer calls from; every other call is safe from any thread.
 *
 * The engine itself writes nothing to logcat.
 *
 * @param onWarning receives what the engine notices and works around or reports as a failure:
 *   anomalies, refused purchases and their response codes. Nothing is reported without it.
 * @param unfinishedPurchases where a buy with [BillingBuyItemParams.recordUnfinished], and
 *   [recordUnfinished] for a purchase found later, record purchases until they are acknowledged or
 *   consumed; `null` records nothing.
 * @param onUnfinishedPurchasesChanged called, off the main thread, after purchases were recorded,
 *   after a recorded purchase was acknowledged or consumed, and on every store connection; hosts
 *   call [PlayFinishJob.scheduleIfNeeded] from it.
 * @param storageDispatcher where the [unfinishedPurchases] file is read and written.
 */
class BillingEngine(
    private val contextProvider: () -> Context?,
    private val activityProvider: () -> Activity?,
    private val isPlayServicesAvailable: (Context) -> Boolean = { true },
    private val billingClientFactory: (Context, PurchasesUpdatedListener) -> BillingClient = { context, listener ->
        BillingClient
            .newBuilder(context)
            .setListener(listener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
    },
    private val onWarning: (String) -> Unit = {},
    private val unfinishedPurchases: UnfinishedPurchaseStore? = null,
    private val onUnfinishedPurchasesChanged: () -> Unit = {},
    private val storageDispatcher: CoroutineDispatcher = Dispatchers.IO,
) : PurchasesUpdatedListener {
    companion object {
        const val TAG = "VoidhashBillingEngine"

        /**
         * How long a connection attempt may wait for Play to report its setup. Play reports only
         * a disconnect when its service dies while binding, and nothing at all when the bind
         * never completes, so an unbounded wait would hold the connection lock forever.
         */
        internal const val SETUP_TIMEOUT_MS = 15_000L

        /**
         * How long a query, an acknowledgement or a consumption may wait for Play's answer. An
         * answer that never comes would otherwise hold whatever waits on the call for good.
         */
        internal const val STORE_CALL_TIMEOUT_MS = 30_000L

        private val sharedStorageScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        /**
         * The `SubscriptionProductReplacementParams.ReplacementMode` of [mode]. Billing 9 numbers
         * these differently from the deprecated `SubscriptionUpdateParams.ReplacementMode`
         * (`CHARGE_FULL_PRICE` and `DEFERRED` among them), so only these constants are used.
         */
        internal fun productReplacementMode(mode: BillingReplacementMode): Int = when (mode) {
            BillingReplacementMode.WITH_TIME_PRORATION -> SubscriptionProductReplacementParams.ReplacementMode.WITH_TIME_PRORATION
            BillingReplacementMode.CHARGE_PRORATED_PRICE -> SubscriptionProductReplacementParams.ReplacementMode.CHARGE_PRORATED_PRICE
            BillingReplacementMode.CHARGE_FULL_PRICE -> SubscriptionProductReplacementParams.ReplacementMode.CHARGE_FULL_PRICE
            BillingReplacementMode.WITHOUT_PRORATION -> SubscriptionProductReplacementParams.ReplacementMode.WITHOUT_PRORATION
            BillingReplacementMode.DEFERRED -> SubscriptionProductReplacementParams.ReplacementMode.DEFERRED
        }

        internal fun getBillingResponseCode(responseCode: Int): String {
            return when (responseCode) {
                BillingClient.BillingResponseCode.OK -> "OK"
                BillingClient.BillingResponseCode.USER_CANCELED -> "USER_CANCELED"
                BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> "SERVICE_UNAVAILABLE"
                BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> "BILLING_UNAVAILABLE"
                BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "ITEM_UNAVAILABLE"
                BillingClient.BillingResponseCode.DEVELOPER_ERROR -> "DEVELOPER_ERROR"
                BillingClient.BillingResponseCode.ERROR -> "ERROR"
                BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "ITEM_ALREADY_OWNED"
                BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> "ITEM_NOT_OWNED"
                BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> "SERVICE_DISCONNECTED"
                BillingClient.BillingResponseCode.NETWORK_ERROR -> "NETWORK_ERROR"
                else -> "UNKNOWN"
            }
        }

        internal fun getBillingResponseMessage(responseCode: Int): String {
            return when (responseCode) {
                BillingClient.BillingResponseCode.OK -> "Success"
                BillingClient.BillingResponseCode.USER_CANCELED -> "User canceled the purchase"
                BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> "Billing service is unavailable"
                BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> "Billing is unavailable"
                BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "Item is unavailable"
                BillingClient.BillingResponseCode.DEVELOPER_ERROR -> "Developer error"
                BillingClient.BillingResponseCode.ERROR -> "Billing error"
                BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "Item already owned"
                BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> "Item not owned"
                BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> "Billing service is disconnected"
                BillingClient.BillingResponseCode.NETWORK_ERROR -> "Network error"
                else -> "Unknown error"
            }
        }

        /**
         * The failure code of a purchase Play refused or ended with [responseCode].
         *
         * `ITEM_ALREADY_OWNED` means the user owns the product: restoring gets it, buying again
         * cannot. `STORE_UNAVAILABLE` covers the responses that say Play could not be reached or
         * cannot bill now (service disconnected or unavailable, billing unavailable, network
         * error): trying again later may work. After a lost connection, whether the sheet
         * completed a purchase is not known.
         * Everything else stays `BILLING_ERROR`; [BillingEngineException.responseCode] tells them
         * apart.
         */
        internal fun purchaseFailureCode(responseCode: Int): String = when (responseCode) {
            BillingClient.BillingResponseCode.USER_CANCELED -> "USER_CANCELLED"
            BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "SKU_NOT_FOUND"
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "ITEM_ALREADY_OWNED"
            BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
            BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE,
            BillingClient.BillingResponseCode.BILLING_UNAVAILABLE,
            BillingClient.BillingResponseCode.NETWORK_ERROR,
            -> "STORE_UNAVAILABLE"
            else -> "BILLING_ERROR"
        }
    }

    @Volatile
    private var billingClientCache: BillingClient? = null

    /**
     * Orders a setup that finishes against [endConnection]: counts the connections ended, so a
     * setup started before one never caches its client after it. Guarded by [connectionLock].
     */
    private var connectionsEnded = 0
    private val connectionLock = Any()

    /** Written by concurrent product queries and cleared by [endConnection]. */
    private val skus = ConcurrentHashMap<String, ProductDetails>()

    /** Read on Play's main-thread callback, written by whoever connects or ends the connection. */
    @Volatile
    private var onPurchaseCallback: ((BillingPurchase) -> Unit)? = null
    private val purchaseCoordinator = PurchaseOperationCoordinator<BillingPurchase>()
    private val connectionMutex = Mutex()

    /**
     * The products of the buy in flight that asked to record its purchases. Kept past a cancelled
     * caller until Play reports them, so a purchase whose caller went away while the sheet was open
     * is still recorded.
     */
    @Volatile
    private var recordingProductIds: Set<String>? = null

    /** The purchase the buy in flight replaces, which it did not make, though Play may report it with it. */
    @Volatile
    private var recordingExcludedToken: String? = null

    /** The duration of the prepaid plan the buy in flight buys, if it buys one; see [prepaidPlanDurationMs]. */
    @Volatile
    private var recordingPrepaidPlanMs: Long? = null

    /**
     * Runs the store work nobody waits for: the writes Play's main-thread callback hands off and the
     * scheduling on each connection. One process-wide scope for the default dispatcher, so an engine
     * made per background check leaves nothing behind once it is done.
     */
    private val storageScope =
        if (storageDispatcher === Dispatchers.IO) sharedStorageScope else CoroutineScope(SupervisorJob() + storageDispatcher)

    /** Connects to Google Play Billing and registers an observer for out-of-band purchases. */
    suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)? = null): Boolean {
        onPurchaseCallback = onPurchase
        ensureBillingClient()
        // A job lost to a force stop, or never persisted, is put back on every connection. Not
        // awaited: a connection is on the launch and purchase paths, and this reads a file and asks
        // the job scheduler.
        if (unfinishedPurchases != null) {
            storageScope.launch { withStorage("schedule the purchase check") { onUnfinishedPurchasesChanged() } }
        }
        return true
    }

    /**
     * Tears the billing connection down and fails any in-flight purchase. A call that was already
     * on its way to a connection ends the client it sets up instead of keeping it, and fails with
     * `CONNECTION_ENDED` (see [awaitBillingSetup]); this does not wait for it. A call made
     * afterwards connects again.
     */
    suspend fun endConnection(): Boolean {
        val connected = synchronized(connectionLock) {
            connectionsEnded += 1
            billingClientCache.also { billingClientCache = null }
        }
        connected?.endConnection()
        skus.clear()
        onPurchaseCallback = null
        purchaseCoordinator.fail(BillingEngineException("CONNECTION_ENDED", "Google Billing connection ended"))
        return true
    }

    /**
     * Queries store metadata for [productIds] of [type] and caches the product details purchases
     * are launched with. Products Play did not return are listed in [BillingProductQuery.unfetched];
     * an empty list queries nothing.
     */
    suspend fun queryProducts(type: BillingProductType, productIds: List<String>): BillingProductQuery {
        if (productIds.isEmpty()) return BillingProductQuery(emptyList(), emptyList())
        val billingClient = ensureBillingClient()

        val params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(
                productIds.distinct().map { productId ->
                    QueryProductDetailsParams.Product
                        .newBuilder()
                        .setProductId(productId)
                        .setProductType(convertProductType(type))
                        .build()
                },
            )
            .build()

        val result = queryProductDetails(billingClient, params)
        val products = result.productDetailsList.orEmpty().map { productDetails ->
            skus[productDetails.productId] = productDetails
            createProductDetail(productDetails, type)
        }
        val returned = products.mapTo(HashSet()) { it.id }
        val unfetched = result.unfetchedProductList.orEmpty()
            .map { BillingUnfetchedProduct(it.productId, it.statusCode) }
            .filter { it.productId !in returned }
        // Play lists what it did not return; an id it neither returned nor listed was not returned either.
        val unlisted = productIds.distinct()
            .filter { productId -> productId !in returned && unfetched.none { it.productId == productId } }
            .map { BillingUnfetchedProduct(it, statusCode = 0) }
        return BillingProductQuery(products, unfetched + unlisted)
    }

    /** Launches the billing flow and suspends until Google Play reports the matching purchases. */
    suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase> {
        val activity = activityProvider()
            ?: throw BillingEngineException("CURRENT_ACTIVITY_NULL", "Current activity returned null")

        val billingClient = ensureBillingClient()

        if (params.type == BillingProductType.SUBS && params.offerToken == null) {
            throw BillingEngineException(
                "OFFER_TOKEN_REQUIRED",
                "A Google Play subscription is bought with the offer token of a base plan or offer",
            )
        }
        val productDetails = skus[params.productId]
            ?: throw BillingEngineException(
                "SKU_NOT_FOUND",
                "The product was not found. Please fetch products first",
            )

        val productParams = BillingFlowParams.ProductDetailsParams
            .newBuilder()
            .setProductDetails(productDetails)
        // A one-time product's purchase option or offer is chosen by its token too (Billing 8).
        params.offerToken?.let { productParams.setOfferToken(it) }
        params.replacement?.let { replacement ->
            productParams.setSubscriptionProductReplacementParams(
                SubscriptionProductReplacementParams
                    .newBuilder()
                    .setOldProductId(replacement.oldProductId)
                    .setReplacementMode(productReplacementMode(replacement.mode))
                    .build(),
            )
        }

        val builder = BillingFlowParams
            .newBuilder()
            .setProductDetailsParamsList(listOf(productParams.build()))
            .setIsOfferPersonalized(params.isOfferPersonalized)

        // The purchase replaced is named here; how it is replaced, per product above.
        params.replacement?.let { replacement ->
            builder.setSubscriptionUpdateParams(
                SubscriptionUpdateParams.newBuilder().setOldPurchaseToken(replacement.oldPurchaseToken).build(),
            )
        }

        params.obfuscatedAccountId?.let { builder.setObfuscatedAccountId(it) }
        params.obfuscatedProfileId?.let { builder.setObfuscatedProfileId(it) }
        val reportedProductIds = params.reportedProductIds
        val recording = reportedProductIds.takeIf { params.recordUnfinished && unfinishedPurchases != null }
        // Play's window to acknowledge a prepaid plan shorter than a week is half its duration.
        val prepaidPlanMs = if (params.type == BillingProductType.SUBS) {
            prepaidPlanDurationMs(createProductDetail(productDetails, params.type).subscriptionOfferDetails, params.offerToken)
        } else {
            null
        }

        // Play requires its flow to be launched on the main thread; a flow buys from a worker.
        val purchases = withContext(Dispatchers.Main.immediate) { suspendCancellableCoroutine { continuation ->
            val handle = try {
                purchaseCoordinator.begin(
                    accepts = params::isAnsweredBy,
                    complete = { result ->
                        result.fold(
                            onSuccess = continuation::resume,
                            onFailure = continuation::resumeWithException,
                        )
                    },
                )
            } catch (error: IllegalStateException) {
                continuation.resumeWithException(
                    BillingEngineException(
                        "PURCHASE_IN_PROGRESS",
                        "Another Google Billing purchase is already active",
                        cause = error,
                    ),
                )
                return@suspendCancellableCoroutine
            }
            continuation.invokeOnCancellation {
                purchaseCoordinator.cancel(handle)
            }
            // Only once this buy owns the flow: a buy refused as PURCHASE_IN_PROGRESS must not
            // replace the products of the one whose sheet is open.
            recordingProductIds = recording
            recordingExcludedToken = params.replacement?.oldPurchaseToken
            recordingPrepaidPlanMs = prepaidPlanMs

            val billingResult = try {
                billingClient.launchBillingFlow(activity, builder.build())
            } catch (error: Throwable) {
                recordingProductIds = null
                purchaseCoordinator.fail(
                    BillingEngineException("BILLING_ERROR", "Google Billing operation failed - ${error.message}", cause = error),
                )
                return@suspendCancellableCoroutine
            }
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                recordingProductIds = null
                purchaseCoordinator.fail(
                    BillingEngineException(
                        purchaseFailureCode(billingResult.responseCode),
                        "Google Billing operation failed - ${describe(billingResult)}",
                        billingResult.responseCode,
                        subResponseCode = subResponseCodeOf(billingResult),
                    ),
                )
            }
        } }
        if (params.recordUnfinished) {
            rememberUnfinished(
                purchases.filter { it.purchaseToken != params.replacement?.oldPurchaseToken }.toTypedArray(),
                reportedProductIds,
                prepaidPlanMs,
            )
        }
        return purchases
    }

    /**
     * Records the purchases of [productIds] among [purchases] as unfinished before the caller sees
     * them, so a process that dies right after the sheet closes still leaves the background check
     * something to finish. Play's update may carry other purchases too, which this buy did not
     * make. A purchase still awaiting payment is recorded too; the check acknowledges it only once
     * it is paid. [prepaidPlanMs] is the duration of the prepaid plan the buy bought, if any.
     */
    private suspend fun rememberUnfinished(purchases: Array<BillingPurchase>, productIds: Set<String>, prepaidPlanMs: Long?) {
        val store = unfinishedPurchases ?: return
        val now = System.currentTimeMillis()
        val records = purchases
            .filter { purchase -> purchase.ids.any { it in productIds } }
            .mapNotNull { unfinishedPurchaseOf(it, now, prepaidPlanMs) }
        if (records.isEmpty()) return
        withStorage("record an unfinished purchase") {
            if (store.record(records)) onUnfinishedPurchasesChanged()
        }
    }

    /**
     * Records [purchases] as unfinished: purchases the caller started and will finish, which it
     * found among the ones Play lists instead of getting them from its buy — the process died, or
     * the caller went away, with the sheet open, so Play's update reached nobody.
     *
     * A paid one counts as paid since Play's purchase time, the earliest its payment can have been
     * made, so the time the caller was away is not added to its deadline — but no earlier than
     * leaves it [firstRecordGraceMs] from now: for a payment that stayed pending, Play's purchase
     * time is days before the payment, and a deadline already past would have the next check
     * acknowledge the purchase before the backend had its chance. One recorded already keeps its
     * record, which only learns that it was paid (see [UnfinishedPurchase.paidNow]).
     * Acknowledged purchases are skipped. Never throws for a record it could not keep.
     *
     * Play's list does not say which base plan a subscription is on, so one whose product has a
     * prepaid plan shorter than a week, as this engine last queried it, is given the deadline of
     * its shortest (see [shortestPrepaidPlanDurationMs]).
     */
    suspend fun recordUnfinished(purchases: List<BillingPurchase>) {
        val store = unfinishedPurchases ?: return
        val now = System.currentTimeMillis()
        val records = purchases.mapNotNull { purchase ->
            // A one-time product has no base plans, and so no prepaid one.
            val prepaidPlanMs = skus[purchase.id]
                ?.let { shortestPrepaidPlanDurationMs(createProductDetail(it, BillingProductType.SUBS).subscriptionOfferDetails) }
            val record = unfinishedPurchaseOf(purchase, now, prepaidPlanMs) ?: return@mapNotNull null
            if (record.paidAt == null) {
                record
            } else {
                val earliestPaidAt = now - (localFinishAfterMs(prepaidPlanMs) - firstRecordGraceMs(prepaidPlanMs))
                record.copy(paidAt = minOf(now, purchase.purchaseTime.toLong()).coerceAtLeast(earliestPaidAt))
            }
        }
        if (records.isEmpty()) return
        val paid = records.filter { it.paidAt != null }.map { it.purchaseToken }
        withStorage("record an unfinished purchase") {
            // A record waiting for its payment learns of it first, with its own clocks.
            store.update(paidNow = paid, now = now)
            if (store.record(records)) onUnfinishedPurchasesChanged()
        }
    }

    /**
     * Records, from Play's update and off its main thread, what the buy in flight bought — also for
     * a caller that went away while the sheet was open — and notes the payment of every recorded
     * purchase the update reports paid while the app runs.
     */
    private fun rememberFromUpdate(purchases: Array<BillingPurchase>) {
        val store = unfinishedPurchases ?: return
        val productIds = recordingProductIds
        val excludedToken = recordingExcludedToken
        val prepaidPlanMs = recordingPrepaidPlanMs
        val bought = if (productIds == null) {
            emptyList()
        } else {
            purchases.filter { purchase -> purchase.purchaseToken != excludedToken && purchase.ids.any { it in productIds } }
        }
        if (bought.isNotEmpty()) recordingProductIds = null
        val now = System.currentTimeMillis()
        val records = bought.mapNotNull { unfinishedPurchaseOf(it, now, prepaidPlanMs) }
        // Its deadline counts from the earliest the payment can have been made, which a late update
        // must not push past Play's window (see [UnfinishedPurchase.paidNow]).
        val paid = purchases.filter { ownedPurchaseOf(it).isPurchased }.map { it.purchaseToken }
        if (records.isEmpty() && paid.isEmpty()) return
        storageScope.launch {
            withStorage("record an unfinished purchase") {
                val recorded = store.record(records)
                store.update(paidNow = paid, now = now)
                if (recorded) onUnfinishedPurchasesChanged()
            }
        }
    }

    /**
     * Forgets the unfinished records of [tokens] once Play has them acknowledged or consumed,
     * telling the host, which cancels the check once nothing is left for it.
     */
    private suspend fun forgetUnfinished(tokens: Collection<String>) {
        val store = unfinishedPurchases ?: return
        if (tokens.isEmpty()) return
        withStorage("clear an unfinished purchase") {
            if (store.remove(tokens)) onUnfinishedPurchasesChanged()
        }
    }

    /**
     * Runs [block] on the IO dispatcher, uncancelled, reporting a failure instead of throwing it:
     * the record is a safety net, and failing to keep it must never fail the purchase itself.
     */
    private suspend fun withStorage(operation: String, block: () -> Unit) {
        try {
            withContext(NonCancellable + storageDispatcher) { block() }
        } catch (error: Exception) {
            onWarning("Could not $operation: ${error.message}")
        }
    }

    /** Acknowledges a non-consumable purchase. */
    suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult {
        val billingClient = ensureBillingClient()

        val acknowledgePurchaseParams = AcknowledgePurchaseParams
            .newBuilder()
            .setPurchaseToken(token)
            .build()

        val result = acknowledgePurchaseAsync(billingClient, acknowledgePurchaseParams)
        if (result.responseCode == BillingClient.BillingResponseCode.OK) forgetUnfinished(listOf(token))

        return BillingAcknowledgeResult(
            responseCode = result.responseCode.toDouble(),
            debugMessage = result.debugMessage,
            code = getBillingResponseCode(result.responseCode),
            message = getBillingResponseMessage(result.responseCode),
        )
    }

    /** Consumes a consumable purchase so it can be bought again. */
    suspend fun consumeProduct(token: String): BillingAcknowledgeResult {
        val billingClient = ensureBillingClient()
        val consumeParams = ConsumeParams
            .newBuilder()
            .setPurchaseToken(token)
            .build()

        val result = consumeProductAsync(billingClient, consumeParams)
        // Play no longer owning it means it was consumed already: there is nothing left to finish.
        if (result.responseCode == BillingClient.BillingResponseCode.OK ||
            result.responseCode == BillingClient.BillingResponseCode.ITEM_NOT_OWNED
        ) {
            forgetUnfinished(listOf(token))
        }

        return BillingAcknowledgeResult(
            responseCode = result.responseCode.toDouble(),
            debugMessage = result.debugMessage,
            code = getBillingResponseCode(result.responseCode),
            message = getBillingResponseMessage(result.responseCode),
        )
    }

    /**
     * Returns the purchases currently owned by the signed-in Play account. With
     * [includeSuspended], subscriptions Play suspended (paused, or on hold after a declined renewal)
     * are listed too, with [BillingPurchase.isSuspended] set; they grant no access.
     */
    suspend fun getAvailableItemsByType(type: BillingProductType, includeSuspended: Boolean = false): Array<BillingPurchase> {
        val billingClient = ensureBillingClient()

        val params = QueryPurchasesParams
            .newBuilder()
            .setProductType(convertProductType(type))
            .apply { if (includeSuspended && type == BillingProductType.SUBS) includeSuspendedSubscriptions(true) }
            .build()

        val purchases = queryPurchases(billingClient, params).map { purchase ->
            createPurchase(
                purchase,
                isAutoRenewing = if (type == BillingProductType.SUBS) purchase.isAutoRenewing else null,
            )
        }.toTypedArray()
        // Whoever acknowledged them — a backend, another integration, an acknowledgement that
        // reported a failure — they no longer need the background check.
        forgetUnfinished(purchases.filter { it.isAcknowledged }.map { it.purchaseToken })
        return purchases
    }

    /**
     * Shows the Play messages of the transactional category above [activity], such as a prompt to fix
     * a declined subscription payment, and waits until the user is done with them.
     */
    suspend fun showInAppMessages(activity: Activity): BillingInAppMessageResult {
        val billingClient = ensureBillingClient()
        val params = InAppMessageParams.newBuilder()
            .addInAppMessageCategoryToShow(InAppMessageParams.InAppMessageCategoryId.TRANSACTIONAL)
            .build()
        // Play shows its messages from the main thread, and answers there.
        return withContext(Dispatchers.Main.immediate) {
            suspendCancellableCoroutine { continuation ->
                val launched = try {
                    billingClient.showInAppMessages(activity, params) { result ->
                        if (!continuation.isActive) return@showInAppMessages
                        continuation.resume(
                            if (result.responseCode == InAppMessageResult.InAppMessageResponseCode.SUBSCRIPTION_STATUS_UPDATED) {
                                BillingInAppMessageResult.SubscriptionStatusUpdated(result.purchaseToken.orEmpty())
                            } else {
                                BillingInAppMessageResult.NoActionNeeded
                            },
                        )
                    }
                } catch (error: Throwable) {
                    continuation.resumeWithException(
                        BillingEngineException("BILLING_ERROR", "Google Play could not show its messages - ${error.message}", cause = error),
                    )
                    return@suspendCancellableCoroutine
                }
                if (launched.responseCode != BillingClient.BillingResponseCode.OK && continuation.isActive) {
                    continuation.resumeWithException(
                        BillingEngineException(
                            purchaseFailureCode(launched.responseCode),
                            "Google Play could not show its messages - ${describe(launched)}",
                            launched.responseCode,
                        ),
                    )
                }
            }
        }
    }

    /** The ISO 3166-1 alpha-2 country of the user's Play account, from Play's billing configuration. */
    suspend fun getBillingCountryCode(): String {
        val billingClient = ensureBillingClient()
        return awaitPlay("billing configuration query") {
            suspendCancellableCoroutine { continuation ->
                billingClient.getBillingConfigAsync(GetBillingConfigParams.newBuilder().build()) { billingResult, config ->
                    if (!continuation.acceptsCallback("billing configuration query", billingResult.responseCode)) {
                        return@getBillingConfigAsync
                    }
                    val countryCode = config?.countryCode
                    if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || countryCode.isNullOrEmpty()) {
                        continuation.resumeWithException(
                            BillingEngineException(
                                purchaseFailureCode(billingResult.responseCode),
                                "Google Play billing configuration query failed - ${describe(billingResult)}",
                                billingResult.responseCode,
                            ),
                        )
                        return@getBillingConfigAsync
                    }
                    continuation.resume(countryCode)
                }
            }
        }
    }

    /**
     * Whether the Play Store on this device supports [feature], one of `BillingClient.FeatureType`.
     * `false` also when Play cannot be reached.
     */
    suspend fun isFeatureSupported(feature: String): Boolean {
        val billingClient = ensureBillingClient()
        return billingClient.isFeatureSupported(feature).responseCode == BillingClient.BillingResponseCode.OK
    }

    override fun onPurchasesUpdated(
        billingResult: BillingResult,
        purchases: List<Purchase>?,
    ) {
        val responseCode = billingResult.responseCode
        if (responseCode != BillingClient.BillingResponseCode.OK) {
            // A sheet the user closed is not worth a warning.
            if (responseCode != BillingClient.BillingResponseCode.USER_CANCELED) {
                onWarning("Google Billing purchase failed with response code $responseCode: ${describe(billingResult)}")
            }
            recordingProductIds = null
            purchaseCoordinator.fail(
                BillingEngineException(
                    purchaseFailureCode(responseCode),
                    describe(billingResult),
                    responseCode,
                    subResponseCode = subResponseCodeOf(billingResult),
                ),
            )
            return
        }

        val billingPurchases = purchases.orEmpty().map { purchase ->
            val billingPurchase = createPurchase(purchase, isAutoRenewing = purchase.isAutoRenewing)
            try {
                onPurchaseCallback?.invoke(billingPurchase)
            } catch (error: Throwable) {
                onWarning("The purchase observer failed: $error")
            }
            billingPurchase
        }.toTypedArray()
        rememberFromUpdate(billingPurchases)

        if (billingPurchases.isEmpty()) {
            purchaseCoordinator.fail(
                BillingEngineException("PURCHASE_EMPTY", "Google Billing returned no purchases"),
            )
        } else {
            purchaseCoordinator.succeed(billingPurchases)
        }
    }

    /** Play's sub-response code of a failed purchase, `null` when it gave none. */
    private fun subResponseCodeOf(billingResult: BillingResult): Int? =
        billingResult.onPurchasesUpdatedSubResponseCode
            .takeIf { it != BillingClient.OnPurchasesUpdatedSubResponseCode.NO_APPLICABLE_SUB_RESPONSE_CODE }

    /** Play's debug message, or what the response code means when Play sent none, as it often does. */
    private fun describe(billingResult: BillingResult): String =
        billingResult.debugMessage.ifBlank { getBillingResponseMessage(billingResult.responseCode) }

    private fun convertProductType(type: BillingProductType): String {
        return when (type) {
            BillingProductType.INAPP -> BillingClient.ProductType.INAPP
            BillingProductType.SUBS -> BillingClient.ProductType.SUBS
        }
    }

    private fun createPurchase(purchase: Purchase, isAutoRenewing: Boolean?): BillingPurchase {
        val productId = purchase.products.firstOrNull()
        if (productId == null) {
            onWarning("Google Billing purchase ${purchase.orderId} carries no product id")
        }

        return BillingPurchase(
            id = productId ?: "",
            ids = purchase.products.toTypedArray(),
            orderId = purchase.orderId,
            purchaseTime = purchase.purchaseTime.toDouble(),
            originalJson = purchase.originalJson,
            purchaseToken = purchase.purchaseToken,
            signature = purchase.signature,
            isAutoRenewing = isAutoRenewing,
            isAcknowledged = purchase.isAcknowledged,
            purchaseState = purchase.purchaseState.toDouble(),
            packageName = purchase.packageName,
            developerPayload = purchase.developerPayload,
            obfuscatedAccountId = purchase.accountIdentifiers?.obfuscatedAccountId,
            obfuscatedProfileId = purchase.accountIdentifiers?.obfuscatedProfileId,
            quantity = purchase.quantity.coerceAtLeast(1),
            isSuspended = purchase.isSuspended,
        )
    }

    private fun createProductDetail(productDetails: ProductDetails, type: BillingProductType): BillingProductDetail =
        BillingProductDetail(
            id = productDetails.productId,
            type = type,
            title = productDetails.title,
            name = productDetails.name,
            description = productDetails.description,
            subscriptionOfferDetails = productDetails.subscriptionOfferDetails.orEmpty().map { offer ->
                BillingSubscriptionOfferDetails(
                    basePlanId = offer.basePlanId,
                    offerId = offer.offerId,
                    offerToken = offer.offerToken,
                    offerTags = offer.offerTags.orEmpty(),
                    pricingPhases = offer.pricingPhases.pricingPhaseList.orEmpty().map { phase ->
                        BillingPricingPhase(
                            formattedPrice = phase.formattedPrice,
                            priceAmountMicros = phase.priceAmountMicros,
                            priceCurrencyCode = phase.priceCurrencyCode,
                            billingPeriod = phase.billingPeriod,
                            billingCycleCount = phase.billingCycleCount,
                            recurrenceMode = phase.recurrenceMode,
                        )
                    },
                    installmentPlan = offer.installmentPlanDetails?.let {
                        BillingInstallmentPlan(
                            commitmentPaymentsCount = it.installmentPlanCommitmentPaymentsCount,
                            subsequentCommitmentPaymentsCount = it.subsequentInstallmentPlanCommitmentPaymentsCount,
                        )
                    },
                )
            },
            // Billing 8 lists every purchase option and offer; the single one is Play's default.
            oneTimePurchaseOfferDetails = (
                productDetails.oneTimePurchaseOfferDetailsList ?: listOfNotNull(productDetails.oneTimePurchaseOfferDetails)
                ).map { offer ->
                BillingOneTimePurchaseOfferDetails(
                    purchaseOptionId = offer.purchaseOptionId,
                    offerId = offer.offerId,
                    offerToken = offer.offerToken.orEmpty(),
                    offerTags = offer.offerTags.orEmpty(),
                    formattedPrice = offer.formattedPrice,
                    priceAmountMicros = offer.priceAmountMicros,
                    priceCurrencyCode = offer.priceCurrencyCode,
                    fullPriceMicros = offer.fullPriceMicros,
                    discountPercentage = offer.discountDisplayInfo?.percentageDiscount,
                    limitedQuantity = offer.limitedQuantityInfo?.let {
                        BillingOneTimePurchaseOfferDetails.LimitedQuantity(it.maximumQuantity, it.remainingQuantity)
                    },
                    validTimeWindow = offer.validTimeWindow?.let {
                        BillingOneTimePurchaseOfferDetails.ValidTimeWindow(it.startTimeMillis, it.endTimeMillis)
                    },
                    preorder = offer.preorderDetails?.let {
                        BillingOneTimePurchaseOfferDetails.Preorder(it.preorderReleaseTimeMillis, it.preorderPresaleEndTimeMillis)
                    },
                    rental = offer.rentalDetails?.let {
                        BillingOneTimePurchaseOfferDetails.Rental(it.rentalPeriod, it.rentalExpirationPeriod)
                    },
                )
            },
            productDetails = productDetails,
        )

    /**
     * Returns a connected client, reusing the cached one when it is still ready.
     * Serialized so concurrent callers share a single connection attempt instead
     * of racing two `startConnection` calls onto two clients.
     */
    private suspend fun ensureBillingClient(): BillingClient {
        // Read as the call begins, before it waits for the lock, a context or the Play services
        // check: a connection ended at any point after this ends the setup's client too.
        val connectionsEndedBefore = synchronized(connectionLock) { connectionsEnded }
        return connectionMutex.withLock { connectedClient(connectionsEndedBefore) }
    }

    private suspend fun connectedClient(connectionsEndedBefore: Int): BillingClient {
        billingClientCache?.let { cached ->
            if (cached.isReady) return cached
            // A client that lost its connection still holds its service binding and purchase
            // receiver; left alone it would deliver purchases alongside its replacement.
            runCatching { cached.endConnection() }
            synchronized(connectionLock) { if (billingClientCache === cached) billingClientCache = null }
        }
        return initBillingClient(connectionsEndedBefore)
    }

    private suspend fun initBillingClient(connectionsEndedBefore: Int): BillingClient {
        val ctx = contextProvider()
            ?: throw BillingEngineException("GOOGLE_BILLING_NOT_INITIALIZED", "Google Billing connection not initialized")

        if (!isPlayServicesAvailable(ctx)) {
            onWarning("Google Play Services are not available on this device")
            throw BillingEngineException("GOOGLE_BILLING_NOT_INITIALIZED", "Google Billing connection not initialized")
        }

        val billingClient = billingClientFactory(ctx, this)

        return try {
            withTimeout(SETUP_TIMEOUT_MS) {
                awaitBillingSetup(billingClient, connectionsEndedBefore)
            }
        } catch (error: TimeoutCancellationException) {
            // The abandoned client was ended when the wait was cancelled. Callers see a store
            // failure, never a cancellation they did not ask for.
            throw BillingEngineException(
                "GOOGLE_BILLING_NOT_INITIALIZED",
                "Google Billing setup did not finish within $SETUP_TIMEOUT_MS ms",
                cause = error,
            )
        }
    }

    /**
     * Connects [billingClient] and caches it once Play reports it set up, unless [endConnection]
     * ran since [connectionsEndedBefore] was read: the engine was ended while this setup was under
     * way, so the client is ended too rather than left bound with nobody to end it.
     */
    private suspend fun awaitBillingSetup(billingClient: BillingClient, connectionsEndedBefore: Int): BillingClient =
        suspendCancellableCoroutine { continuation ->
            continuation.invokeOnCancellation {
                runCatching { billingClient.endConnection() }
            }

            billingClient.startConnection(
                object : BillingClientStateListener {
                    override fun onBillingSetupFinished(billingResult: BillingResult) {
                        // Play Billing may report setup more than once for a single
                        // `startConnection` (reconnects), and resuming twice throws.
                        if (!continuation.isActive) {
                            return
                        }
                        if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                            // A failed setup keeps its service binding until the client is ended.
                            runCatching { billingClient.endConnection() }
                            continuation.resumeWithException(
                                BillingEngineException(
                                    "GOOGLE_BILLING_NOT_INITIALIZED",
                                    "Google Billing connection initialization failed",
                                    billingResult.responseCode,
                                ),
                            )
                            return
                        }
                        // Only a connected client is worth reusing: caching earlier
                        // would hand a dead client to the next caller.
                        val kept = synchronized(connectionLock) {
                            (connectionsEnded == connectionsEndedBefore).also { if (it) billingClientCache = billingClient }
                        }
                        if (!kept) {
                            runCatching { billingClient.endConnection() }
                            continuation.resumeWithException(
                                BillingEngineException("CONNECTION_ENDED", "Google Billing connection ended"),
                            )
                            return
                        }
                        continuation.resume(billingClient)
                    }

                    override fun onBillingServiceDisconnected() {
                        // Google Play never delivers `onPurchasesUpdated` after a
                        // disconnect, so a pending buy would hang forever. Whether its sheet
                        // completed a purchase is not known.
                        purchaseCoordinator.fail(
                            BillingEngineException(
                                purchaseFailureCode(BillingClient.BillingResponseCode.SERVICE_DISCONNECTED),
                                "Google Billing service disconnected",
                                BillingClient.BillingResponseCode.SERVICE_DISCONNECTED,
                            ),
                        )
                        // A service that dies while binding reports only this disconnect, never
                        // a setup result, so a setup still waiting has failed.
                        if (continuation.isActive) {
                            runCatching { billingClient.endConnection() }
                            continuation.resumeWithException(
                                BillingEngineException(
                                    "GOOGLE_BILLING_NOT_INITIALIZED",
                                    "Google Billing service disconnected during setup",
                                ),
                            )
                        }
                    }
                },
            )
        }

    /**
     * Whether a Play listener may still resume [this] continuation.
     *
     * Play is known to invoke a listener twice, for example a timeout result followed by the
     * real one. A second resume throws on Play's main-thread callback and takes the host process
     * down, so the first answer wins and later ones are reported and ignored.
     */
    private fun CancellableContinuation<*>.acceptsCallback(operation: String, responseCode: Int): Boolean {
        if (isActive) return true
        if (!isCancelled) onWarning("Ignoring a repeated $operation callback: $responseCode")
        return false
    }

    /**
     * Waits for Play's answer to [operation] at most [STORE_CALL_TIMEOUT_MS]. A caller sees a
     * store failure then, never a cancellation it did not ask for; an answer that still comes is
     * ignored (see [acceptsCallback]).
     */
    private suspend fun <T : Any> awaitPlay(operation: String, call: suspend () -> T): T =
        withTimeoutOrNull(STORE_CALL_TIMEOUT_MS) { call() } ?: throw BillingEngineException(
            "BILLING_ERROR",
            "Google Billing did not answer the $operation within $STORE_CALL_TIMEOUT_MS ms",
        )

    private suspend fun queryProductDetails(
        billingClient: BillingClient,
        params: QueryProductDetailsParams,
    ): QueryProductDetailsResult = awaitPlay("product query") {
        suspendCancellableCoroutine { continuation ->
            billingClient.queryProductDetailsAsync(params) { billingResult: BillingResult, productDetailsResult: QueryProductDetailsResult ->
                if (!continuation.acceptsCallback("product query", billingResult.responseCode)) {
                    return@queryProductDetailsAsync
                }
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    continuation.resumeWithException(
                        BillingEngineException(
                            "BILLING_ERROR",
                            "Google Billing product query failed",
                            billingResult.responseCode,
                        ),
                    )
                    return@queryProductDetailsAsync
                }
                continuation.resume(productDetailsResult)
            }
        }
    }

    private suspend fun queryPurchases(
        billingClient: BillingClient,
        params: QueryPurchasesParams,
    ): List<Purchase> = awaitPlay("purchases query") {
        suspendCancellableCoroutine { continuation ->
            billingClient.queryPurchasesAsync(params) { billingResult: BillingResult, purchases: List<Purchase>? ->
                if (!continuation.acceptsCallback("purchases query", billingResult.responseCode)) {
                    return@queryPurchasesAsync
                }
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    continuation.resumeWithException(
                        BillingEngineException(
                            "BILLING_ERROR",
                            "Google Billing purchases query failed",
                            billingResult.responseCode,
                        ),
                    )
                    return@queryPurchasesAsync
                }
                continuation.resume(purchases ?: emptyList())
            }
        }
    }

    private suspend fun acknowledgePurchaseAsync(
        billingClient: BillingClient,
        params: AcknowledgePurchaseParams,
    ): BillingResult = awaitPlay("acknowledge") {
        suspendCancellableCoroutine { continuation ->
            billingClient.acknowledgePurchase(params) { billingResult: BillingResult ->
                if (!continuation.acceptsCallback("acknowledge", billingResult.responseCode)) {
                    return@acknowledgePurchase
                }
                continuation.resume(billingResult)
            }
        }
    }

    private suspend fun consumeProductAsync(
        billingClient: BillingClient,
        params: ConsumeParams,
    ): BillingResult = awaitPlay("consume") {
        suspendCancellableCoroutine { continuation ->
            billingClient.consumeAsync(params) { billingResult: BillingResult, _: String ->
                if (!continuation.acceptsCallback("consume", billingResult.responseCode)) {
                    return@consumeAsync
                }
                continuation.resume(billingResult)
            }
        }
    }
}
