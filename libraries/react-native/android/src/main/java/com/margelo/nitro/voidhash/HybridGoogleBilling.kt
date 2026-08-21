package com.margelo.nitro.voidhash

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
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.margelo.nitro.core.Promise
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@Keep
@DoNotStrip
class HybridGoogleBilling : HybridGoogleBillingSpec(), PurchasesUpdatedListener {
    companion object {
        const val TAG = "HybridGoogleBilling"
    }

    private var billingClientCache: BillingClient? = null
    private val skus: MutableMap<String, ProductDetails> = mutableMapOf()
    private var context: Context? = null
    private var currentActivity: android.app.Activity? = null
    private var onPurchaseCallback: ((HybridGoogleBillingPurchaseSpec) -> Unit)? = null
    private val purchaseCoordinator = PurchaseOperationCoordinator<HybridGoogleBillingPurchaseSpec>()

    fun setContext(ctx: Context) {
        context = ctx
    }

    fun setCurrentActivity(activity: android.app.Activity?) {
        currentActivity = activity
    }

    override fun initConnection(onPurchase: ((HybridGoogleBillingPurchaseSpec) -> Unit)?): Promise<Boolean> {
        return Promise.async {
            onPurchaseCallback = onPurchase
            ensureBillingClient()
            return@async true
        }
    }


    override fun endConnection(): Promise<Boolean> {
        return Promise.async {
            billingClientCache?.endConnection()
            billingClientCache = null
            skus.clear()
            onPurchaseCallback = null
            purchaseCoordinator.fail(Error("CONNECTION_ENDED: Google Billing connection ended"))
            return@async true
        }
    }

    override fun getItemsByType(type: GoogleBillingProductType, skus: Array<String>): Promise<Array<HybridGoogleBillingProductDetailSpec>> {
        return Promise.async {
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
            
            val productDetailsList = productDetailsResult.productDetailsList
            
            val items = productDetailsList.map { productDetails ->
                this.skus[productDetails.productId] = productDetails
                createProductDetailSpec(productDetails)
            }.toTypedArray()
            
            return@async items
        }
    }

    override fun buyItemByType(params: GoogleBillingBuyItemByTypeParams): Promise<Array<HybridGoogleBillingPurchaseSpec>> {
        return Promise.async {
            val type = params.type
            val skuArr = params.skuArr
            val purchaseToken = params.purchaseToken
            val replacementMode = params.replacementMode?.toInt() ?: -1
            val obfuscatedAccountId = params.obfuscatedAccountId
            val obfuscatedProfileId = params.obfuscatedProfileId
            val offerTokenArr = params.offerTokenArr ?: emptyArray()
            val isOfferPersonalized = params.isOfferPersonalized ?: false

            if (this.currentActivity == null) {
                throw Error("CURRENT_ACTIVITY_NULL: Current activity returned null")
            }

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
                    val mode = when (replacementMode) {
                        SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE -> SubscriptionUpdateParams.ReplacementMode.CHARGE_PRORATED_PRICE
                        SubscriptionUpdateParams.ReplacementMode.WITHOUT_PRORATION -> SubscriptionUpdateParams.ReplacementMode.WITHOUT_PRORATION
                        SubscriptionUpdateParams.ReplacementMode.DEFERRED -> SubscriptionUpdateParams.ReplacementMode.DEFERRED
                        SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION -> SubscriptionUpdateParams.ReplacementMode.WITH_TIME_PRORATION
                        SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE -> SubscriptionUpdateParams.ReplacementMode.CHARGE_FULL_PRICE
                        else -> SubscriptionUpdateParams.ReplacementMode.UNKNOWN_REPLACEMENT_MODE
                    }
                    subscriptionUpdateParams.setSubscriptionReplacementMode(mode)
                }
                builder.setSubscriptionUpdateParams(subscriptionUpdateParams.build())
            }

            obfuscatedAccountId?.let { builder.setObfuscatedAccountId(it) }
            obfuscatedProfileId?.let { builder.setObfuscatedProfileId(it) }
            val expectedProductIds = skuArr.toSet()

            return@async suspendCancellableCoroutine { continuation ->
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
                    billingClient.launchBillingFlow(currentActivity!!, builder.build())
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
    }


    override fun acknowledgePurchase(token: String): Promise<HybridGoogleBillingAcknowledgeResultSpec> {
        return Promise.async {
            val billingClient = ensureBillingClient()
            
            val acknowledgePurchaseParams = AcknowledgePurchaseParams
                .newBuilder()
                .setPurchaseToken(token)
                .build()

            val result = acknowledgePurchaseAsync(billingClient, acknowledgePurchaseParams)
            
            return@async HybridGoogleBillingAcknowledgeResult(
                responseCode = result.responseCode.toDouble(),
                debugMessage = result.debugMessage,
                code = getBillingResponseCode(result.responseCode),
                message = getBillingResponseMessage(result.responseCode)
            )
        }
    }

    override fun consumeProduct(token: String): Promise<HybridGoogleBillingAcknowledgeResultSpec> {
        return Promise.async {
            val billingClient = ensureBillingClient()
            val consumeParams = ConsumeParams
                .newBuilder()
                .setPurchaseToken(token)
                .build()

            val result = consumeProductAsync(billingClient, consumeParams)

            return@async HybridGoogleBillingAcknowledgeResult(
                responseCode = result.responseCode.toDouble(),
                debugMessage = result.debugMessage,
                code = getBillingResponseCode(result.responseCode),
                message = getBillingResponseMessage(result.responseCode)
            )
        }
    }

    override fun getAvailableItemsByType(type: GoogleBillingProductType): Promise<Array<HybridGoogleBillingPurchaseSpec>> {
        return Promise.async {
            val billingClient = ensureBillingClient()
            
            val params = QueryPurchasesParams
                .newBuilder()
                .setProductType(convertProductType(type))
                .build()

            val purchases = queryPurchases(billingClient, params)

            return@async purchases.map { purchase ->
                HybridGoogleBillingPurchase(
                    id = purchase.products.firstOrNull() ?: "",
                    ids = purchase.products.toTypedArray(),
                    orderId = purchase.orderId,
                    purchaseTime = purchase.purchaseTime.toDouble(),
                    originalJson = purchase.originalJson,
                    purchaseToken = purchase.purchaseToken,
                    signature = purchase.signature,
                    isAutoRenewing = if (type == GoogleBillingProductType.SUBS) purchase.isAutoRenewing else null,
                    isAcknowledged = purchase.isAcknowledged,
                    purchaseState = purchase.purchaseState.toDouble(),
                    packageName = purchase.packageName,
                    developerPayload = purchase.developerPayload,
                    obfuscatedAccountId = purchase.accountIdentifiers?.obfuscatedAccountId,
                    obfuscatedProfileId = purchase.accountIdentifiers?.obfuscatedProfileId
                )
            }.toTypedArray()
        }
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

        val hybridPurchases = purchases.orEmpty().map<Purchase, HybridGoogleBillingPurchaseSpec> { purchase ->
            Log.i(TAG, "Purchase successful: ${purchase.products.firstOrNull()}")
            val hybridPurchase = HybridGoogleBillingPurchase(
                id = purchase.products.firstOrNull() ?: "",
                ids = purchase.products.toTypedArray(),
                orderId = purchase.orderId,
                purchaseTime = purchase.purchaseTime.toDouble(),
                originalJson = purchase.originalJson,
                purchaseToken = purchase.purchaseToken,
                signature = purchase.signature,
                isAutoRenewing = purchase.isAutoRenewing,
                isAcknowledged = purchase.isAcknowledged,
                purchaseState = purchase.purchaseState.toDouble(),
                packageName = purchase.packageName,
                developerPayload = purchase.developerPayload,
                obfuscatedAccountId = purchase.accountIdentifiers?.obfuscatedAccountId,
                obfuscatedProfileId = purchase.accountIdentifiers?.obfuscatedProfileId
            )
            try {
                onPurchaseCallback?.invoke(hybridPurchase)
            } catch (error: Throwable) {
                Log.e(TAG, "Purchase observer callback failed", error)
            }
            hybridPurchase
        }.toTypedArray()

        if (hybridPurchases.isEmpty()) {
            purchaseCoordinator.fail(
                Error("PURCHASE_EMPTY: Google Billing returned no purchases")
            )
        } else {
            purchaseCoordinator.succeed(hybridPurchases)
        }
    }

    private fun convertProductType(type: GoogleBillingProductType): String {
        return when (type) {
            GoogleBillingProductType.INAPP -> BillingClient.ProductType.INAPP
            GoogleBillingProductType.SUBS -> BillingClient.ProductType.SUBS
        }
    }

    private fun createProductDetailSpec(productDetails: ProductDetails): HybridGoogleBillingProductDetailSpec {
        val currency = productDetails.oneTimePurchaseOfferDetails?.priceCurrencyCode
            ?: productDetails.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()?.priceCurrencyCode
            ?: "Unknown"
        val displayPrice = productDetails.oneTimePurchaseOfferDetails?.formattedPrice
            ?: productDetails.subscriptionOfferDetails?.firstOrNull()?.pricingPhases?.pricingPhaseList?.firstOrNull()?.formattedPrice
            ?: "N/A"

        return HybridGoogleBillingProductDetail(
            id = productDetails.productId,
            title = productDetails.title,
            description = productDetails.description,
            type = productDetails.productType,
            displayName = productDetails.name,
            platform = "android",
            currency = currency,
            displayPrice = displayPrice,
            oneTimePurchaseOfferDetails = productDetails.oneTimePurchaseOfferDetails?.let {
                Variant_NullType_HybridGoogleBillingOneTimePurchaseOfferDetailsSpec.Second(
                    HybridGoogleBillingOneTimePurchaseOfferDetails(
                        priceCurrencyCode = it.priceCurrencyCode,
                        formattedPrice = it.formattedPrice,
                        priceAmountMicros = it.priceAmountMicros.toString()
                    )
                )
            },
            subscriptionOfferDetails = productDetails.subscriptionOfferDetails?.map { subscriptionOfferDetailsItem ->
                HybridGoogleBillingSubscriptionOfferDetails(
                    basePlanId = subscriptionOfferDetailsItem.basePlanId,
                    offerId = subscriptionOfferDetailsItem.offerId,
                    offerToken = subscriptionOfferDetailsItem.offerToken,
                    offerTags = subscriptionOfferDetailsItem.offerTags.toTypedArray(),
                    pricingPhases = HybridGoogleBillingPricingPhases(
                        pricingPhaseList = subscriptionOfferDetailsItem.pricingPhases.pricingPhaseList.map { pricingPhaseItem ->
                            HybridGoogleBillingPricingPhase(
                                formattedPrice = pricingPhaseItem.formattedPrice,
                                priceCurrencyCode = pricingPhaseItem.priceCurrencyCode,
                                billingPeriod = pricingPhaseItem.billingPeriod,
                                billingCycleCount = pricingPhaseItem.billingCycleCount.toDouble(),
                                priceAmountMicros = pricingPhaseItem.priceAmountMicros.toString(),
                                recurrenceMode = pricingPhaseItem.recurrenceMode.toDouble()
                            )
                        }.toTypedArray()
                    )
                )
            }?.toTypedArray<HybridGoogleBillingSubscriptionOfferDetailsSpec>()?.let {
                Variant_NullType_Array_HybridGoogleBillingSubscriptionOfferDetailsSpec_.Second(it)
            }
        )
    }

    private suspend fun ensureBillingClient(): BillingClient {
        if (billingClientCache?.isReady == true) {
            return billingClientCache!!
        }

        return initBillingClient()
    }

    private suspend fun initBillingClient(): BillingClient {
        val ctx = context ?: throw Error("GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized")

        if (GoogleApiAvailability
            .getInstance()
            .isGooglePlayServicesAvailable(ctx) != ConnectionResult.SUCCESS
        ) {
            Log.i(TAG, "Google Play Services are not available on this device")
            throw Error("GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection not initialized")
        }

        return suspendCancellableCoroutine { continuation ->
            billingClientCache = BillingClient
                .newBuilder(ctx)
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build()

            billingClientCache?.startConnection(
                object : BillingClientStateListener {
                    override fun onBillingSetupFinished(billingResult: BillingResult) {
                        if (billingResult.responseCode != BillingClient.BillingResponseCode.OK) {
                            continuation.resumeWithException(Error("GOOGLE_BILLING_NOT_INITIALIZED: Google Billing connection initialization failed"))
                            return
                        }
                        continuation.resume(billingClientCache!!)
                    }

                    override fun onBillingServiceDisconnected() {
                        Log.i(TAG, "Billing service disconnected")
                    }
                },
            )
        }
    }

    private suspend fun queryProductDetails(
        billingClient: BillingClient,
        params: QueryProductDetailsParams
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
        params: QueryPurchasesParams
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
        params: AcknowledgePurchaseParams
    ): BillingResult {
        return suspendCancellableCoroutine { continuation ->
            billingClient.acknowledgePurchase(params) { billingResult: BillingResult ->
                continuation.resume(billingResult)
            }
        }
    }

    private suspend fun consumeProductAsync(
        billingClient: BillingClient,
        params: ConsumeParams
    ): BillingResult {
        return suspendCancellableCoroutine { continuation ->
            billingClient.consumeAsync(params) { billingResult: BillingResult, _: String ->
                continuation.resume(billingResult)
            }
        }
    }

    private fun getBillingResponseCode(responseCode: Int): String {
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

    private fun getBillingResponseMessage(responseCode: Int): String {
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
