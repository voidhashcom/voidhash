package com.voidhash.sdk.billing

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Typeface
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.voidhash.core.billing.BillingAcknowledgeResult
import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingPurchase
import com.voidhash.sdk.VoidhashException
import com.voidhash.sdk.schema.RuntimeDevelopmentConfiguration
import com.voidhash.sdk.schema.RuntimeSchema
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.UUID
import kotlin.coroutines.resume

/** Artificial latency so loading states behave like the real store flow. */
private const val DEV_PURCHASE_LATENCY_MS = 600L

/**
 * The mock store behind development mode.
 *
 * Synthesizes products from the schema's computed `providers.development`
 * entries and confirms purchases with an in-app sheet instead of Play Billing,
 * so an integration can be validated end-to-end without store credentials.
 * Only reachable from debug builds — release builds always use the real store.
 */
class DevelopmentBillingEngine(
    private val activityProvider: () -> Activity?,
    private val onWarning: (String) -> Unit = {},
) : BillingEnginePort {
    private val catalog = LinkedHashMap<String, RuntimeDevelopmentConfiguration>()

    /** Replaces the purchasable catalog from a freshly resolved schema. */
    fun updateCatalog(schema: RuntimeSchema) {
        synchronized(catalog) {
            catalog.clear()
            for ((_, definition) in schema.products) {
                val configuration = definition.providers.development ?: continue
                catalog[configuration.productId] = configuration
            }
        }
    }

    override suspend fun initConnection(onPurchase: ((BillingPurchase) -> Unit)?): Boolean = true

    override suspend fun endConnection(): Boolean = true

    override suspend fun getItemsByType(
        type: BillingProductType,
        skus: Array<String>,
    ): Array<BillingProductDetail> {
        val details = skus.mapNotNull { sku ->
            val configuration = synchronized(catalog) { catalog[sku] } ?: return@mapNotNull null
            BillingProductDetail(
                id = configuration.productId,
                title = configuration.productId,
                description = "Development purchase",
                type = type.name.lowercase(),
                displayName = configuration.productId,
                platform = "android",
                currency = configuration.currencyCode,
                displayPrice = "$" + "%.2f".format(configuration.price),
                subscriptionOfferDetails = null,
                oneTimePurchaseOfferDetails = null,
            )
        }
        return details.toTypedArray()
    }

    override suspend fun buyItemByType(params: BillingBuyItemParams): Array<BillingPurchase> {
        val activity = activityProvider()
            ?: throw VoidhashException("PURCHASE_FAILED", "No activity to present the test purchase sheet")

        val productId = params.skuArr.firstOrNull()
            ?: throw VoidhashException("PURCHASE_FAILED", "No product requested")
        val configuration = synchronized(catalog) { catalog[productId] }
            ?: throw VoidhashException("PRODUCT_NOT_FOUND", "Product not configured for development: $productId")

        val confirmed = presentConfirmationSheet(activity, productId, configuration)
        if (!confirmed) {
            throw VoidhashException("USER_CANCELLED", "Development purchase cancelled")
        }

        // Keeps loading states honest, mirroring the React Native mock store.
        delay(DEV_PURCHASE_LATENCY_MS)
        val transactionId = UUID.randomUUID().toString()
        return arrayOf(
            BillingPurchase(
                id = productId,
                ids = arrayOf(productId),
                orderId = transactionId,
                purchaseTime = System.currentTimeMillis().toDouble(),
                originalJson = "{}",
                purchaseToken = "dev:$transactionId",
                signature = "",
                isAutoRenewing = false,
                isAcknowledged = true,
                purchaseState = 1.0,
                packageName = activity.packageName ?: "",
                developerPayload = "",
                obfuscatedAccountId = null,
                obfuscatedProfileId = null,
            ),
        )
    }

    override suspend fun acknowledgePurchase(token: String): BillingAcknowledgeResult =
        BillingAcknowledgeResult(0.0, null, "OK", "")

    override suspend fun consumeProduct(token: String): BillingAcknowledgeResult =
        BillingAcknowledgeResult(0.0, null, "OK", "")

    override suspend fun getAvailableItemsByType(type: BillingProductType): Array<BillingPurchase> =
        emptyArray()

    /**
     * Presents the confirmation sheet above whatever is on screen (including
     * the paywall WebView) and suspends until the user picks an action.
     */
    private suspend fun presentConfirmationSheet(
        activity: Activity,
        productId: String,
        configuration: RuntimeDevelopmentConfiguration,
    ): Boolean = suspendCancellableCoroutine { continuation ->
        val priceLabel = if (configuration.period == "lifetime") {
            "$" + "%.2f".format(configuration.price)
        } else {
            "$" + "%.2f".format(configuration.price) + " / " + configuration.period
        }

        val content = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            val padding = (16 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
            gravity = Gravity.CENTER_HORIZONTAL

            val nameLabel = TextView(activity).apply {
                text = productId
                textSize = 18f
                typeface = Typeface.DEFAULT_BOLD
            }
            val priceView = TextView(activity).apply {
                text = priceLabel
                textSize = 16f
            }
            val noteView = TextView(activity).apply {
                text = "Nothing will be charged."
                textSize = 13f
            }
            addView(nameLabel)
            addView(priceView)
            addView(noteView)
        }

        var settled = false
        val dialog = AlertDialog.Builder(activity)
            .setTitle("Test purchase")
            .setView(content)
            .setPositiveButton("Purchase") { _, _ ->
                settled = true
                continuation.resume(true)
            }
            .setNegativeButton("Cancel") { _, _ ->
                settled = true
                continuation.resume(false)
            }
            .setOnCancelListener {
                if (!settled) {
                    settled = true
                    continuation.resume(false)
                }
            }
            .create()

        continuation.invokeOnCancellation {
            dialog.dismiss()
        }
        activity.runOnUiThread { dialog.show() }
    }
}
