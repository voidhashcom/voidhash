package com.voidhash.core.billing

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingFlowParams.SubscriptionUpdateParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Shared Google Play Billing engine used by every Voidhash Android SDK flavour.
 *
 * The hosting SDK supplies the Android context and the current activity through
 * providers, so the engine always resolves them lazily at call time instead of
 * relying on setters that may never fire.
 *
 * @param onWarning receives recoverable anomalies the engine works around; logs
 *   under [TAG] unless the host overrides it.
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
    private val onWarning: (String) -> Unit = { message -> Log.w(TAG, message) },
) : PurchasesUpdatedListener {
    companion object {
        const val TAG = "VoidhashBillingEngine"

        internal fun mapReplacementMode(replacementMode: Int): Int {
            return when (replacementMode) {
                SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE -> SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE
                SubscriptionUpdateParams.ReplacementMode.WITHOUT_PRORATION -> SubscriptionUpdateParams.ReplacementMode.WITHOUT_PRORATION
                SubscriptionUpdateParams.ReplacementMode.DEFERRED -> SubscriptionUpdateParams.ReplacementMode.DEFERRED
                SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION -> SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION
                SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE -> SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE
                else -> SubscriptionUpdateParams.ReplacementMode.UNKNOWN_REPLACEMENT_MODE
            }
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
                else -> "Unknown error"
            }
        }
    }

    @Volatile
    private var billingClientCache: BillingClient? = null
    private val skus: MutableMap<String, ProductDetails> = mutableMapOf()
    private var onPurchaseCallback: ((BillingPurchase) -> Unit)? = null
    private val purchaseCoordinator = PurchaseOperationCoordinator<BillingPurchase>()
    private val connectionMutex = Mutex()

    /** Connects to Google Play Billing and registers an observer for out-of-band purchases. */
    suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)? = null): Boolean {
        onPurchaseCallback = onPurchase
        ensureBillingClient()
        return true
    }

    /** Tears the billing connection down and fails any in-flight purchase. */
    suspend fun endConnection(): Boolean {
        billingClientCache?.endConnection()
        billingClientCache = null
        skus.clear()
        onPurchaseCallback = null
        purchaseCoordinator.fail(Error("CONNECTION_ENDED: Google Billing connection ended"))
        return true
    }

    /** Queries store metadata for [skus] and caches the raw product details for purchases. */
    suspend fun getItemsByType(type: BillingProductType, skus: Array<String>): Array<BillingProductDetail> {
        val billingClient = ensureBillingClient()

        val skuList = skus.map { sku ->
            QueryProductDetailsParams.Product
                .newBuilder()
                .setProductId(sku)
                .setProductType(convertProductType(type))
                .build()
        }

        if (skuList.isEmpty()) {
            throw Error("EMPTY_SKU_LIST: No SKUs provided for product query")
        }

        val params = QueryProductDetailsParams
            .newBuilder()
            .setProductList(skuList)
            .build()

        val productDetailsResult = queryProductDetails(billingClient, params)

        return productDetailsResult.productDetailsList.map { productDetails ->
            this.skus[productDetails.productId] = productDetails
            createProductDetail(productDetails)
        }.toTypedArray()
    }

    /** Launches the billing flow and suspends until Google Play reports the matching purchases. */
    suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase> {
        val type = params.type
        val skuArr = params.skuArr
        val purchaseToken = params.purchaseToken
        val replacementMode = params.replacementMode ?: -1
        val obfuscatedAccountId = params.obfuscatedAccountId
        val obfuscatedProfileId = params.obfuscatedProfileId
        val offerTokenArr = params.offerTokenArr ?: emptyArray()
        val isOfferPersonalized = params.isOfferPersonalized ?: false

        val activity = activityProvider()
            ?: throw Error("CURRENT_ACTIVITY_NULL: Current activity returned null")

        val billingClient = ensureBillingClient()

        if (convertProductType(type) == BillingClient.ProductType.SUBS && skuArr.size != offerTokenArr.size) {
            throw Error("SKU_OFFER_MISMATCH: The number of SKUs (${skuArr.size}) must match the number of offer tokens (${offerTokenArr.size}) for subscriptions")
        }

        val productParamsList = skuArr.mapIndexed { index, sku ->
            val selectedSku = skus[sku]
                ?: throw Error("SKU_NOT_FOUND: The SKU was not found. Please fetch products first by calling getItems")

            val productDetailParams = BillingFlowParams.ProductDetailsParams
                .newBuilder()
                .setProductDetails(selectedSku)

            if (convertProductType(type) == BillingClient.ProductType.SUBS) {
                productDetailParams.setOfferToken(offerTokenArr[index])
            }

            productDetailParams.build()
        }

        val builder = BillingFlowParams
            .newBuilder()
            .setProductDetailsParamsList(productParamsList)
            .setIsOfferPersonalized(isOfferPersonalized)

        if (purchaseToken != null) {
            val subscriptionUpdateParams = SubscriptionUpdateParams
                .newBuilder()
                .setOldPurchaseToken(purchaseToken)

            if (convertProductType(type) == BillingClient.ProductType.SUBS && replacementMode != -1) {
                subscriptionUpdateParams.setSubscriptionReplacementMode(mapReplacementMode(replacementMode))
            }
            builder.setSubscriptionUpdateParams(subscriptionUpdateParams.build())
        }

        obfuscatedAccountId?.let { builder.setObfuscatedAccountId(it) }
        obfuscatedProfileId?.let { builder.setObfuscatedProfileId(it) }
        val expectedProductIds = skuArr.toSet()

        return suspendCancellableCoroutine { continuation ->
            val handle = try {
                purchaseCoordinator.begin(
                    accepts = { purchases ->
                        purchases
                            .flatMap { purchase -> purchase.ids.asIterable() }
                            .toSet()
                            .containsAll(expectedProductIds)
                    },
                    complete = { result ->
                        result.fold(
                            onSuccess = continuation::resume,
                            onFailure = continuation::resumeWithException,
                        )
                    },
                )
            } catch (error: Throwable) {
                continuation.resumeWithException(error)
                return@suspendCancellableCoroutine
            }
            continuation.invokeOnCancellation {
                purchaseCoordinator.cancel(handle)
            }

            val billingResult = try {
                billingClient.launchBillingFlow(activity, builder.build())
            } catch (error: Throwable) {
                purchaseCoordinator.fail(error)
                return@suspendCancellableCoroutine
            }
            if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                purchaseCoordinator.fail(
                    Error("BILLING_ERROR: Google Billing operation failed - ${billingResult.debugMessage}")
                )
            }
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

        return BillingAcknowledgeResult(
            responseCode = result.responseCode.toDouble(),
            debugMessage = result.debugMessage,
            code = getBillingResponseCode(result.responseCode),
            message = getBillingResponseMessage(result.responseCode),
        )
    }

    /** Returns the purchases currently owned by the signed-in Play account. */
    suspend fun getAvailableItemsByType(type: BillingProductType): Array<BillingPurchase> {
        val billingClient = ensureBillingClient()

        val params = QueryPurchasesParams
            .newBuilder()
            .setProductType(convertProductType(type))
            .build()

        val purchases = queryPurchases(billingClient, params)

        return purchases.map { purchase ->
            createPurchase(
                purchase,
                isAutoRenewing = if (type == BillingProductType.SUBS) purchase.isAutoRenewing else null,
            )
        }.toTypedArray()
    }

    override fun onPurchasesUpdated(
        billingResult: BillingResult,
        purchases: List<Purchase>?,
    ) {
        val responseCode = billingResult.responseCode
        if (responseCode != BillingClient.BillingResponseCode.OK) {
            Log.e(TAG, "Purchase failed with response code: $responseCode, message: ${billingResult.debugMessage}")
            val errorCode = when (responseCode) {
                BillingClient.BillingResponseCode.USER_CANCELED -> "USER_CANCELLED"
                BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "SKU_NOT_FOUND"
                else -> "BILLING_ERROR"
            }
            purchaseCoordinator.fail(
                Error("$errorCode: ${billingResult.debugMessage}")
            )
            return
        }

        val billingPurchases = purchases.orEmpty().map { purchase ->
            Log.i(TAG, "Purchase successful: ${purchase.products.firstOrNull()}")
            val billingPurchase = createPurchase(purchase, isAutoRenewing = purchase.isAutoRenewing)
            try {
                onPurchaseCallback?.invoke(billingPurchase)
            } catch (error: Throwable) {
                Log.e(TAG, "Purchase observer callback failed", error)
            }
            billingPurchase
        }.toTypedArray()

        if (billingPurchases.isEmpty()) {
            purchaseCoordinator.fail(
                Error("PURCHASE_EMPTY: Google Billing returned no purchases")
            )
        } else {
            purchaseCoordinator.succeed(billingPurchases)
        }
    }

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
        )
    }

    private fun createProductDetail(productDetails: ProductDetails): BillingProductDetail {
        val currency = productDetails.oneTimePurchaseOfferDetails?.priceCurrencyCode
            ?: productDetails.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()?.priceCurrencyCode
            ?: "Unknown"
        val displayPrice = productDetails.oneTimePurchaseOfferDetails?.formattedPrice
            ?: productDetails.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()?.formattedPrice
            ?: "N/A"

        return BillingProductDetail(
            id = productDetails.productId,
            title = productDetails.title,
            description = productDetails.description,
            type = productDetails.productType,
            displayName = productDetails.name,
            platform = "android",
            currency = currency,
            displayPrice = displayPrice,
            oneTimePurchaseOfferDetails = productDetails.oneTimePurchaseOfferDetails?.let {
                BillingOneTimePurchaseOfferDetails(
                    priceCurrencyCode = it.priceCurrencyCode,
                    formattedPrice = it.formattedPrice,
                    priceAmountMicros = it.priceAmountMicros.toString(),
                )
            },
            subscriptionOfferDetails = productDetails.subscriptionOfferDetails?.map { subscriptionOfferDetailsItem ->
                BillingSubscriptionOfferDetails(
                    basePlanId = subscriptionOfferDetailsItem.basePlanId,
                    offerId = subscriptionOfferDetailsItem.offerId,
                    offerToken = subscriptionOfferDetailsItem.offerToken,
                    offerTags = subscriptionOfferDetailsItem.offerTags.toTypedArray(),
                    pricingPhases = BillingPricingPhases(
                        pricingPhaseList = subscriptionOfferDetailsItem.pricingPhases.pricingPhaseList.map { pricingPhaseItem ->
                            BillingPricingPhase(
                                formattedPrice = pricingPhaseItem.formattedPrice,
                                priceCurrencyCode = pricingPhaseItem.priceCurrencyCode,
                                billingPeriod = pricingPhaseItem.billingPeriod,
                                billingCycleCount = pricingPhaseItem.billingCycleCount.toDouble(),
                                priceAmountMicros = pricingPhaseItem.priceAmountMicros.toString(),
                                recurrenceMode = pricingPhaseItem.recurrenceMode.toDouble(),
                            )
                        }.toTypedArray(),
                    ),
                )
            }?.toTypedArray(),
        )
    }

    /**
     * Returns a connected client, reusing the cached one when it is still ready.
     * Serialized so concurrent callers share a single connection attempt instead
     * of racing two `startConnection` calls onto two clients.
     */
    private suspend fun ensureBillingClient(): BillingClient = connectionMutex.withLock {
        billingClientCache?.takeIf { it.isReady } ?: initBillingClient()
    }

    private suspend fun initBillingClient(): BillingClient {
        val ctx = contextProvider()
            ?: throw Error("GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized")

        if (!isPlayServicesAvailable(ctx)) {
            Log.i(TAG, "Google Play Services are not available on this device")
            throw Error("GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized")
        }

        val billingClient = billingClientFactory(ctx, this)

        return suspendCancellableCoroutine { continuation ->
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
                            continuation.resumeWithException(Error("GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection initialization failed"))
                            return
                        }
                        // Only a connected client is worth reusing: caching earlier
                        // would hand a dead client to the next caller.
                        billingClientCache = billingClient
                        continuation.resume(billingClient)
                    }

                    override fun onBillingServiceDisconnected() {
                        Log.i(TAG, "Billing service disconnected")
                        // Google Play never delivers `onPurchasesUpdated` after a
                        // disconnect, so a pending buy would hang forever.
                        purchaseCoordinator.fail(
                            Error("BILLING_ERROR: Google Billing service disconnected"),
                        )
                    }
                },
            )
        }
    }

    private suspend fun queryProductDetails(
        billingClient: BillingClient,
        params: QueryProductDetailsParams,
    ): QueryProductDetailsResult {
        return suspendCancellableCoroutine { continuation ->
            billingClient.queryProductDetailsAsync(params) { billingResult: BillingResult, productDetailsResult: QueryProductDetailsResult ->
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    continuation.resumeWithException(Error("BILLING_ERROR: Google Billing product query failed"))
                    return@queryProductDetailsAsync
                }
                continuation.resume(productDetailsResult)
            }
        }
    }

    private suspend fun queryPurchases(
        billingClient: BillingClient,
        params: QueryPurchasesParams,
    ): List<Purchase> {
        return suspendCancellableCoroutine { continuation ->
            billingClient.queryPurchasesAsync(params) { billingResult: BillingResult, purchases: List<Purchase>? ->
                if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                    continuation.resumeWithException(Error("BILLING_ERROR: Google Billing purchases query failed"))
                    return@queryPurchasesAsync
                }
                continuation.resume(purchases ?: emptyList())
            }
        }
    }

    private suspend fun acknowledgePurchaseAsync(
        billingClient: BillingClient,
        params: AcknowledgePurchaseParams,
    ): BillingResult {
        return suspendCancellableCoroutine { continuation ->
            billingClient.acknowledgePurchase(params) { billingResult: BillingResult ->
                continuation.resume(billingResult)
            }
        }
    }

    private suspend fun consumeProductAsync(
        billingClient: BillingClient,
        params: ConsumeParams,
    ): BillingResult {
        return suspendCancellableCoroutine { continuation ->
            billingClient.consumeAsync(params) { billingResult: BillingResult, _: String ->
                continuation.resume(billingResult)
            }
        }
    }
}
