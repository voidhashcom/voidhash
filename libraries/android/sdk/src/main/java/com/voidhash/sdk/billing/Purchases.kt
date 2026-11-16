package com.voidhash.sdk.billing

import com.voidhash.core.billing.BillingReplacementMode

/** Which offer a purchase applies. */
sealed class VoidhashOfferSelection {
    /**
     * The product's introductory offer ([VoidhashSubscriptionInfo.introOffer]) when it has one,
     * otherwise its regular price. The default. A plan change ([VoidhashPurchaseOptions.replacing])
     * applies the introductory offer only when it is tagged `voidhash-intro` in the Play Console.
     */
    data object Automatic : VoidhashOfferSelection()

    /** The regular price: on Google Play the base plan, or the product's first purchase option. */
    data object None : VoidhashOfferSelection()

    /** [offer], one of the product's [VoidhashProduct.offers] or its introductory offer. */
    data class Offer(val offer: VoidhashOffer) : VoidhashOfferSelection()

    /** The offer whose [VoidhashOffer.id] is [id], among the product's offers and its introductory offer. */
    data class Id(val id: String) : VoidhashOfferSelection()
}

/**
 * What only Google Play applies to a purchase.
 *
 * @property isOfferPersonalized tells Google Play the price was personalised for the user, which it
 *   then discloses on its sheet, as EU law requires.
 * @property obfuscatedProfileId Play's obfuscated profile id for the purchase: an id of the user's
 *   profile in the app, never personal data. The account id is the SDK's own.
 * @property offerToken buys exactly this base plan, offer or purchase option of the product,
 *   from [GooglePlayProductInfo], instead of the one the purchase's offer selection names.
 */
data class GooglePlayPurchaseOptions(
    val isOfferPersonalized: Boolean? = null,
    val obfuscatedProfileId: String? = null,
    val offerToken: String? = null,
)

/**
 * How a purchase is made.
 *
 * @property offer which offer to apply; see [VoidhashOfferSelection].
 * @property quantity how many to buy. Google Play has the user choose the quantity in its own sheet,
 *   so on Android anything but 1 fails with `INVALID_ARGUMENT`; the transaction reports what the user
 *   bought.
 * @property replacing the subscription this purchase replaces, if any.
 * @property googlePlay what only Google Play applies.
 */
data class VoidhashPurchaseOptions(
    val offer: VoidhashOfferSelection = VoidhashOfferSelection.Automatic,
    val quantity: Int = 1,
    val replacing: SubscriptionReplacement? = null,
    val googlePlay: GooglePlayPurchaseOptions? = null,
)

/**
 * How Google Play moves a subscriber from the subscription a purchase replaces to the one it
 * buys. Google Play replaces a subscription with a prepaid plan only with [CHARGE_FULL_PRICE], and
 * switches to an auto-renewing base plan of the same subscription only with [CHARGE_FULL_PRICE] or
 * [WITHOUT_PRORATION]; another mode fails with `INVALID_ARGUMENT` before its sheet opens.
 */
enum class SubscriptionReplacementMode(internal val billingMode: BillingReplacementMode) {
    /**
     * Nothing is charged now: the time left on the old subscription is converted, by price, into
     * time on the new one, which moves the next billing date. Google Play's own default, and the
     * default here; it suits upgrades and downgrades alike.
     */
    WITH_TIME_PRORATION(BillingReplacementMode.WITH_TIME_PRORATION),

    /**
     * The billing date stays, and the price difference for the rest of the period is charged now.
     * Google Play accepts it only for an upgrade, a subscription that costs more per unit of time.
     */
    CHARGE_PRORATED_PRICE(BillingReplacementMode.CHARGE_PRORATED_PRICE),

    /**
     * The full price of the new subscription is charged now, and what was left of the old one is
     * credited to it.
     */
    CHARGE_FULL_PRICE(BillingReplacementMode.CHARGE_FULL_PRICE),

    /** The billing date stays, and the new price is first charged on it. */
    WITHOUT_PRORATION(BillingReplacementMode.WITHOUT_PRORATION),

    /**
     * The change takes effect when the old subscription renews; the user keeps it until then, and
     * nothing is charged now. Google Play reports the new purchase with the old product until the
     * change, so the purchase's transaction names the old product, and the person's subscription
     * shows the coming change as `renewsToProductSlug`. Suits downgrades.
     */
    DEFERRED(BillingReplacementMode.DEFERRED),
}

/**
 * The subscription a purchase replaces: an upgrade, a downgrade or a change of plan, instead of a
 * second subscription next to the first.
 *
 * @property product the subscription product the user has now and the purchase ends. The SDK
 *   looks up its current purchase with Google Play; the purchase fails with
 *   `REPLACED_SUBSCRIPTION_NOT_OWNED` when the signed-in Play account does not own it. Another base
 *   plan of the bought product's Play subscription can be replaced too.
 * @property mode what Google Play charges when; see [SubscriptionReplacementMode].
 */
data class SubscriptionReplacement(
    val product: VoidhashProduct,
    val mode: SubscriptionReplacementMode = SubscriptionReplacementMode.WITH_TIME_PRORATION,
)

/** How a purchase ended. A failure is thrown as a [com.voidhash.sdk.VoidhashException] instead. */
sealed class VoidhashPurchaseResult {
    /**
     * The store charged the user.
     *
     * @property synced whether Voidhash recorded the purchase before `purchase` returned. When
     *   `false` the receipt waits on the device and is delivered once Voidhash can be reached; the
     *   person's access follows then.
     */
    data class Purchased(val transaction: VoidhashTransaction, val synced: Boolean) : VoidhashPurchaseResult()

    /**
     * The payment is pending, such as a cash payment Google Play waits for. Nothing is granted yet;
     * when the payment completes the purchase arrives through `transactionUpdates` and the person.
     */
    data object Pending : VoidhashPurchaseResult()

    /** The user closed the store's sheet without buying. */
    data object Cancelled : VoidhashPurchaseResult()

    /** The client was configured with `enabled = false`; nothing was bought. */
    data object Disabled : VoidhashPurchaseResult()
}

/**
 * A purchase that completed outside `purchase`, as `VoidhashClient.transactionUpdates` emits it.
 *
 * @property synced whether Voidhash had accepted the receipt when the update was emitted. When
 *   `false` the receipt waits on the device and is delivered once Voidhash can be reached; the
 *   person's access follows then.
 */
data class VoidhashTransactionUpdate(val transaction: VoidhashTransaction, val synced: Boolean)

/**
 * Why a purchase failed, as the store said, on top of the failure's code.
 *
 * @property wireName the reason's name on every Voidhash SDK.
 */
enum class PurchaseFailureReason(val wireName: String) {
    /** The payment was declined: the user's funds do not cover the price. */
    PAYMENT_DECLINED("paymentDeclined"),

    /**
     * The user's store account is not eligible for the offer, such as a free trial they had before.
     * Eligibility belongs to the store account, not to the Voidhash user; the SDK never retries at
     * the regular price.
     */
    INELIGIBLE_FOR_OFFER("ineligibleForOffer"),
}

/** The environment a transaction or subscription belongs to. */
enum class VoidhashEnvironment {
    PRODUCTION,

    /** A store's test environment, such as Google Play license testing. */
    SANDBOX,

    /** Xcode's local StoreKit testing; never on Android. */
    XCODE,

    /** Simulated purchases of development mode, and Voidhash's test environment. */
    DEVELOPMENT,

    /** Not known: a Google Play purchase does not say on the device, or an environment this SDK version does not know. */
    UNKNOWN,
}

/**
 * The offer a transaction applied, as far as the device knows.
 *
 * @property id the offer's id, as [VoidhashOffer.id] names it, or the store's offer id.
 * @property kind `null` when the device does not know it, as for an offer bought by its raw token.
 */
data class VoidhashTransactionOffer(
    val id: String?,
    val kind: VoidhashOfferKind?,
    val paymentMode: VoidhashPaymentMode?,
)

/** A Google Play purchase's state. */
enum class GooglePlayPurchaseState {
    PURCHASED,

    /** Paid for later, such as in cash; it grants nothing yet. */
    PENDING,

    /** A state this SDK version does not know. */
    UNKNOWN,
}

/**
 * What Google Play reported about a purchase, with Play's own names.
 *
 * @property obfuscatedAccountId the account id the purchase carries; the SDK sets it to a hash of the
 *   Voidhash identity that bought it.
 * @property isSuspended a subscription Play paused or put on hold; it grants no access, and the SDK
 *   never delivers, acknowledges or consumes it.
 */
data class GooglePlayTransactionInfo(
    val orderId: String?,
    val purchaseToken: String,
    val productIds: List<String>,
    val purchaseState: GooglePlayPurchaseState,
    val isAcknowledged: Boolean,
    val isAutoRenewing: Boolean?,
    val obfuscatedAccountId: String?,
    val obfuscatedProfileId: String?,
    val isSuspended: Boolean,
)

/**
 * A store transaction.
 *
 * @property id the Google Play purchase token, the same while the payment is pending and once it is
 *   made; for the development store, the simulated transaction's id.
 * @property originalId `null` on Google Play, whose order id is in [googlePlay].
 * @property productSlug the Studio product the purchase is for; `null` when the schema does not
 *   say, or when several Studio products are base plans of the same Play subscription and the
 *   device cannot tell which one Play billed.
 * @property storeProductId the Play product id Play reports for the purchase. For a deferred
 *   replacement this is the old product until the change takes effect.
 * @property purchasedAt when the purchase was made, in epoch milliseconds.
 * @property expiresAt `null` on Google Play, which does not say on the device; the person's
 *   subscriptions do.
 * @property quantity how many the user bought.
 * @property isRenewal `null` on Google Play, which does not say on the device.
 * @property offer the offer a purchase made through `purchase` applied; `null` for a purchase at the
 *   regular price, and for one the device did not start.
 * @property environment [VoidhashEnvironment.UNKNOWN] for Google Play, whose purchases do not say on
 *   the device whether they were test purchases.
 */
data class VoidhashTransaction(
    val id: String,
    val originalId: String?,
    val productSlug: String?,
    val storeProductId: String,
    val store: VoidhashStore,
    val purchasedAt: Long,
    val expiresAt: Long?,
    val quantity: Int,
    val isRenewal: Boolean?,
    val offer: VoidhashTransactionOffer?,
    val environment: VoidhashEnvironment,
    val googlePlay: GooglePlayTransactionInfo?,
)
