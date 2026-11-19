package com.voidhash.sdk

import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingEngineException
import com.voidhash.core.billing.BillingProductDetail
import com.voidhash.core.billing.BillingProductType
import com.voidhash.core.billing.BillingSubscriptionReplacement
import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.PurchasePaywallContext
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_PURCHASE
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_RESTORE
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_SYNC
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.TransactionSyncVerdict
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.billing.ProductMapping
import com.voidhash.sdk.billing.StoreTransaction
import com.voidhash.sdk.billing.SubscriptionReplacement
import com.voidhash.sdk.billing.SubscriptionReplacementMode
import com.voidhash.sdk.billing.VoidhashOffer
import com.voidhash.sdk.billing.VoidhashOfferKind
import com.voidhash.sdk.billing.VoidhashOfferSelection
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashProductType
import com.voidhash.sdk.billing.VoidhashPurchaseOptions
import com.voidhash.sdk.billing.VoidhashPurchaseResult
import com.voidhash.sdk.billing.VoidhashStore
import com.voidhash.sdk.billing.VoidhashTransaction
import com.voidhash.sdk.billing.VoidhashTransactionOffer
import com.voidhash.sdk.billing.VoidhashTransactionUpdate
import com.voidhash.sdk.billing.mapBillingPurchaseToTransaction
import com.voidhash.sdk.billing.mapDevelopmentProduct
import com.voidhash.sdk.billing.mapDevelopmentPurchaseToTransaction
import com.voidhash.sdk.billing.INTRO_OFFER_TAG
import com.voidhash.sdk.billing.isOnPurchaseOption
import com.voidhash.sdk.billing.isPrepaidPlan
import com.voidhash.sdk.billing.mapGooglePlayProduct
import com.voidhash.sdk.billing.productTypeOf
import com.voidhash.sdk.cache.CacheHit
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import com.voidhash.sdk.diagnostics.redacted
import com.voidhash.sdk.identity.AccountToken
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.network.FailureClass
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.VoidhashOutboundPausedException
import com.voidhash.sdk.network.classifyFailure
import com.voidhash.sdk.schema.RuntimeProductDefinition
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.transactions.AcceptedReceipt
import com.voidhash.sdk.transactions.TransactionOutbox
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.isActive
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.coroutines.yield
import org.json.JSONArray
import org.json.JSONObject

private const val PROCESSED_TRANSACTION_TTL_MS = 1000L * 60 * 30

/**
 * How long `purchase` waits, once Google Play charged the user, for what follows: Voidhash's answer
 * on the receipt, which may take up to the 10 s request limit, then refreshing the person in what
 * remains. Finishing with the store starts once the receipt is accepted and is not waited for. Past
 * this the purchase returns and the rest carries on: the receipt waits in the outbox, which
 * delivers it, and the purchase is finished with the store then.
 */
internal const val PURCHASE_WAIT_MS = 10_000L

/** `BillingClient.BillingResponseCode.ITEM_NOT_OWNED`, as the store reports it. */
private const val ITEM_NOT_OWNED = 8.0

/**
 * 30 days — how long the identity a restore asked for is remembered. Once the backend accepts
 * the restore the outbox remembers the owner it accepted, so this only has to outlast a restore
 * that is still queued, or a purchase still to be reported (see `forgetSettledRestores`).
 */
private const val RESTORED_TRANSACTION_IDENTITY_TTL_MS = 1000L * 60 * 60 * 24 * 30

/** Cache key prefix of the marker recording what happened to a transaction recently. */
internal const val PROCESSED_TRANSACTION_KEY_PREFIX = "processed-transaction:"

/** Cache key prefix of the identity an explicit restore asked for a receipt. */
internal const val RESTORED_TRANSACTION_IDENTITY_KEY_PREFIX = "restored-transaction-identity:"

/** Cache key prefix of the marker recording that this SDK started a purchase. */
internal const val SDK_STARTED_PURCHASE_KEY_PREFIX = "sdk-started-purchase:"

/**
 * 30 days — how long a purchase this SDK started is remembered as its own. Outlasts a payment that
 * stays pending for days, and the three days Google Play waits before refunding a purchase nobody
 * acknowledged.
 */
private const val SDK_STARTED_PURCHASE_TTL_MS = 1000L * 60 * 60 * 24 * 30

/**
 * Prefix, after [SDK_STARTED_PURCHASE_KEY_PREFIX], of the marker a purchase writes for its product
 * before the sheet opens, holding the launch time, the account token the purchase carries and the
 * paywall it was started from: the purchase token is known only once Play answers, which may reach
 * nobody (the process dies, or the client is released, with the sheet open).
 */
private const val SDK_LAUNCHED_PRODUCT_KEY_PREFIX = "product:"

/**
 * Field of a launch marker holding the launches of the product made under other account tokens,
 * by other users of the app, whose sheets' answers the SDK has not seen either.
 */
private const val EARLIER_LAUNCHES_FIELD = "earlier"

/** How many such launches a marker keeps. */
private const val MAX_OTHER_LAUNCHES = 4

/**
 * Field of a launch set when the purchase its sheet makes will carry no account id: a replacement
 * of a purchase that has none. Such a purchase is known by what it replaced instead (see
 * `claimLostReplacements`).
 */
private const val NO_ACCOUNT_TOKEN_FIELD = "noAccountToken"

/**
 * Cache key prefix of the identity that started a purchase whose account id is not its own: a
 * replacement that inherited the account id of the subscription it replaced, or none. Kept as long
 * as [SDK_STARTED_PURCHASE_KEY_PREFIX]. The account id cannot say who such a purchase is for, and
 * the mapping from that id to an identity stays with the identity the id was derived from.
 */
private const val PURCHASE_IDENTITY_KEY_PREFIX = "purchase-identity:"

/** `BillingClient.BillingResponseCode.DEVELOPER_ERROR`, as the store reports it. */
private const val DEVELOPER_ERROR = 5

/** The purchase a replacement ends: its token, and the account id Google Play holds for it, if any. */
private class ReplacedPurchase(val token: String, val accountToken: String?)

/**
 * How far Play's purchase time may run behind the device clock that stamped a launch, for the
 * purchase to still name the launch's paywall.
 */
private const val LAUNCH_CLOCK_SLACK_MS = 5 * 60_000L

/**
 * How long after a launch a purchase of its product still names the launch's paywall: as long as
 * a released client keeps the sheet's connection, and the clock slack. Whose purchase it is does
 * not depend on it (see `launchMarkerOf`).
 */
private const val LAUNCH_WINDOW_MS = 30 * 60_000L + LAUNCH_CLOCK_SLACK_MS

/**
 * Failures of a buy after which a purchase of the product may still exist that its sheet made, so
 * the launch marker stays to recognise it: another buy's sheet is open (`PURCHASE_IN_PROGRESS`),
 * the user owns the product already, perhaps from an earlier sheet whose answer was lost
 * (`ITEM_ALREADY_OWNED`), Google Play could not be reached, which includes its service going
 * away with the sheet open (`STORE_UNAVAILABLE`), or the store connection was ended under the
 * sheet, as a released client does once it stops waiting for it (`CONNECTION_ENDED`).
 */
private val LAUNCH_OUTCOME_UNKNOWN_CODES =
    setOf("PURCHASE_IN_PROGRESS", "ITEM_ALREADY_OWNED", "STORE_UNAVAILABLE", "CONNECTION_ENDED")

/**
 * Cache key prefix of the paywall a purchase this SDK started was made on, kept as long as
 * [SDK_STARTED_PURCHASE_KEY_PREFIX] so a purchase Google Play completes later still names it.
 */
private const val PURCHASE_PAYWALL_KEY_PREFIX = "purchase-paywall:"

/**
 * What one run of a transaction came to.
 *
 * @property accepted whether Voidhash accepted the receipt.
 * @property finishFailure why acknowledging or consuming the purchase failed after Voidhash
 *   accepted it. The receipt is settled, so a later scan retries only the store finish.
 */
private class TransactionRun(val accepted: Boolean, val finishFailure: Throwable? = null)

private val NOT_ACCEPTED = TransactionRun(accepted = false)
private val ACCEPTED = TransactionRun(accepted = true)

private class InFlightTransaction {
    val deferred = CompletableDeferred<TransactionRun>()

    /**
     * Whether Voidhash accepted the receipt, known as soon as it answered: before the store
     * finish, which [deferred] waits for.
     */
    val accepted = CompletableDeferred<Boolean>()
    var hostClaimed = false
    var ownerClaimed = false
    var storeFinalizationPending = false
}

/** The outcome of claiming a transaction: either this caller owns the run or it joins one. */
private class TransactionClaim(val entry: InFlightTransaction, val isOwner: Boolean)

/**
 * Owns the transaction lifecycle: buying through Play Billing, syncing to the
 * backend, and finishing (acknowledging or consuming) with the store.
 *
 * Processing is deduplicated per transaction both in memory (concurrent callers
 * coalesce onto one run) and across restarts (a 30-minute processed-transaction
 * cache entry recording `{backendAccepted, storeFinalized, externallyManaged}`, and the
 * outbox's durable record of accepted receipts). Automatic scans, observer callbacks, silent
 * syncs and host reports never resubmit a receipt Voidhash already accepted, and every
 * submission except an explicit restore is a `sync`, which never moves ownership. Observer mode
 * (`readOnly`) syncs but never finishes with the store — except for a purchase
 * this SDK started, whose ownership is pinned when the flow begins so a
 * mid-flight `setReadOnly(true)` can't strand the transaction. That purchase is also remembered
 * as the SDK's own, so one that completes later (a pending payment) or whose sync waited in the
 * outbox is still synced and finished by a later scan.
 *
 * A purchase that completes outside [purchase] — a pending payment paid later, a renewal or a
 * purchase made elsewhere that a scan finds — is announced to [onTransactionUpdate] once its receipt
 * is queued or accepted, saying which, at most once per transaction in a process.
 */
internal class PurchaseOrchestrator(
    private val billing: BillingEnginePort,
    private val apiClient: VoidhashApiClient,
    private val cacheManager: CacheManager,
    private val identityStore: IdentityStore,
    private val readOnlyProvider: () -> Boolean = { false },
    /** When true purchases run against the mock store instead of Play Billing. */
    private val developmentMode: Boolean = false,
    private val onPersonRefresh: suspend () -> Unit = {},
    /** Durable receipt store; a receipt is recorded here before it is ever sent. */
    private val outbox: TransactionOutbox? = null,
    private val onWarning: (String) -> Unit = {},
    /**
     * Runs what follows a purchase — syncing its receipt, finishing it with the store, refreshing
     * the person — so `purchase` waits for it at most [PURCHASE_WAIT_MS]; without one the
     * purchase waits for all of it.
     */
    private val syncScope: CoroutineScope? = null,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    /** Hears of the purchases that complete outside [purchase]; see the class documentation. */
    private val onTransactionUpdate: (VoidhashTransactionUpdate) -> Unit = {},
) {
    private val inFlightTransactions = mutableMapOf<String, InFlightTransaction>()

    /**
     * The Play products whose sheet a [purchase] has open, with how many sheets: a purchase of one
     * that completes meanwhile is that purchase's answer, not an update. Kept until the purchase
     * has added what it bought to [answeredTransactions].
     */
    private val openSheets = ConcurrentHashMap<String, Int>()

    /** The transactions [purchase] returned, and the ones announced as updates, by [announcementKey]. */
    private val answeredTransactions = java.util.Collections.newSetFromMap(ConcurrentHashMap<String, Boolean>())

    /**
     * The launches, by product id, whose sheet is open in this process and whose purchase will
     * carry no account id: replacements of a purchase that has none. Kept in memory only, from the
     * launch until the buy has marked what it bought; once the process is gone, such a purchase is
     * known by what it replaced (see [claimLostReplacements]).
     */
    private val sheetsWithoutAccountToken = ConcurrentHashMap<String, JSONObject>()

    // The observer callback processes transactions on its own coroutine, so the
    // registry and the entry flags are reached from several threads; both the
    // lookups and the check-then-act flag transitions run under this mutex.
    private val inFlightMutex = Mutex()
    private val restoreMutex = Mutex()

    /**
     * Loads the products of [slugs] from the store, keyed by slug. A product that cannot be offered —
     * not in the schema, not configured for the store, not returned by it, or returned without what
     * selling it needs — is left out and reported once as a `PRODUCT_NOT_FOUND` diagnostic with the
     * reason; one Google Play sells as the other type than Studio's (a subscription for a one-time
     * product, or the reverse) as `PRODUCT_TYPE_MISMATCH` with both types, as on iOS. The store is
     * asked once per product type, for the Play products of all of them, and once more per type only
     * when some were not returned, to tell a type mismatch from a missing product; nothing is asked
     * when none is configured for Google Play.
     *
     * [reportsUnsold] also reports the products Studio does not sell on Google Play (or, in
     * development mode, has no development configuration for), such as App Store only ones: the
     * app asked for them by slug. A load of every product leaves them out without a report.
     */
    suspend fun loadProducts(
        schema: RuntimeSchema,
        slugs: Collection<String>,
        reportsUnsold: Boolean,
    ): Map<String, VoidhashProduct> {
        val wanted = slugs.distinct().mapNotNull { slug ->
            val definition = schema.products[slug]
                ?: return@mapNotNull reportMissingProduct(slug, "the project schema has no such product")
            val type = productTypeOf(definition)
                ?: return@mapNotNull reportMissingProduct(slug, "its type \"${definition.type}\" is not supported by this SDK version")
            Triple(slug, definition, type)
        }
        val reportInvalidPeriod = { slug: String -> { period: String ->
            diagnostics.emit(
                VoidhashDiagnosticKind.STORE,
                code = "PRODUCT_PERIOD_INVALID",
                operation = "products.load",
                message = "The billing period \"$period\" of product \"$slug\" is not a plain ISO 8601 duration; " +
                    "it was read as well as it could be",
            )
        } }

        if (developmentMode) {
            return wanted.mapNotNull { (slug, definition, type) ->
                val configuration = definition.providers.development
                    ?: return@mapNotNull if (reportsUnsold) reportMissingProduct(slug, "it has no development configuration") else null
                slug to mapDevelopmentProduct(definition, type, configuration, reportInvalidPeriod(slug))
            }.toMap()
        }

        val sold = wanted.mapNotNull { (slug, definition, type) ->
            val playId = definition.providers.googlePlay?.productId?.takeIf { it.isNotEmpty() }
                ?: return@mapNotNull if (reportsUnsold) reportMissingProduct(slug, "it is not configured for Google Play") else null
            Triple(slug, definition, type) to playId
        }
        fun playTypeOf(type: VoidhashProductType) =
            if (type == VoidhashProductType.SUBSCRIPTION) BillingProductType.SUBS else BillingProductType.INAPP
        fun otherPlayTypeOf(type: VoidhashProductType) =
            if (type == VoidhashProductType.SUBSCRIPTION) BillingProductType.INAPP else BillingProductType.SUBS
        val details = HashMap<Pair<BillingProductType, String>, BillingProductDetail>()
        val unfetched = HashMap<Pair<BillingProductType, String>, String>()
        for ((type, playIds) in sold.groupBy({ (product, _) -> playTypeOf(product.third) }, { (_, playId) -> playId })) {
            val query = billing.queryProducts(type, playIds.distinct())
            query.products.forEach { details[type to it.id] = it }
            query.unfetched.forEach { unfetched[type to it.productId] = it.reason }
        }
        // Play returns a product only to a query of its own type, so one Studio types otherwise is
        // only "not found": asking for the missing ones as the other type tells the two apart.
        val missing = sold.filter { (product, playId) -> (playTypeOf(product.third) to playId) !in details }
        for ((type, playIds) in missing.groupBy({ (product, _) -> otherPlayTypeOf(product.third) }, { (_, playId) -> playId })) {
            billing.queryProducts(type, playIds.distinct()).products.forEach { details[type to it.id] = it }
        }

        return sold.mapNotNull { (product, playId) ->
            val (slug, definition, type) = product
            val playType = playTypeOf(type)
            val detail = details[playType to playId]
            if (detail == null) {
                if ((otherPlayTypeOf(type) to playId) !in details) {
                    return@mapNotNull reportMissingProduct(
                        slug,
                        "Google Play did not return its product \"$playId\": " +
                            (unfetched[playType to playId] ?: "Google Play did not return the product"),
                    )
                }
                val playTypeName = if (playType == BillingProductType.SUBS) "an in-app product" else "a subscription"
                diagnostics.emit(
                    VoidhashDiagnosticKind.STORE,
                    code = "PRODUCT_TYPE_MISMATCH",
                    operation = "products.load",
                    message = "Product \"$slug\" is left out: it is a ${definition.type} product in Studio, " +
                        "but Google Play sells $playId as $playTypeName",
                )
                return@mapNotNull null
            }
            when (val mapped = mapGooglePlayProduct(definition, type, detail, reportInvalidPeriod(slug))) {
                is ProductMapping.Mapped -> slug to mapped.product
                is ProductMapping.Unavailable -> reportMissingProduct(slug, mapped.reason)
            }
        }.toMap()
    }

    /** Reports that the product [slug] cannot be offered, and why; returns `null` to leave it out. */
    private fun <T> reportMissingProduct(slug: String, reason: String): T? {
        diagnostics.emit(
            VoidhashDiagnosticKind.STORE,
            code = "PRODUCT_NOT_FOUND",
            operation = "products.load",
            message = "Product \"$slug\" is not available: $reason",
        )
        return null
    }

    /**
     * Buys [product], syncs the resulting transaction and refreshes the person.
     *
     * The offer bought is [VoidhashPurchaseOptions.offer]'s (see [offerTokenFor]); an offer Play does
     * not offer this user fails with `OFFER_UNAVAILABLE`, and the product is never bought at its
     * regular price instead. Google Play refusing an offer the user is not eligible for fails with
     * [com.voidhash.sdk.billing.PurchaseFailureReason.INELIGIBLE_FOR_OFFER], and is not retried.
     * Any quantity but 1 fails with `INVALID_ARGUMENT`: Play has the user pick it. The development
     * store simulates the purchase, at the product's price whatever offer is named, as it has none.
     *
     * A cancelled sheet returns [VoidhashPurchaseResult.Cancelled], and a payment Play still waits
     * for [VoidhashPurchaseResult.Pending]; that purchase is synced and finished once a scan or the
     * purchase observer sees it paid.
     *
     * A product the user already owns fails with `ITEM_ALREADY_OWNED`, and starts a scan of the
     * store that delivers and finishes what the SDK owns of it.
     *
     * With [paywallContext], the receipt names the paywall the purchase was started from, also
     * when Google Play completes a pending purchase later.
     *
     * With [VoidhashPurchaseOptions.replacing], the purchase replaces the subscription it names
     * instead of adding a second one (see [replacedPurchase] for what is refused before the sheet
     * opens). It is otherwise the same purchase: only the new purchase is synced and finished, never
     * the one it replaces. Google Play refuses a replacement whose account id differs from the
     * replaced purchase's, so one is set only when they are equal; otherwise the new purchase
     * inherits the replaced purchase's and is tied to the identity that buys it by the launch marker
     * and [PURCHASE_IDENTITY_KEY_PREFIX]. A replacement Play still rejects as a developer error fails
     * with `SUBSCRIPTION_REPLACEMENT_REFUSED`. A deferred replacement's purchase reports the replaced
     * product until the change takes effect, and so does its transaction.
     */
    internal suspend fun purchase(
        product: VoidhashProduct,
        schema: RuntimeSchema,
        options: VoidhashPurchaseOptions = VoidhashPurchaseOptions(),
        paywallContext: PurchasePaywallContext? = null,
    ): VoidhashPurchaseResult {
        if (options.quantity != 1) {
            throw VoidhashException(
                "INVALID_ARGUMENT",
                "Google Play has the user choose the quantity in its own sheet: buy with a quantity of 1, " +
                    "not ${options.quantity}",
            )
        }
        val offer = if (developmentMode) OfferChoice(null, null) else offerTokenFor(product, options, schema)
        if (!developmentMode && product.type == VoidhashProductType.SUBSCRIPTION && offer.token == null) {
            throw VoidhashException(
                "PURCHASE_FAILED",
                "Google Play returned no base plan to buy for \"${product.slug}\"",
            )
        }
        val sheetProductIds = listOfNotNull(product.storeProductId, options.replacing?.product?.storeProductId).distinct()
        sheetProductIds.forEach { openSheets.merge(it, 1, Int::plus) }
        val bought = try {
            buy(product, schema, options, offer.token, paywallContext)?.also { bought ->
                // From here on its update is this purchase's answer, whenever the observer gets to it.
                if (bought.transaction.purchaseState == "purchased") answeredTransactions += announcementKey(bought.transaction)
            }
        } finally {
            sheetProductIds.forEach { productId -> openSheets.computeIfPresent(productId) { _, sheets -> (sheets - 1).takeIf { it > 0 } } }
        }
        if (bought == null) return VoidhashPurchaseResult.Cancelled
        if (bought.transaction.purchaseState == "pending") return VoidhashPurchaseResult.Pending
        val transaction = bought.transaction
        return VoidhashPurchaseResult.Purchased(
            transaction.toPublic(offer.offer),
            synced = complete(transaction, schema, bought.readOnlyAtPurchaseStart, bought.distinctId, paywallContext),
        )
    }

    /** The Play offer token a purchase buys with, and the offer it applies as its transaction names it. */
    private class OfferChoice(val token: String?, val offer: VoidhashTransactionOffer?)

    /**
     * The token [options] buy [product] with: [com.voidhash.sdk.billing.GooglePlayPurchaseOptions.offerToken]
     * as given, or the token of the offer selected among the product's offers and introductory offer —
     * by default the introductory one when there is one — or else of the regular price: the base plan,
     * or a one-time product's first purchase option. Throws `OFFER_UNAVAILABLE` for an offer the product
     * does not have.
     *
     * A plan change ([VoidhashPurchaseOptions.replacing]) applies the introductory offer by default
     * only when it is tagged `voidhash-intro`: one picked for its free trial may be an offer meant for
     * new customers only, which Google Play returns to every user and would grant to a subscriber.
     */
    private fun offerTokenFor(product: VoidhashProduct, options: VoidhashPurchaseOptions, schema: RuntimeSchema): OfferChoice {
        val googlePlay = product.googlePlay
        val introOffer = product.subscription?.introOffer
        val offers = listOfNotNull(introOffer) + product.offers
        // The Play offer id behind an offer the schema names by its own id.
        val studioOffers = schema.products[product.slug]?.providers?.googlePlay?.offers.orEmpty().associate { it.id to it.offerId }
        // The purchase option a one-time product is priced by, whose offers are the product's.
        val baseOption = googlePlay?.oneTimeOffers?.let { options -> options.firstOrNull { it.offerId == null } ?: options.firstOrNull() }
        fun subscriptionOfferOf(offer: VoidhashOffer) = googlePlay?.subscriptionOffers
            ?.firstOrNull { it.basePlanId == googlePlay.basePlanId && it.offerId == (studioOffers[offer.id] ?: offer.id) }
        fun tokenOf(offer: VoidhashOffer): String? {
            val playOfferId = studioOffers[offer.id] ?: offer.id
            return if (offer.kind == VoidhashOfferKind.ONE_TIME) {
                googlePlay?.oneTimeOffers
                    ?.firstOrNull { it.offerId == playOfferId && isOnPurchaseOption(it.purchaseOptionId, baseOption?.purchaseOptionId) }
                    ?.offerToken
            } else {
                subscriptionOfferOf(offer)?.offerToken
            }
        }
        fun chosen(offer: VoidhashOffer) =
            OfferChoice(tokenOf(offer), VoidhashTransactionOffer(offer.id, offer.kind, offer.phases.firstOrNull()?.paymentMode))
        val regular = OfferChoice(
            if (product.type == VoidhashProductType.SUBSCRIPTION) {
                googlePlay?.subscriptionOffers?.firstOrNull { it.basePlanId == googlePlay.basePlanId && it.offerId == null }?.offerToken
            } else {
                baseOption?.offerToken
            },
            null,
        )

        options.googlePlay?.offerToken?.let { token ->
            val known = offers.firstOrNull { tokenOf(it) == token }
            if (known != null) return chosen(known)
            val raw = googlePlay?.subscriptionOffers?.firstOrNull { it.offerToken == token }?.offerId
                ?: googlePlay?.oneTimeOffers?.firstOrNull { it.offerToken == token }?.offerId
            return OfferChoice(token, raw?.let { VoidhashTransactionOffer(it, null, null) })
        }
        val selected = when (val selection = options.offer) {
            VoidhashOfferSelection.Automatic -> introOffer
                ?.takeIf { options.replacing == null || subscriptionOfferOf(it)?.offerTags?.contains(INTRO_OFFER_TAG) == true }
                ?: return regular
            VoidhashOfferSelection.None -> return regular
            is VoidhashOfferSelection.Offer ->
                offers.firstOrNull { it.id == selection.offer.id && it.kind == selection.offer.kind }
                    ?: throw offerUnavailable(product, selection.offer.id)
            is VoidhashOfferSelection.Id -> offers.firstOrNull { it.id == selection.id } ?: throw offerUnavailable(product, selection.id)
        }
        val choice = chosen(selected)
        if (choice.token == null) throw offerUnavailable(product, selected.id)
        return choice
    }

    private fun offerUnavailable(product: VoidhashProduct, offerId: String) = VoidhashException(
        "OFFER_UNAVAILABLE",
        "Offer \"$offerId\" of product \"${product.slug}\" is not available: Google Play does not offer it " +
            "to this user, or the product has no such offer",
    )

    /**
     * Scans the store after Google Play refused a buy because the user owns the product, then
     * refreshes the person. On [syncScope] when there is one, so the refusal reaches the caller at
     * once; a failed scan is reported and left to the next one.
     */
    private suspend fun reconcileAlreadyOwned(schema: RuntimeSchema) {
        val scan: suspend () -> Unit = {
            try {
                reconcileObservedTransactions(schema)
                refreshPerson("a purchase Google Play already had")
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                onWarning("Failed to reconcile the store after an already owned product: ${error.message}")
            }
        }
        val scope = syncScope
        if (scope == null || !scope.isActive) scan() else scope.launch { scan() }
    }

    /**
     * The purchase Google Play holds now for the subscription [replacing] names, which a
     * purchase of [product] replaces. Throws before anything is launched or marked, so nothing is
     * bought: `INVALID_ARGUMENT` unless both are subscriptions and different products, or for a mode
     * Google Play does not accept for the plans (see [requireReplacementModeAccepted]), and
     * `REPLACED_SUBSCRIPTION_NOT_OWNED` unless Play lists a paid purchase of the replaced one for
     * the signed-in account. A store that cannot be read fails as it does for a scan.
     *
     * `null` in development mode: the mock store holds no subscriptions to replace, and simulates
     * the purchase as any other.
     */
    private suspend fun replacedPurchase(product: VoidhashProduct, replacing: SubscriptionReplacement): ReplacedPurchase? {
        val replaced = replacing.product
        if (product.type != VoidhashProductType.SUBSCRIPTION || replaced.type != VoidhashProductType.SUBSCRIPTION) {
            throw VoidhashException(
                "INVALID_ARGUMENT",
                "Only a subscription can replace a subscription: \"${product.slug}\" cannot replace \"${replaced.slug}\"",
            )
        }
        if (replaced.slug == product.slug) {
            throw VoidhashException("INVALID_ARGUMENT", "A purchase of \"${product.slug}\" cannot replace the same product")
        }
        if (developmentMode) return null
        requireReplacementModeAccepted(product, replacing)
        val owned = billing.getAvailableItemsByType(BillingProductType.SUBS).firstOrNull { purchase ->
            replaced.storeProductId in purchase.ids && mapBillingPurchaseToTransaction(purchase).purchaseState == "purchased"
        }
        owned ?: throw VoidhashException(
            "REPLACED_SUBSCRIPTION_NOT_OWNED",
            "The Google Play account does not own the subscription \"${replaced.slug}\" this purchase was to replace",
        )
        return ReplacedPurchase(owned.purchaseToken, owned.obfuscatedAccountId?.takeIf { it.isNotEmpty() })
    }

    /**
     * Throws `INVALID_ARGUMENT` for a replacement mode Google Play refuses for these plans, where it
     * would fail the purchase with an error on its own sheet: a purchase of a prepaid plan replaces a
     * subscription only with `CHARGE_FULL_PRICE`, and a switch to an auto-renewing base plan of the
     * same subscription, from a prepaid or an auto-renewing one, only with `CHARGE_FULL_PRICE` or
     * `WITHOUT_PRORATION`.
     */
    private fun requireReplacementModeAccepted(product: VoidhashProduct, replacing: SubscriptionReplacement) {
        val mode = replacing.mode
        if (product.isPrepaidPlan && mode != SubscriptionReplacementMode.CHARGE_FULL_PRICE) {
            throw VoidhashException(
                "INVALID_ARGUMENT",
                "Google Play replaces a subscription with the prepaid plan \"${product.slug}\" only with " +
                    "CHARGE_FULL_PRICE, not $mode",
            )
        }
        val sameSubscription = product.storeProductId == replacing.product.storeProductId
        if (sameSubscription && mode != SubscriptionReplacementMode.CHARGE_FULL_PRICE && mode != SubscriptionReplacementMode.WITHOUT_PRORATION) {
            throw VoidhashException(
                "INVALID_ARGUMENT",
                "Google Play switches between the base plans \"${replacing.product.slug}\" and \"${product.slug}\" " +
                    "of one subscription only with CHARGE_FULL_PRICE or WITHOUT_PRORATION, not $mode",
            )
        }
    }

    /**
     * The launch marker of one product, written as a sheet opens (see [SDK_LAUNCHED_PRODUCT_KEY_PREFIX]).
     *
     * An earlier sheet's launch may still stand in for a purchase no scan has seen yet, so an attempt
     * that buys nothing puts the marker back as it found it ([restore]). A launch under another
     * account token, a sheet another user of the app opened, is no retry of this one: it stays in
     * the marker next to this launch, whatever becomes of this attempt ([answered]).
     */
    private inner class LaunchMarker(
        private val key: String,
        private val earlier: CacheHit<JSONObject>?,
        private val others: List<JSONObject>,
    ) {
        /** Puts the marker back as this attempt found it. */
        fun restore() {
            if (earlier == null) {
                cacheManager.delete(key)
            } else {
                cacheManager.setWithDeadlines(key, earlier.value, staleAt = null, expiresAt = earlier.expiresAt)
            }
        }

        /** Takes this launch out once its purchase is marked by its token; the other users' launches stay. */
        fun answered() {
            if (earlier == null || others.isEmpty()) {
                cacheManager.delete(key)
            } else {
                cacheManager.setWithDeadlines(
                    key,
                    JSONObject(others.first().toString()).apply {
                        if (others.size > 1) put(EARLIER_LAUNCHES_FIELD, JSONArray(others.drop(1)))
                    },
                    staleAt = null,
                    expiresAt = earlier.expiresAt,
                )
            }
        }
    }

    /**
     * Writes [launch], a sheet opened under [accountToken], to the launch marker of [productId],
     * next to the unanswered launches of other account tokens it holds.
     */
    private fun writeLaunchMarker(productId: String, launch: JSONObject, accountToken: String): LaunchMarker {
        val key = SDK_STARTED_PURCHASE_KEY_PREFIX + SDK_LAUNCHED_PRODUCT_KEY_PREFIX + productId
        val earlier = cacheManager.getObject(key)?.takeUnless { it.isExpired }
        val others = earlier?.value?.let(::launchesOf).orEmpty()
            .filterNot { it.optString("accountToken").equals(accountToken, ignoreCase = true) }
            .take(MAX_OTHER_LAUNCHES)
        cacheManager.set(
            key,
            JSONObject(launch.toString()).apply { if (others.isNotEmpty()) put(EARLIER_LAUNCHES_FIELD, JSONArray(others)) },
            ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
        )
        return LaunchMarker(key, earlier, others)
    }

    /** What [buy] bought, with what [complete] needs of the purchase's start. */
    private class Bought(val transaction: StoreTransaction, val readOnlyAtPurchaseStart: Boolean, val distinctId: String)

    /**
     * Launches the store's sheet for [product] with [offerToken] and returns what it bought, marked
     * as this SDK's own; `null` when the user cancelled it. A pending purchase is returned as it is.
     */
    private suspend fun buy(
        product: VoidhashProduct,
        schema: RuntimeSchema,
        options: VoidhashPurchaseOptions,
        offerToken: String?,
        paywallContext: PurchasePaywallContext?,
    ): Bought? {
        val replacing = options.replacing
        // Pinned at purchase start: a purchase this SDK owns must still be
        // finished with the store even if the app flips to observer mode while
        // the store sheet is open.
        val readOnlyAtPurchaseStart = readOnlyProvider()
        val distinctId = identityStore.getDistinctId()
        cacheManager.set("transaction-identity:${AccountToken.derive(distinctId)}", distinctId)

        val type = if (product.type == VoidhashProductType.SUBSCRIPTION) BillingProductType.SUBS else BillingProductType.INAPP
        val replaced = replacing?.let { replacedPurchase(product, it) }
        val replacedToken = replaced?.token

        // The products the purchase this sheet makes may report: a deferred replacement's is
        // reported with the replaced product until the change takes effect, so it is known by
        // that product's marker too.
        val reportedProductIds = listOfNotNull(
            product.storeProductId,
            replacing?.product?.storeProductId?.takeIf { replacedToken != null && replacing.mode == SubscriptionReplacementMode.DEFERRED },
        ).distinct()
        val ownAccountToken = AccountToken.derive(distinctId)
        // Google Play refuses a replacement whose account id differs from the one on the
        // subscription it replaces, as it does for a person who subscribed before signing in. Such
        // a replacement is launched without one: Play then gives the new purchase the replaced
        // purchase's account id, or none, and the purchase is tied to its buyer here instead.
        val inheritsAccountToken = replaced != null && !replaced.accountToken.equals(ownAccountToken, ignoreCase = true)
        // What the purchase this sheet makes will carry, by which a scan knows it.
        val accountToken = if (inheritsAccountToken) replaced?.accountToken else ownAccountToken
        val launch = JSONObject()
            .put("launchedAt", System.currentTimeMillis())
            .put("accountToken", accountToken ?: ownAccountToken)
            .apply { if (inheritsAccountToken) put("distinctId", distinctId) }
            .apply { if (accountToken == null) put(NO_ACCOUNT_TOKEN_FIELD, true) }
            .apply { if (replacedToken != null) put("replaces", replacedToken) }
            .apply { if (paywallContext != null) put("paywallContext", paywallContext.toJson()) }
        val markers = reportedProductIds.map { productId -> writeLaunchMarker(productId, launch, accountToken ?: ownAccountToken) }
        // Play announces a purchase to the observer before the buy that made it gets its answer.
        // One that will carry no account id has nothing else to be known by until it is marked.
        if (accountToken == null) reportedProductIds.forEach { sheetsWithoutAccountToken[it] = launch }
        val buyParams = BillingBuyItemParams(
            type = type,
            productId = product.storeProductId,
            offerToken = offerToken,
            replacement = replacedToken?.let { token ->
                BillingSubscriptionReplacement(token, replacing.product.storeProductId, replacing.mode.billingMode)
            },
            obfuscatedAccountId = ownAccountToken.takeUnless { inheritsAccountToken },
            obfuscatedProfileId = options.googlePlay?.obfuscatedProfileId,
            isOfferPersonalized = options.googlePlay?.isOfferPersonalized ?: false,
            // This SDK finishes what it buys, so the store records the purchase as unfinished
            // until it does, and acknowledges it on the device before Google Play would refund it.
            recordUnfinished = !developmentMode,
        )
        val transaction = try {
            val purchases = try {
                billing.buyItemByType(buyParams)
            } catch (error: VoidhashException) {
                // Play answered that nothing was bought, unless the failure leaves that open: the
                // marker is left as this attempt found it.
                if (error.code !in LAUNCH_OUTCOME_UNKNOWN_CODES) markers.forEach { it.restore() }
                // The user has the product, perhaps from a sheet whose answer never reached the SDK:
                // what the SDK owns of it is delivered and finished, so a consumable can be bought again.
                if (error.code == "ITEM_ALREADY_OWNED" && !developmentMode) reconcileAlreadyOwned(schema)
                // The user closed the sheet: an outcome, not a failure.
                if (error.code == "USER_CANCELLED") return null
                // Play's answer to a replacement it will not make, with the reason in its message;
                // the sheet never opened.
                if (replaced != null && (error.cause as? BillingEngineException)?.responseCode == DEVELOPER_ERROR) {
                    throw VoidhashException(
                        "SUBSCRIPTION_REPLACEMENT_REFUSED",
                        "Google Play refused to replace the subscription \"${replacing.product.slug}\" with " +
                            "\"${product.slug}\": ${error.description}",
                        error,
                    )
                }
                throw error
            }

            // Play's answer may carry other purchases, the one replaced among them: the one bought is
            // the one the engine took for its answer.
            val purchase = buyParams.answeringPurchase(purchases)
                ?: throw VoidhashException("PURCHASE_FAILED", "No purchase returned from Google Billing")

            val bought = if (developmentMode) {
                mapDevelopmentPurchaseToTransaction(
                    productId = product.storeProductId,
                    devTransactionId = purchase.orderId ?: purchase.purchaseToken,
                    purchaseDate = purchase.purchaseTime,
                    quantity = 1,
                    productSlug = product.slug,
                )
            } else {
                // A deferred replacement keeps the replaced product until the subscription renews.
                val billed = if (replacedToken != null && replacing.mode == SubscriptionReplacementMode.DEFERRED) {
                    replacing.product
                } else {
                    product
                }
                mapBillingPurchaseToTransaction(purchase).copy(productSlug = billed.slug)
            }
            // Remembered before the purchase can stay pending or its sync fail: whenever Google Play
            // reports it as purchased, even after a relaunch, it is this SDK's to sync and finish. The
            // token marks it now, so the launch marker has nothing left to stand in for.
            cacheManager.set(
                SDK_STARTED_PURCHASE_KEY_PREFIX + bought.processingKey,
                true,
                ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
            )
            if (paywallContext != null) {
                cacheManager.set(
                    PURCHASE_PAYWALL_KEY_PREFIX + bought.processingKey,
                    paywallContext.toJson().toString(),
                    ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
                )
            }
            if (inheritsAccountToken) {
                cacheManager.set(
                    PURCHASE_IDENTITY_KEY_PREFIX + bought.processingKey,
                    distinctId,
                    ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
                )
            }
            bought
        } finally {
            reportedProductIds.forEach { sheetsWithoutAccountToken.remove(it) }
        }
        markers.forEach { it.answered() }
        if (transaction.purchaseState != "purchased" && transaction.purchaseState != "pending") {
            throw VoidhashException("PURCHASE_UNKNOWN_RESULT", "Google Billing returned an unknown state")
        }
        return Bought(transaction, readOnlyAtPurchaseStart, distinctId)
    }

    /**
     * Syncs [transaction], which [purchase] bought, finishes it with the store and refreshes the
     * person, waiting at most [PURCHASE_WAIT_MS]; returns whether Voidhash accepted the receipt by
     * then. Whatever is left carries on.
     */
    private suspend fun complete(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        readOnlyAtPurchaseStart: Boolean,
        distinctId: String,
        paywallContext: PurchasePaywallContext?,
    ): Boolean {

        // Syncing, finishing with the store and refreshing the person run on [syncScope], so the
        // purchase returns after PURCHASE_WAIT_MS whatever they wait on — the request itself,
        // or the purchase observer's run of the same transaction, which Play starts first.
        //
        // The caller is answered once Voidhash's verdict is in and, for an accepted receipt, the
        // person is refreshed: the store finish starts with the refresh and is not waited for,
        // as Google Play may take its whole timeout to acknowledge.
        val accepted = CompletableDeferred<Boolean>()
        val knownAccepted = AtomicBoolean(false)
        val answered = CompletableDeferred<Boolean>()
        val completion: suspend () -> Boolean = {
            coroutineScope {
                launch {
                    val isAccepted = accepted.await()
                    knownAccepted.set(isAccepted)
                    if (isAccepted) refreshPerson("a purchase")
                    answered.complete(isAccepted)
                }
                val run = try {
                    runOrJoinTransaction(
                        transaction, schema, readOnlyAtPurchaseStart, distinctId,
                        onAccepted = { accepted.complete(true) },
                    )
                } catch (error: Throwable) {
                    accepted.completeExceptionally(error)
                    throw error
                }
                accepted.complete(run.accepted)
                // Paid and recorded by Voidhash: the purchase succeeded whatever the store answered
                // to finishing it. The next scan finishes it without syncing again, and the
                // background purchase check acknowledges it before Google Play would refund it.
                run.finishFailure?.let { failure ->
                    onWarning(
                        "Voidhash accepted purchase ${redacted(transaction.transactionId)}, but finishing it " +
                            "with Google Play failed and is retried: ${failure.message}",
                    )
                }
                run.accepted
            }
        }
        val scope = syncScope
        if (scope == null || !scope.isActive) return completion()
        // Queued here, on the caller's coroutine, before anything is handed to [scope]: should the
        // client be released while the sheet was open, work handed off would never start, and the
        // receipt is the only record that the user paid.
        // Queued as the buyer's claim, even when the purchase observer's run of it already had it
        // accepted as a `sync`; one claimed already is not queued again.
        if (!transaction.isDevelopment && outbox != null && claimsPurchase(transaction)) {
            outbox.enqueue(
                transaction.processingKey,
                distinctId,
                syncRequest(transaction, schema, SYNC_TRANSACTION_INTENT_PURCHASE)
                    .copy(isStartedBySdk = true, paywallContext = paywallContext),
            )
        }
        val callerWaiting = AtomicBoolean(true)
        scope.async {
            try {
                completion()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                // A caller still waiting gets the failure itself.
                if (!callerWaiting.get()) {
                    onWarning("Failed to complete purchase ${redacted(transaction.transactionId)}: ${error.message}")
                }
                throw error
            }
        }.invokeOnCompletion { cause ->
            // A completion that failed, or went away with the client's scope, answers the caller too.
            if (cause != null) answered.completeExceptionally(cause)
        }
        val answeredInTime = answered.awaitWithin(PURCHASE_WAIT_MS)
        if (answeredInTime != null) return answeredInTime
        callerWaiting.set(false)
        // What the device holds predates the purchase until the refresh still running lands.
        cacheManager.markStale("person:$distinctId")
        val isAccepted = knownAccepted.get()
        onWarning(
            if (isAccepted) {
                "Returned purchase ${redacted(transaction.transactionId)}, which Voidhash accepted, before the " +
                    "person was refreshed"
            } else {
                "Returned purchase ${redacted(transaction.transactionId)} before Voidhash confirmed it; " +
                    "its receipt stays queued and the purchase is finished once it is accepted"
            },
        )
        return isAccepted
    }

    /**
     * Revalidates owned purchases for the requesting identity, as `restore` submissions the
     * project's paid access sharing setting applies to; deferred or refused delivery fails the restore.
     *
     * Google Play is asked for the purchases on the caller, so a store that cannot be read fails
     * the restore itself, however long it takes to say so. Delivering them then waits at most
     * [PURCHASE_WAIT_MS], like a purchase (see [awaitScan]): a restore still running then fails
     * like a deferred one, with `RECONCILE_TRANSACTIONS_FAILED`, and carries on. Every receipt the
     * store listed is queued as a restore before the call waits for anything, also when it then
     * waits for a restore that was running already.
     */
    @JvmOverloads
    suspend fun restorePurchases(
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean = false,
        distinctId: String = identityStore.getDistinctId(),
    ) {
        val owned = ownedTransactions()
        val listed = stageOwned(owned, schema, deferStoreFinalization, distinctId)
        val finished = awaitScan("restore:$distinctId", listed) {
            restoreMutex.withLock {
                deliverOwned(owned, schema, deferStoreFinalization, distinctId)
                refreshPerson("a restore")
            }
        }
        if (!finished) {
            throw VoidhashException(
                "RECONCILE_TRANSACTIONS_FAILED",
                "Voidhash did not answer the restore within ${PURCHASE_WAIT_MS / 1000} s; it carries on, and " +
                    "the receipts it queues are delivered once Voidhash can be reached",
            )
        }
    }

    /** A scan [awaitScan] started, the receipts it delivers, and how many callers wait for it. */
    private class RunningScan(val work: Deferred<Unit>, val keys: Set<String>, val waiting: AtomicInteger)

    /** The scans that may still run, by key. */
    private val scans = HashMap<String, RunningScan>()

    /**
     * Runs [scan], the delivery of the purchases Google Play listed, on [syncScope] and waits for
     * it at most [PURCHASE_WAIT_MS], as a purchase waits for what follows its sheet: a backend that
     * does not answer holds each request for its full timeout, one owned purchase after the other.
     * The scan carries on past the wait. A call made while a scan of the same [key] still runs
     * waits for that one instead of starting another behind it, as long as that scan delivers
     * every receipt of [listed], what this call's own caller listed. One that lists a receipt the
     * running scan does not know, a purchase made since, runs its own delivery once that scan is
     * done, so no call answers for a receipt nobody delivered. Returns whether the scan finished;
     * its failure is thrown. Without a live scope the scan runs on the caller.
     */
    private suspend fun awaitScan(key: String, listed: Set<String>, scan: suspend () -> Unit): Boolean {
        val scope = syncScope
        if (scope == null || !scope.isActive) {
            scan()
            return true
        }
        val running = synchronized(scans) {
            val current = scans[key]?.takeUnless { it.work.isCompleted }
            current?.takeIf { it.keys.containsAll(listed) }?.also { it.waiting.incrementAndGet() } ?: run {
                val waiting = AtomicInteger(1)
                // Started outside the lock: an undispatched scope would run the scan under it.
                val work = scope.async(start = CoroutineStart.LAZY) {
                    // One delivery at a time: behind the scan that lacks what this one lists.
                    current?.work?.join()
                    try {
                        scan()
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: Throwable) {
                        // A caller still waiting gets the failure itself.
                        if (waiting.get() == 0) onWarning("Delivering the store's purchases failed: ${error.message}")
                        throw error
                    }
                }
                RunningScan(work, listed, waiting).also { scans[key] = it }
            }
        }
        running.work.invokeOnCompletion { synchronized(scans) { if (scans[key] === running) scans.remove(key) } }
        running.work.start()
        try {
            return running.work.awaitWithin(PURCHASE_WAIT_MS) != null
        } finally {
            running.waiting.decrementAndGet()
        }
    }

    /**
     * Forgets the identity recorded for a receipt once nothing reads it any more: the record has
     * expired, or the outbox no longer holds the receipt and Voidhash accepted it, so the
     * outbox's accepted receipts remember its owner. Left alone, one would stay for every receipt
     * ever restored.
     *
     * A record that is neither stays until it expires. The React Native host writes one, while
     * importing what its earlier releases stored, for a purchase Voidhash has not accepted: no
     * receipt is queued for it yet, and the next store scan reads the record to report the
     * purchase for its owner.
     */
    internal suspend fun forgetSettledRestores() {
        val outbox = outbox ?: return
        outbox.awaitRestored()
        val queued = outbox.pendingRecords.mapTo(HashSet()) { it.key }
        for (key in cacheManager.getCacheKeys()) {
            if (!key.startsWith(RESTORED_TRANSACTION_IDENTITY_KEY_PREFIX)) continue
            val receipt = key.removePrefix(RESTORED_TRANSACTION_IDENTITY_KEY_PREFIX)
            val expired = cacheManager.get(key)?.isExpired != false
            if (expired || receipt !in queued && outbox.acceptedReceipts.find(receipt) != null) {
                cacheManager.delete(key)
            }
        }
    }

    /**
     * Silently reconciles owned purchases, retaining deferred deliveries for retry. Google Play is
     * asked for the purchases on the caller, which a store that cannot be read fails; delivering
     * them is waited for at most [PURCHASE_WAIT_MS] (see [awaitScan]) and carries on past that.
     * Every receipt the store listed is in the outbox before the call waits for anything, so it
     * is on disk when the call returns, whatever scan the call ended up waiting for: a host may
     * consume a purchase as soon as its sync returned.
     */
    suspend fun syncPurchases(schema: RuntimeSchema, deferStoreFinalization: Boolean = false) {
        val owned = ownedTransactions()
        val listed = stageOwned(owned, schema, deferStoreFinalization)
        awaitScan(if (deferStoreFinalization) "sync:deferred" else "sync", listed) {
            deliverOwned(owned, schema, deferStoreFinalization)
            refreshPerson("a sync")
        }
    }

    /**
     * Processes every transaction the store still reports. One-time consumables
     * are captured without finalization in observer mode and skipped in owner mode, since another
     * billing integration may still have to consume them; a purchase this SDK started is synced
     * and finished in either mode instead, consumables included, and is recorded as unfinished
     * with the store first if nothing acknowledged it yet, a pending one too. When
     * [deferStoreFinalization] is true, no schema can classify the products yet: receipts are
     * synced but left unfinished, and in owner mode a purchase this SDK did not start is left to
     * the scan a schema's arrival runs, as it may be such a consumable.
     */
    suspend fun reconcileObservedTransactions(
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean = false,
        restoreDistinctId: String? = null,
    ) {
        deliverOwned(ownedTransactions(), schema, deferStoreFinalization, restoreDistinctId)
    }

    /**
     * Asks the store for the purchases it still reports, and records the ones this SDK started
     * that nothing acknowledged yet as unfinished. Throws when the store cannot be read.
     */
    private suspend fun ownedTransactions(): Collection<StoreTransaction> {
        val purchases = billing.getAvailableItemsByType(BillingProductType.INAPP) +
            billing.getAvailableItemsByType(BillingProductType.SUBS)

        val observedByKey = linkedMapOf<String, StoreTransaction>()
        // A suspended subscription grants nothing: never delivered, acknowledged or consumed.
        for (purchase in purchases.filterNot { it.isSuspended }) {
            val transaction = mapBillingPurchaseToTransaction(purchase)
            observedByKey[transaction.processingKey] = transaction
        }
        // First, as it marks purchases as this SDK's own, which what follows goes by.
        claimLostReplacements(observedByKey.values)
        val startedBySdk = purchases.filter { purchase ->
            !purchase.isAcknowledged && !purchase.isSuspended && isStartedBySdk(mapBillingPurchaseToTransaction(purchase))
        }
        outbox?.acceptedReceipts?.prune(observedByKey.keys)
        // Before anything is sent: a buy records what it bought from Play's answer, which a process
        // that died with the sheet open never got. Without the record nothing would acknowledge
        // such a purchase while Voidhash stays unreachable, and Google Play would refund it.
        if (startedBySdk.isNotEmpty()) billing.recordUnfinished(startedBySdk)
        return observedByKey.values
    }

    /**
     * Whether a scan delivers [transaction], one of the purchases the store listed; the rule of
     * [reconcileObservedTransactions].
     */
    private fun scanDelivers(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean,
        restoreDistinctId: String?,
    ): Boolean {
        if (transaction.purchaseState != "purchased") return false
        val isConsumable = resolveProductDefinition(transaction, schema)?.type == "one-time-consumable"
        val isStartedBySdk = isStartedBySdk(transaction)
        if (isConsumable && (restoreDistinctId != null || (!readOnlyProvider() && !isStartedBySdk))) return false
        // Unclassified, it may be a consumable the rule above leaves alone.
        return !(deferStoreFinalization && restoreDistinctId == null && !readOnlyProvider() && !isStartedBySdk)
    }

    /**
     * Writes the receipts of [owned] that a scan delivers to the outbox, on the caller, before the
     * call waits for a scan or joins one that is running: whatever becomes of that scan, every
     * receipt the call listed is on disk before the call can return, so a host that consumes a
     * purchase right after syncing it cannot lose it. A receipt Voidhash already accepted is not
     * queued again, unless [restoreDistinctId] asks for it as a restore, which the queued record
     * keeps, or it is this SDK's purchase still to be claimed (see [claimsPurchase]). Returns the
     * keys of the receipts a scan of [owned] delivers.
     */
    private suspend fun stageOwned(
        owned: Collection<StoreTransaction>,
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean,
        restoreDistinctId: String? = null,
    ): Set<String> {
        val listed = LinkedHashSet<String>()
        for (transaction in owned) {
            if (!scanDelivers(transaction, schema, deferStoreFinalization, restoreDistinctId)) continue
            val processingKey = transaction.processingKey
            listed += processingKey
            val outbox = outbox ?: continue
            if (transaction.isDevelopment || transaction.purchaseToken.isNullOrEmpty()) continue
            val claim = restoreDistinctId == null && claimsPurchase(transaction)
            if (restoreDistinctId == null && !claim) {
                val accepted = readProcessedState(PROCESSED_TRANSACTION_KEY_PREFIX + processingKey)?.backendAccepted == true ||
                    outbox.acceptedReceipts.find(processingKey)?.covers(transaction) == true
                if (accepted) continue
            }
            outbox.enqueue(
                processingKey,
                restoreDistinctId ?: ownerOf(transaction),
                syncRequest(
                    transaction,
                    schema,
                    when {
                        restoreDistinctId != null -> SYNC_TRANSACTION_INTENT_RESTORE
                        claim -> SYNC_TRANSACTION_INTENT_PURCHASE
                        else -> SYNC_TRANSACTION_INTENT_SYNC
                    },
                ).copy(
                    isStartedBySdk = isStartedBySdk(transaction),
                    paywallContext = if (restoreDistinctId == null) purchasePaywall(transaction) else null,
                ),
                restoreDistinctId,
            )
        }
        return listed
    }

    /**
     * The identity an observed purchase is reported for: the owner a restore asked for, then the
     * one Voidhash accepted the receipt for, then the one that opened its sheet — remembered for
     * the purchase itself when its account id is another identity's (see [buyerOf]), and read
     * from its account id otherwise — and only then the current identity.
     */
    private suspend fun ownerOf(transaction: StoreTransaction): String =
        cacheManager.getString(RESTORED_TRANSACTION_IDENTITY_KEY_PREFIX + transaction.processingKey)
            ?.takeUnless { it.isExpired }?.value
            ?: outbox?.acceptedReceipts?.find(transaction.processingKey)?.distinctId
            ?: buyerOf(transaction)
            ?: transaction.appAccountToken?.let {
                cacheManager.getString("transaction-identity:${it.lowercase()}")?.value
            }
            ?: identityStore.getDistinctId()

    /** Syncs and finishes [owned], what [ownedTransactions] listed; see [reconcileObservedTransactions]. */
    private suspend fun deliverOwned(
        owned: Collection<StoreTransaction>,
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean,
        restoreDistinctId: String? = null,
    ) {
        val failures = mutableListOf<String>()
        val handled = mutableListOf<Pair<StoreTransaction, Boolean>>()
        for (transaction in owned) {
            if (!scanDelivers(transaction, schema, deferStoreFinalization, restoreDistinctId)) continue
            val isConsumable = resolveProductDefinition(transaction, schema)?.type == "one-time-consumable"
            val isStartedBySdk = isStartedBySdk(transaction)
            val acceptedBefore = restoreDistinctId != null || isAccepted(transaction)
            try {
                val accepted = processTransaction(
                    transaction,
                    schema,
                    when {
                        isStartedBySdk -> false
                        isConsumable -> true
                        else -> null
                    },
                    restoreDistinctId,
                    restoring = restoreDistinctId != null,
                    deferStoreFinalization = deferStoreFinalization,
                )
                if (restoreDistinctId != null && !accepted) failures.add(transaction.transactionId)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                failures.add(transaction.transactionId)
                onWarning("Failed to process observed transaction ${redacted(transaction.transactionId)}: ${error.message}")
            }
            handled += transaction to acceptedBefore
        }
        announce(handled, schema)

        if (failures.isNotEmpty()) {
            throw VoidhashException(
                "RECONCILE_TRANSACTIONS_FAILED",
                "Failed to restore ${failures.size} transactions",
            )
        }
    }

    /**
     * Processes one observed transaction and refreshes the person snapshot.
     * [deferStoreFinalization] records and syncs the receipt without finishing
     * it in the store until product metadata is available. [restoreDistinctId] sends it as an
     * explicit restore for that identity, as [restorePurchases] does. A purchase this SDK started,
     * such as a pending payment that just cleared, is finished in either mode; one the host
     * reported ([StoreTransaction.externallyManaged]) is never finished here. Any other
     * consumable, and with [deferStoreFinalization] any other purchase, is treated as a scan treats
     * it: captured without finalization in observer mode, skipped in owner mode. Throws when the
     * store has to be asked whose purchase it is (see [claimLostReplacements]) and cannot be read;
     * the purchase is then left to the next scan.
     */
    suspend fun processObservedTransaction(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean = false,
        restoreDistinctId: String? = null,
    ) {
        // A suspended subscription grants nothing: never delivered, acknowledged or consumed.
        if (transaction.isSuspended) return
        // Announced without an account id while a replacement's launch for the product is still
        // unanswered, as a slow payment that completes while the app runs is: whether it is that
        // launch's purchase shows in what the store lists now, which a store that cannot be read
        // leaves to the next scan.
        if (transaction.appAccountToken.isNullOrEmpty() && awaitsLostReplacement(transaction.productId) &&
            !sheetsWithoutAccountToken.containsKey(transaction.productId)
        ) {
            claimLostReplacements(
                billing.getAvailableItemsByType(BillingProductType.SUBS).map(::mapBillingPurchaseToTransaction),
            )
        }
        val isStartedBySdk = isStartedBySdk(transaction)
        val isConsumable = !transaction.externallyManaged &&
            resolveProductDefinition(transaction, schema)?.type == "one-time-consumable"
        // The rule of a scan (see [reconcileObservedTransactions]): in owner mode a consumable this
        // SDK did not start is left alone, as another billing integration may still have to grant
        // and consume it — and so is a purchase no schema can classify yet, which the scan a
        // schema's arrival runs picks up.
        val unclassified = deferStoreFinalization && !transaction.externallyManaged
        if ((isConsumable || unclassified) && !isStartedBySdk && !readOnlyProvider()) return
        val acceptedBefore = restoreDistinctId != null || isAccepted(transaction)
        val run = try {
            runOrJoinTransaction(
                transaction,
                schema,
                when {
                    // Reported by the host, which keeps the finish.
                    transaction.externallyManaged -> true
                    isStartedBySdk -> false
                    isConsumable -> true
                    else -> null
                },
                distinctIdOverride = restoreDistinctId,
                restoring = restoreDistinctId != null,
                deferStoreFinalization = deferStoreFinalization,
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            announce(listOf(transaction to acceptedBefore), schema)
            throw error
        }
        // Voidhash has the purchase even when finishing it with the store failed, so the person
        // the device holds predates it either way. Refreshed before an update announces it.
        if (run.accepted) refreshPerson("an observed transaction")
        // Announced as already refreshed: no second refresh for it.
        announce(listOf(transaction to acceptedBefore), schema, refreshed = run.accepted)
        run.finishFailure?.let { throw it }
    }

    /**
     * Persists a host-owned receipt before it is delivered in the background.
     * This never talks to Billing or the backend, and leaves acknowledgment and
     * consumption with the host app.
     *
     * Without [restoreDistinctId] the receipt is staged as a `purchase` claim, also when Voidhash
     * accepted it before as a `sync`. A purchase this device claimed already is not staged again.
     * [restoreDistinctId] stages it as an explicit restore for that identity instead. Returns
     * `false` only when the receipt could not be written to storage and is held in memory alone.
     */
    suspend fun stageReportedTransaction(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        restoreDistinctId: String? = null,
    ): Boolean {
        val capturedDistinctId = identityStore.getDistinctId()
        val processingKey = transaction.processingKey
        val processedCacheKey = PROCESSED_TRANSACTION_KEY_PREFIX + processingKey
        val accepted = outbox?.acceptedReceipts?.find(processingKey)
        if (restoreDistinctId == null && !claimsPurchase(transaction)) return true
        val distinctId = outbox?.capturedDistinctId(processingKey)
            ?: restoreDistinctId ?: accepted?.distinctId ?: capturedDistinctId
        val intent = if (restoreDistinctId != null) SYNC_TRANSACTION_INTENT_RESTORE else SYNC_TRANSACTION_INTENT_PURCHASE
        val durable = outbox?.enqueue(
            processingKey, distinctId, syncRequest(transaction, schema, intent), restoreDistinctId,
        )?.durable ?: true
        writeProcessedState(
            processedCacheKey,
            backendAccepted = false,
            // A claim of a purchase Voidhash accepted before may follow its store finish.
            storeFinalized = readProcessedState(processedCacheKey)?.storeFinalized == true,
            externallyManaged = true,
        )
        inFlightMutex.withLock { inFlightTransactions[processingKey]?.hostClaimed = true }
        return durable
    }

    /**
     * Syncs [transaction] to the backend and — unless the SDK is in observer
     * mode — finishes it with the store.
     *
     * [readOnlyOverride] pins the ownership decision for a purchase this SDK
     * started; every other caller passes `null` and reads the live flag at the
     * moment the decision is made.
     *
     * [distinctIdOverride] pins a purchase or restore to the identity that started it.
     * Observations prefer the restored owner, then the owner Voidhash accepted the receipt for,
     * then the original account-token mapping, and only then the current identity.
     * [restoring] revalidates the receipt even when a previous submission was accepted, and is
     * the only submission sent with the `restore` intent. Otherwise a purchase this SDK started, or
     * one the host reported, is sent as a `purchase` claim until this device has claimed it once
     * (see [claimsPurchase]), also after Voidhash accepted it as a `sync`; anything else is a `sync`.
     *
     * [deferStoreFinalization] leaves the finish to a later call, for a caller without a schema
     * to tell a consumable from the rest. Unlike a host's claim it is not remembered: the next
     * call with a schema finishes the purchase, as does one that joined this run with one.
     *
     * Returns `true` only after the backend explicitly accepts the receipt. A
     * `false` result leaves the receipt queued and the store transaction unfinished. Throws when
     * the backend accepted the receipt but acknowledging or consuming the purchase failed: the
     * receipt is not sent again, and the next call retries only the store finish.
     */
    suspend fun processTransaction(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Boolean?,
        distinctIdOverride: String? = null,
        restoring: Boolean = false,
        deferStoreFinalization: Boolean = false,
    ): Boolean {
        val run = runOrJoinTransaction(
            transaction, schema, readOnlyOverride, distinctIdOverride, restoring, deferStoreFinalization,
        )
        run.finishFailure?.let { throw it }
        return run.accepted
    }

    /**
     * [processTransaction], reporting a store finish that failed after the backend accepted the
     * receipt as [TransactionRun.finishFailure] instead of throwing it, for the callers a paid and
     * recorded purchase must not fail: the purchase itself and the purchase observer.
     *
     * [onAccepted] is called, once at most, as soon as the backend accepted the receipt: before
     * the store finish, which the returned run includes, also when that finish is another
     * caller's that this one joined.
     */
    private suspend fun runOrJoinTransaction(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Boolean?,
        distinctIdOverride: String? = null,
        restoring: Boolean = false,
        deferStoreFinalization: Boolean = false,
        onAccepted: (() -> Unit)? = null,
    ): TransactionRun {
        if (transaction.purchaseState != "purchased") {
            return NOT_ACCEPTED
        }

        val processingKey = transaction.processingKey
        val distinctId = distinctIdOverride ?: ownerOf(transaction)
        val processedCacheKey = PROCESSED_TRANSACTION_KEY_PREFIX + processingKey

        while (true) {
            val claim = claimTransaction(processingKey, readOnlyOverride)
            if (claim.isOwner) {
                // Released before the joiners resume, so one that takes the transaction over
                // claims it afresh instead of joining this run again.
                // Told to the joiners and to this caller at once, the first time only.
                val tellAccepted = { if (claim.entry.accepted.complete(true)) onAccepted?.invoke() }
                try {
                    val run = runTransaction(
                        transaction,
                        schema,
                        readOnlyOverride,
                        claim.entry,
                        processedCacheKey,
                        processingKey,
                        distinctId,
                        restoring,
                        deferStoreFinalization,
                        tellAccepted,
                    )
                    releaseTransaction(processingKey, claim.entry)
                    if (run.accepted) tellAccepted() else claim.entry.accepted.complete(false)
                    claim.entry.deferred.complete(run)
                    return run
                } catch (error: Throwable) {
                    releaseTransaction(processingKey, claim.entry)
                    claim.entry.accepted.completeExceptionally(error)
                    claim.entry.deferred.completeExceptionally(error)
                    throw error
                }
            }

            if (onAccepted != null) {
                val accepted = try {
                    claim.entry.accepted.await()
                } catch (error: CancellationException) {
                    currentCoroutineContext().ensureActive()
                    continue
                }
                if (accepted) onAccepted()
            }

            // Rethrows the owner's failure: a joiner must never read a failed run as a synced,
            // finished transaction.
            val run = try {
                claim.entry.deferred.await()
            } catch (error: CancellationException) {
                // Only the run this caller joined was cancelled — the SDK's own scope went away
                // under an observer or a scan. A caller still live runs the transaction itself
                // rather than ending without a result.
                currentCoroutineContext().ensureActive()
                continue
            }
            if (restoring || claimsPurchase(transaction)) {
                // A restore needs its own submission after the shared scan releases the receipt,
                // and so does a purchase claim that run did not send.
                yield()
                return runOrJoinTransaction(
                    transaction, schema, readOnlyOverride, distinctId, restoring = restoring,
                    deferStoreFinalization = deferStoreFinalization, onAccepted = onAccepted,
                )
            }
            if (run.accepted && run.finishFailure == null && !deferStoreFinalization &&
                takeStoreFinalizationPending(claim.entry, readOnlyOverride)
            ) {
                return TransactionRun(accepted = true, finishFailure = finishFailureOf(transaction, schema, processedCacheKey))
            }
            return run
        }
    }

    private suspend fun releaseTransaction(processingKey: String, entry: InFlightTransaction) {
        withContext(NonCancellable) {
            inFlightMutex.withLock {
                if (inFlightTransactions[processingKey] === entry) inFlightTransactions.remove(processingKey)
            }
        }
    }

    private suspend fun claimTransaction(
        processingKey: String,
        readOnlyOverride: Boolean?,
    ): TransactionClaim = inFlightMutex.withLock {
        val existing = inFlightTransactions[processingKey]
        if (existing != null) {
            if (readOnlyOverride == true) existing.hostClaimed = true
            if (readOnlyOverride == false) {
                existing.ownerClaimed = true
            }
            return@withLock TransactionClaim(existing, isOwner = false)
        }

        val entry = InFlightTransaction()
        entry.hostClaimed = readOnlyOverride == true
        entry.ownerClaimed = readOnlyOverride == false
        inFlightTransactions[processingKey] = entry
        TransactionClaim(entry, isOwner = true)
    }

    /**
     * Whether a caller that joined [entry]'s run finishes the purchase its owner left unfinished:
     * when it would have finished it had it run the transaction itself (see [leavesFinishToHost]).
     * Taken by one joiner only.
     */
    private suspend fun takeStoreFinalizationPending(entry: InFlightTransaction, readOnlyOverride: Boolean?): Boolean =
        inFlightMutex.withLock {
            val finishes = entry.storeFinalizationPending && !leavesFinishToHost(entry, readOnlyOverride)
            if (finishes) entry.storeFinalizationPending = false
            finishes
        }

    /**
     * Whether the store finish of [entry]'s purchase is not this SDK's: the host claimed it, or the
     * SDK observes — unless the purchase is one the SDK started. Call under [inFlightMutex].
     */
    private fun leavesFinishToHost(entry: InFlightTransaction, readOnlyOverride: Boolean?): Boolean =
        !entry.ownerClaimed && (entry.hostClaimed || (readOnlyOverride ?: readOnlyProvider()))

    private suspend fun runTransaction(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Boolean?,
        entry: InFlightTransaction,
        processedCacheKey: String,
        processingKey: String,
        capturedDistinctId: String,
        restoring: Boolean,
        deferStoreFinalization: Boolean,
        onAccepted: () -> Unit,
    ): TransactionRun {
        val restoreIdentity = if (restoring) capturedDistinctId else outbox?.pendingRestoreDistinctId(processingKey)
        val revalidating = restoreIdentity != null
        val cachedState = readProcessedState(processedCacheKey)
            ?: readProcessedState(PROCESSED_TRANSACTION_KEY_PREFIX + transaction.legacyProcessingKey)
        if (cachedState?.externallyManaged == true) {
            inFlightMutex.withLock { entry.hostClaimed = true }
        }
        val claim = restoreIdentity == null && claimsPurchase(transaction)
        // Outlives the 30-minute marker: without it a later scan would resubmit the receipt
        // under whoever is signed in by then. A purchase still to be claimed is sent whatever
        // Voidhash accepted before.
        val backendAccepted = !claim && (
            cachedState?.backendAccepted == true ||
                outbox?.acceptedReceipts?.find(processingKey)?.covers(transaction) == true
            )
        if (backendAccepted && cachedState?.storeFinalized == true && !revalidating) {
            return ACCEPTED
        }

        if (!transaction.isDevelopment && transaction.purchaseToken.isNullOrEmpty()) {
            onWarning(
                "Skipping observed Android transaction without purchase token ${redacted(transaction.transactionId)}",
            )
            return NOT_ACCEPTED
        }

        while (!backendAccepted || revalidating) {
            var distinctId = restoreIdentity ?: capturedDistinctId
            if (transaction.isDevelopment) {
                val accepted = try {
                    apiClient.developmentPurchase(
                        distinctId,
                        DevelopmentPurchaseRequest(
                            devTransactionId = transaction.transactionId,
                            productSlug = resolveProductSlug(transaction, schema),
                            purchaseDate = transaction.purchaseDate,
                            quantity = transaction.quantity,
                        ),
                    )
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    if (!isDeferredSyncFailure(error)) throw error
                    onWarning(
                        "Deferred development transaction ${redacted(transaction.transactionId)}: ${error.message}",
                    )
                    return NOT_ACCEPTED
                }
                if (!accepted) {
                    onWarning("Backend did not accept transaction ${redacted(transaction.transactionId)}")
                    return NOT_ACCEPTED
                }
            } else {
                var request = syncRequest(
                    transaction,
                    schema,
                    when {
                        restoreIdentity != null -> SYNC_TRANSACTION_INTENT_RESTORE
                        claim -> SYNC_TRANSACTION_INTENT_PURCHASE
                        else -> SYNC_TRANSACTION_INTENT_SYNC
                    },
                ).copy(
                    // Only this SDK's own purchase pins owner mode, and that pin always wins, so the
                    // server may acknowledge it.
                    isStartedBySdk = inFlightMutex.withLock { entry.ownerClaimed },
                    // A restore is not a sale, so it never names a paywall.
                    paywallContext = if (restoreIdentity == null) purchasePaywall(transaction) else null,
                )
                // Recorded before the request so a crash, a kill, or an outage between here
                // and the backend's answer cannot lose a purchase the user already paid for.
                if (outbox != null) {
                    val retained = outbox.enqueue(processingKey, distinctId, request, restoreIdentity).record
                        ?: return NOT_ACCEPTED
                    // A refused receipt waits out its park; only an explicit restore asks again sooner.
                    if (!restoring && outbox.isParked(processingKey)) return NOT_ACCEPTED
                    distinctId = retained.distinctId
                    request = request.copy(intent = retained.outgoingRequest.intent)
                }
                if (restoreIdentity != null) {
                    writeProcessedState(
                        processedCacheKey, backendAccepted = false,
                        storeFinalized = cachedState?.storeFinalized == true,
                        externallyManaged = cachedState?.externallyManaged == true,
                    )
                    cacheManager.set(
                        RESTORED_TRANSACTION_IDENTITY_KEY_PREFIX + processingKey,
                        restoreIdentity,
                        ttlMs = RESTORED_TRANSACTION_IDENTITY_TTL_MS,
                    )
                }
                val verdict = try {
                    // Marked while in flight, so the outbox's own retries do not send it again.
                    val sent = request
                    val sentAs = distinctId
                    if (outbox != null) {
                        outbox.sending(processingKey) { apiClient.syncTransactionVerdict(sentAs, sent) }
                    } else {
                        apiClient.syncTransactionVerdict(sentAs, sent)
                    }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    if (classifyFailure(error) == FailureClass.VERDICT) {
                        // The answer will not change this session: kept, but parked.
                        outbox?.park(processingKey, error)
                        onWarning("Backend refused transaction ${redacted(transaction.transactionId)}: ${error.message}")
                        // A request the SDK cannot build fails its caller; the backend's verdict does not.
                        if (error !is VoidhashApiException) throw error
                        return NOT_ACCEPTED
                    }
                    onWarning(
                        "Deferred transaction ${redacted(transaction.transactionId)}: ${error.message}",
                    )
                    // Refused by the open circuit or the paused key, nothing was sent: as in the
                    // outbox's own drain, the receipt keeps its retry state and is not reported as
                    // a failed attempt. It is sent once a request is let through again.
                    if (error !is VoidhashCircuitOpenException && error !is VoidhashOutboundPausedException) {
                        outbox?.postpone(processingKey, error)
                    }
                    return NOT_ACCEPTED
                }
                when (verdict) {
                    TransactionSyncVerdict.ACCEPTED -> {
                        // Not complete while a restore waits behind this delivery; the next lap
                        // sends what the outbox holds now.
                        if (outbox?.acknowledge(processingKey, distinctId, request.intent) == false) continue
                    }
                    TransactionSyncVerdict.REJECTED,
                    TransactionSyncVerdict.INDETERMINATE,
                    -> {
                        onWarning("Backend did not accept transaction ${redacted(transaction.transactionId)}")
                        outbox?.postpone(processingKey)
                        return NOT_ACCEPTED
                    }
                }
            }

            writeProcessedState(
                processedCacheKey,
                backendAccepted = true,
                // An acknowledged consumable still has to be consumed.
                storeFinalized = cachedState?.storeFinalized == true || transaction.isAcknowledged &&
                    resolveProductDefinition(transaction, schema)?.type != "one-time-consumable",
                externallyManaged = inFlightMutex.withLock { entry.hostClaimed },
            )
            break
        }

        // Accepted, whatever the store finish below comes to.
        onAccepted()
        if (cachedState?.storeFinalized == true) return ACCEPTED

        val deferFinalization = inFlightMutex.withLock {
            if (deferStoreFinalization || leavesFinishToHost(entry, readOnlyOverride)) {
                entry.storeFinalizationPending = true
                true
            } else {
                false
            }
        }
        if (deferFinalization) {
            return ACCEPTED
        }

        return TransactionRun(accepted = true, finishFailure = finishFailureOf(transaction, schema, processedCacheKey))
    }

    /**
     * Whether a failed sync leaves the receipt queued rather than failing the caller.
     *
     * A receipt leaves the outbox only once the backend accepts it, so a transient failure, an
     * authentication pause and an API verdict all keep it for the outbox to retry. Only a
     * request the SDK could not build at all fails the caller.
     */
    private fun isDeferredSyncFailure(error: Throwable): Boolean =
        classifyFailure(error) != FailureClass.VERDICT || error is VoidhashApiException

    /**
     * Refreshes the person snapshot after a synced transaction. A refresh is a
     * read-side convenience: a network blip must not fail a purchase the store
     * and the backend have already accepted.
     */
    private suspend fun refreshPerson(context: String) {
        try {
            onPersonRefresh()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Failed to refresh the person after $context: ${error.message}")
        }
    }

    /** [finalizeWithStore], returning why the store refused or failed the finish; `null` once finished. */
    private suspend fun finishFailureOf(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        processedCacheKey: String,
    ): Throwable? = try {
        finalizeWithStore(transaction, schema, processedCacheKey)
        null
    } catch (error: CancellationException) {
        throw error
    } catch (error: Throwable) {
        error
    }

    private suspend fun finalizeWithStore(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        processedCacheKey: String,
    ) {
        val consumable = resolveProductDefinition(transaction, schema)?.type == "one-time-consumable"
        // The server acknowledges a purchase this SDK started once it records it, but only consuming
        // lets a consumable be bought again, so an acknowledged one is still consumed.
        if (!transaction.isDevelopment && (consumable || !transaction.isAcknowledged)) {
            val token = transaction.purchaseToken
                ?: throw VoidhashException(
                    "BILLING_ERROR",
                    "Purchase token is required for acknowledgment",
                )

            if (consumable) {
                val result = billing.consumeProduct(token)
                // Not owned any more: consumed already, by an earlier run of this finish. (The
                // background purchase check never consumes; it only acknowledges.)
                if (result.responseCode != 0.0 && result.responseCode != ITEM_NOT_OWNED) {
                    throw VoidhashException("BILLING_ERROR", result.message)
                }
            } else {
                acknowledgeWithStore(token)
            }
        }

        writeProcessedState(processedCacheKey, backendAccepted = true, storeFinalized = true)
    }

    /**
     * Acknowledges the purchase [token] with Play. Voidhash may have acknowledged it on the server
     * since the purchase was read, so a failed acknowledgement is checked against what Play
     * reports now: a purchase it lists as acknowledged is done. Any other failure is thrown.
     */
    private suspend fun acknowledgeWithStore(token: String) {
        val failure = try {
            val result = billing.acknowledgePurchase(token)
            if (result.responseCode == 0.0) return
            VoidhashException("BILLING_ERROR", result.message)
        } catch (error: VoidhashException) {
            error
        }
        val acknowledged = try {
            (billing.getAvailableItemsByType(BillingProductType.SUBS) +
                billing.getAvailableItemsByType(BillingProductType.INAPP))
                .any { it.purchaseToken == token && it.isAcknowledged }
        } catch (error: CancellationException) {
            throw error
        } catch (error: Throwable) {
            onWarning("Could not check whether Play acknowledged ${redacted(token)}: ${error.message}")
            false
        }
        if (!acknowledged) throw failure
    }

    /**
     * Whether [transaction] is reported as a `purchase` claim, which gives it to the person it is
     * reported for even when another person owns it: a purchase this SDK started, or one the host
     * reported ([StoreTransaction.externallyManaged]), that this device has not claimed yet. A
     * purchase is claimed once ([AcceptedReceipt.purchaseClaimed]), so a later report of it, made
     * for whoever is signed in by then, is a `sync` and cannot move it. A restore is never a claim.
     */
    private suspend fun claimsPurchase(transaction: StoreTransaction): Boolean {
        if (transaction.isDevelopment || !(transaction.externallyManaged || isStartedBySdk(transaction))) return false
        // Without an outbox nothing remembers a claim past the processed marker.
        val ledger = outbox?.acceptedReceipts
            ?: return readProcessedState(PROCESSED_TRANSACTION_KEY_PREFIX + transaction.processingKey)?.backendAccepted != true
        return ledger.find(transaction.processingKey)?.purchaseClaimed != true
    }

    /** The paywall [purchase] started [transaction]'s purchase from, if it did. */
    private fun purchasePaywall(transaction: StoreTransaction): PurchasePaywallContext? {
        val stored = cacheManager.getString(PURCHASE_PAYWALL_KEY_PREFIX + transaction.processingKey)
            ?.takeUnless { it.isExpired }
            ?.let { hit -> runCatching { JSONObject(hit.value) }.getOrNull() }
        return (stored ?: launchOf(transaction)?.optJSONObject("paywallContext"))
            ?.let(PurchasePaywallContext::fromJson)
    }

    /**
     * Whether [purchase] started [transaction]'s purchase in the last [SDK_STARTED_PURCHASE_TTL_MS]:
     * marked by its token once Play answered, or a purchase of a product whose sheet's answer the
     * SDK never saw, carrying the account token that sheet was opened with (see [launchMarkerOf]).
     *
     * A purchase recognised the second way is marked by its token here, with the paywall its sheet
     * was opened from, as [purchase] would have marked it: the launch marker holds one launch per
     * product, and a later attempt for the product replaces it.
     */
    private fun isStartedBySdk(transaction: StoreTransaction): Boolean {
        val marker = SDK_STARTED_PURCHASE_KEY_PREFIX + transaction.processingKey
        if (cacheManager.get(marker)?.isExpired == false) return true
        val launch = launchMarkerOf(transaction) ?: return false
        cacheManager.set(marker, true, ttlMs = SDK_STARTED_PURCHASE_TTL_MS)
        launch.optString("distinctId").takeIf { it.isNotEmpty() }?.let { buyer ->
            cacheManager.set(
                PURCHASE_IDENTITY_KEY_PREFIX + transaction.processingKey,
                buyer,
                ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
            )
        }
        launchOf(transaction)?.optJSONObject("paywallContext")?.let { paywall ->
            cacheManager.set(
                PURCHASE_PAYWALL_KEY_PREFIX + transaction.processingKey,
                paywall.toString(),
                ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
            )
        }
        return true
    }

    /**
     * Recognises, among [listed], everything the store lists now, the purchases of replacements
     * launched without an account id for a purchase that had none, whose answers the SDK never
     * saw. Nothing on such a purchase says who made it, so it is known by what it replaced: the
     * launch names the replaced purchase, Google Play no longer lists that one, and lists instead
     * a paid, unacknowledged purchase of the launched product, without an account id, made no
     * earlier than the launch (give or take [LAUNCH_CLOCK_SLACK_MS] between the two clocks).
     * Another billing integration would have to replace that same subscription with that same
     * product after the launch to be mistaken for it.
     *
     * A purchase recognised so is marked as [purchase] would have marked it — this SDK's own,
     * bought by the identity that opened the sheet, from the paywall the sheet was opened from —
     * and its launch is taken out of the marker, so a launch claims one purchase. While the
     * replaced purchase is still listed, or the new one is pending, nothing is claimed and the
     * launch waits for a later scan.
     */
    private fun claimLostReplacements(listed: Collection<StoreTransaction>) {
        val listedTokens = listed.mapNotNullTo(HashSet()) { it.purchaseToken }
        for (candidate in listed) {
            if (!candidate.appAccountToken.isNullOrEmpty() || candidate.isAcknowledged) continue
            if (candidate.purchaseState != "purchased") continue
            val markerKey = SDK_STARTED_PURCHASE_KEY_PREFIX + SDK_LAUNCHED_PRODUCT_KEY_PREFIX + candidate.productId
            val marker = cacheManager.getObject(markerKey)?.takeUnless { it.isExpired } ?: continue
            val launches = launchesOf(marker.value)
            val launch = launches.firstOrNull { launch ->
                val replaced = launch.optString("replaces")
                launch.optBoolean(NO_ACCOUNT_TOKEN_FIELD) && replaced.isNotEmpty() && replaced !in listedTokens &&
                    candidate.purchaseDate >= launch.optLong("launchedAt", Long.MAX_VALUE) - LAUNCH_CLOCK_SLACK_MS
            } ?: continue

            cacheManager.set(SDK_STARTED_PURCHASE_KEY_PREFIX + candidate.processingKey, true, ttlMs = SDK_STARTED_PURCHASE_TTL_MS)
            launch.optString("distinctId").takeIf { it.isNotEmpty() }?.let { buyer ->
                cacheManager.set(PURCHASE_IDENTITY_KEY_PREFIX + candidate.processingKey, buyer, ttlMs = SDK_STARTED_PURCHASE_TTL_MS)
            }
            val paywall = launch.optJSONObject("paywallContext")
            if (paywall != null && candidate.purchaseDate <= launch.optLong("launchedAt") + LAUNCH_WINDOW_MS) {
                cacheManager.set(
                    PURCHASE_PAYWALL_KEY_PREFIX + candidate.processingKey,
                    paywall.toString(),
                    ttlMs = SDK_STARTED_PURCHASE_TTL_MS,
                )
            }
            val others = launches.filter { it !== launch }
            if (others.isEmpty()) {
                cacheManager.delete(markerKey)
            } else {
                cacheManager.setWithDeadlines(
                    markerKey,
                    JSONObject(others.first().toString()).apply {
                        if (others.size > 1) put(EARLIER_LAUNCHES_FIELD, JSONArray(others.drop(1)))
                    },
                    staleAt = null,
                    expiresAt = marker.expiresAt,
                )
            }
        }
    }

    /**
     * Whether a launch of [productId]'s sheet is still unanswered whose purchase would carry no
     * account id, so that [claimLostReplacements] has to look at what the store lists to know it.
     */
    private fun awaitsLostReplacement(productId: String): Boolean {
        val marker = cacheManager.getObject(SDK_STARTED_PURCHASE_KEY_PREFIX + SDK_LAUNCHED_PRODUCT_KEY_PREFIX + productId)
            ?.takeUnless { it.isExpired } ?: return false
        return launchesOf(marker.value).any { it.optBoolean(NO_ACCOUNT_TOKEN_FIELD) && it.optString("replaces").isNotEmpty() }
    }

    /**
     * The identity that started [transaction]'s purchase, when its account id does not say: a
     * replacement launched without one, so that Google Play gave it the account id of the
     * subscription it replaced. Remembered for the purchase once the SDK has seen it, and read
     * from the launch that expects it until then.
     */
    private fun buyerOf(transaction: StoreTransaction): String? =
        cacheManager.getString(PURCHASE_IDENTITY_KEY_PREFIX + transaction.processingKey)?.takeUnless { it.isExpired }?.value
            ?: launchMarkerOf(transaction)?.optString("distinctId")?.takeIf { it.isNotEmpty() }

    /**
     * The launch marker of [transaction]'s product, when the purchase carries the account token the
     * marker's sheet expects of what it buys: the one the sheet was opened with or, for a
     * replacement launched without one, the one on the subscription it replaces. Only this SDK's
     * buys set that token, derived from a buyer's identity, so the match alone tells the purchase
     * from one another billing integration made. The purchase a launch replaces is never the one it
     * bought, though it may be of the same product and carry the same token. Neither clock is
     * consulted: the device's may be wrong by hours, and a sheet may stay open for as long as the
     * user leaves it.
     *
     * A replacement of a purchase without an account id buys one without, which this match
     * cannot tell from another integration's. It is known while its sheet is open in this process
     * (see [sheetsWithoutAccountToken]), which is when Play announces it to the purchase observer,
     * and afterwards by what it replaced (see [claimLostReplacements]).
     */
    private fun launchMarkerOf(transaction: StoreTransaction): JSONObject? {
        sheetsWithoutAccountToken[transaction.productId]?.let { launch ->
            val bought = transaction.appAccountToken.isNullOrEmpty() && launch.optString("replaces") != transaction.purchaseToken
            if (bought) return launch
        }
        val marker = cacheManager.get(SDK_STARTED_PURCHASE_KEY_PREFIX + SDK_LAUNCHED_PRODUCT_KEY_PREFIX + transaction.productId)
            ?.takeUnless { it.isExpired }?.value as? JSONObject ?: return null
        return launchesOf(marker).firstOrNull { launch ->
            val accountToken = launch.optString("accountToken").takeIf { it.isNotEmpty() }
            accountToken != null && transaction.appAccountToken.equals(accountToken, ignoreCase = true) &&
                launch.optString("replaces") != transaction.purchaseToken
        }
    }

    /**
     * The launches a product's marker holds: its newest, and under [EARLIER_LAUNCHES_FIELD] the
     * unanswered ones of other account tokens it was written next to.
     */
    private fun launchesOf(marker: JSONObject): List<JSONObject> {
        val earlier = marker.optJSONArray(EARLIER_LAUNCHES_FIELD)
        val newest = JSONObject(marker.toString()).apply { remove(EARLIER_LAUNCHES_FIELD) }
        return listOf(newest) + (0 until (earlier?.length() ?: 0)).mapNotNull { earlier?.optJSONObject(it) }
    }

    /**
     * [launchMarkerOf] when the purchase was also made while that marker's sheet could have been
     * open, which is what ties it to the paywall the sheet was opened from: a purchase of the
     * product the same user made at another time, on another device for one, was not made there.
     */
    private fun launchOf(transaction: StoreTransaction): JSONObject? {
        val launch = launchMarkerOf(transaction) ?: return null
        val launchedAt = launch.optLong("launchedAt", -1L).takeIf { it >= 0 } ?: return null
        val withinSheet = transaction.purchaseDate >= launchedAt - LAUNCH_CLOCK_SLACK_MS &&
            transaction.purchaseDate <= launchedAt + LAUNCH_WINDOW_MS
        return launch.takeIf { withinSheet }
    }

    /**
     * The Studio product [transaction] is for: the one the purchase that made it named, otherwise the
     * one configured with its store product. When several Studio products are base plans of the same
     * Play product, a non-consumable one wins, so a purchase the device cannot place is never consumed.
     */
    private fun resolveProductDefinition(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
    ): RuntimeProductDefinition? {
        transaction.productSlug?.let { slug -> schema.products[slug]?.let { return it } }
        val matches = definitionsOf(transaction, schema)
        return matches.firstOrNull { it.type != "one-time-consumable" } ?: matches.firstOrNull()
    }

    private fun definitionsOf(transaction: StoreTransaction, schema: RuntimeSchema): List<RuntimeProductDefinition> =
        schema.products.values.filter { definition ->
            definition.slug == transaction.productId ||
                definition.providers.googlePlay?.productId == transaction.productId ||
                definition.providers.development?.productId == transaction.productId
        }

    private fun resolveProductSlug(transaction: StoreTransaction, schema: RuntimeSchema): String =
        resolveProductDefinition(transaction, schema)?.slug ?: transaction.productId

    /**
     * The Studio product an app is told [transaction] is for: the one its purchase named, or the only
     * one configured with its store product; `null` when several are, as base plans of one Play
     * subscription, and the device cannot tell which Play billed.
     */
    private fun publicSlugOf(transaction: StoreTransaction, schema: RuntimeSchema): String? =
        transaction.productSlug ?: definitionsOf(transaction, schema).singleOrNull()?.slug

    /** [transaction] as the app sees it, naming its Studio product when the device can tell it. */
    fun publicTransaction(transaction: StoreTransaction, schema: RuntimeSchema): VoidhashTransaction =
        transaction.copy(productSlug = publicSlugOf(transaction, schema)).toPublic()

    /** What identifies a transaction among the ones [purchase] returned or [announce] announced: a renewal is another. */
    private fun announcementKey(transaction: StoreTransaction): String =
        "${transaction.processingKey}|${transaction.transactionId}"

    /** Whether Voidhash accepted [transaction]'s receipt, as far as the device knows. */
    private suspend fun isAccepted(transaction: StoreTransaction): Boolean =
        readProcessedState(PROCESSED_TRANSACTION_KEY_PREFIX + transaction.processingKey)?.backendAccepted == true ||
            outbox?.acceptedReceipts?.find(transaction.processingKey)?.covers(transaction) == true

    /**
     * Whether [transaction] is a purchase completed outside [purchase] that an update announces: one
     * nothing had finished when the device saw it, such as a pending payment made later or a code
     * redeemed in the Play Store, handled now — its receipt accepted, or queued in the outbox — and
     * not accepted before ([acceptedBefore]). Not one a [purchase] returned or whose sheet is open,
     * which answers that purchase, nor one the host reported or one suspended. Google Play's renewals
     * keep their acknowledged purchase and are not announced.
     */
    private suspend fun isNewlyHandled(transaction: StoreTransaction, acceptedBefore: Boolean): Boolean {
        if (acceptedBefore || transaction.purchaseState != "purchased" || transaction.isAcknowledged) return false
        if (transaction.externallyManaged || transaction.isSuspended) return false
        if (transaction.productIds.any { openSheets.containsKey(it) }) return false
        if (announcementKey(transaction) in answeredTransactions) return false
        return isAccepted(transaction) || outbox?.pendingRecords?.any { it.key == transaction.processingKey } == true
    }

    /**
     * Announces to [onTransactionUpdate] those of [handled] — transactions with whether Voidhash had
     * accepted them before they were processed — that [isNewlyHandled] says completed outside
     * [purchase], each once per process. The person is refreshed first, unless the caller just did
     * ([refreshed]), when Voidhash has one of them, so a listener reads the person with the purchase.
     */
    private suspend fun announce(
        handled: List<Pair<StoreTransaction, Boolean>>,
        schema: RuntimeSchema,
        refreshed: Boolean = false,
    ) {
        val updates = handled.filter { (transaction, acceptedBefore) -> isNewlyHandled(transaction, acceptedBefore) }.map { it.first }
        if (updates.isEmpty()) return
        if (!refreshed && updates.any { isAccepted(it) }) refreshPerson("a purchase completed outside the app's purchase call")
        for (transaction in updates) {
            if (!answeredTransactions.add(announcementKey(transaction))) continue
            try {
                onTransactionUpdate(VoidhashTransactionUpdate(publicTransaction(transaction, schema), synced = isAccepted(transaction)))
            } catch (error: Throwable) {
                onWarning("The transaction update listener failed: ${error.message}")
            }
        }
    }

    private fun syncRequest(
        transaction: StoreTransaction,
        schema: RuntimeSchema,
        intent: String = SYNC_TRANSACTION_INTENT_SYNC,
    ) = SyncTransactionRequest(
        appAccountToken = transaction.appAccountToken,
        providerProductId = transaction.productId,
        productSlug = resolveProductSlug(transaction, schema),
        purchaseDate = transaction.purchaseDate,
        purchaseToken = transaction.purchaseToken ?: "",
        quantity = transaction.quantity,
        receipt = transaction.receipt,
        transactionId = transaction.transactionId,
        intent = intent,
    )

    /**
     * Whether this acceptance covers [transaction]: the same order, or any order when the
     * transaction carries only its token (a host report), which cannot be told apart from the
     * accepted one. A renewal keeps the token but brings a new order id, so it is reported.
     */
    private fun AcceptedReceipt.covers(transaction: StoreTransaction): Boolean =
        transactionId == transaction.transactionId || transaction.transactionId == transaction.purchaseToken

    private fun readProcessedState(cacheKey: String): ProcessedTransactionState? {
        val cached = cacheManager.getObject(cacheKey) ?: return null
        // An expired marker is a miss: the cache serves expired entries for offline reads,
        // but a processed-transaction record past its lifetime must not stop a receipt
        // from syncing again, and nothing else would delete it.
        if (cached.isExpired) {
            cacheManager.delete(cacheKey)
            return null
        }
        return ProcessedTransactionState(
            backendAccepted = cached.value.optBoolean("backendAccepted"),
            storeFinalized = cached.value.optBoolean("storeFinalized"),
            externallyManaged = cached.value.optBoolean("externallyManaged"),
        )
    }

    private fun writeProcessedState(
        cacheKey: String,
        backendAccepted: Boolean,
        storeFinalized: Boolean,
        externallyManaged: Boolean = false,
    ) {
        cacheManager.set(
            cacheKey,
            JSONObject()
                .put("backendAccepted", backendAccepted)
                .put("storeFinalized", storeFinalized)
                .put("externallyManaged", externallyManaged),
            ttlMs = PROCESSED_TRANSACTION_TTL_MS,
        )
    }

    private data class ProcessedTransactionState(
        val backendAccepted: Boolean,
        val storeFinalized: Boolean,
        val externallyManaged: Boolean,
    )
}
