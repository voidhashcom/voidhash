package com.voidhash.sdk

import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingProductType
import com.voidhash.sdk.api.DevelopmentPurchaseRequest
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.TransactionSyncVerdict
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashTransaction
import com.voidhash.sdk.billing.mapBillingProductToProduct
import com.voidhash.sdk.billing.mapBillingPurchaseToTransaction
import com.voidhash.sdk.billing.mapDevelopmentPurchaseToTransaction
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.identity.AccountToken
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import com.voidhash.sdk.network.VoidhashOutboundPausedException
import com.voidhash.sdk.schema.RuntimeProductDefinition
import com.voidhash.sdk.schema.RuntimeSchema
import com.voidhash.sdk.transactions.TransactionOutbox
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject

private const val PROCESSED_TRANSACTION_TTL_MS = 1000L * 60 * 30

private class InFlightTransaction {
    val deferred = CompletableDeferred<Boolean>()
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
 * cache entry recording `{backendAccepted, storeFinalized}`). Observer mode
 * (`readOnly`) syncs but never finishes with the store — except for a purchase
 * this SDK started, whose ownership is pinned when the flow begins so a
 * mid-flight `setReadOnly(true)` can't strand the transaction.
 */
class PurchaseOrchestrator(
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
) {
    private val inFlightTransactions = mutableMapOf<String, InFlightTransaction>()

    // The observer callback processes transactions on its own coroutine, so the
    // registry and the entry flags are reached from several threads; both the
    // lookups and the check-then-act flag transitions run under this mutex.
    private val inFlightMutex = Mutex()

    /** Queries the store for every product configured in [schema]. */
    suspend fun getProducts(schema: RuntimeSchema): List<VoidhashProduct> {
        if (developmentMode) {
            return schema.products.values.mapNotNull { definition ->
                val configuration = definition.providers.development ?: return@mapNotNull null
                VoidhashProduct(
                    id = configuration.productId,
                    slug = definition.slug,
                    name = definition.name,
                    description = "Development purchase",
                    displayName = definition.name,
                    displayPrice = "$" + "%.2f".format(configuration.price),
                    price = configuration.price,
                    currency = configuration.currencyCode,
                    type = if (definition.type == "subscription") "subs" else "inapp",
                    billingPeriod = configuration.period,
                    googlePlayOfferToken = null,
                )
            }
        }

        val definitionsByProductId = schema.products.values
            .mapNotNull { definition ->
                definition.providers.googlePlay?.productId?.let { it to definition }
            }
            .toMap()

        if (definitionsByProductId.isEmpty()) {
            return emptyList()
        }

        val productIds = definitionsByProductId.keys.toTypedArray()
        val details = billing.getItemsByType(BillingProductType.INAPP, productIds) +
            billing.getItemsByType(BillingProductType.SUBS, productIds)

        return details.map { detail ->
            mapBillingProductToProduct(definitionsByProductId[detail.id], detail)
        }
    }

    /**
     * Buys [product], syncs the resulting transaction and refreshes the person.
     */
    internal suspend fun purchase(
        product: VoidhashProduct,
        schema: RuntimeSchema,
    ): VoidhashTransaction {
        // Pinned at purchase start: a purchase this SDK owns must still be
        // finished with the store even if the app flips to observer mode while
        // the store sheet is open.
        val readOnlyAtPurchaseStart = readOnlyProvider()
        val distinctId = identityStore.getDistinctId()

        val type = if (product.isSubscription) BillingProductType.SUBS else BillingProductType.INAPP
        if (!developmentMode && type == BillingProductType.SUBS && product.googlePlayOfferToken == null) {
            throw VoidhashException(
                "PURCHASE_FAILED",
                "Google Play subscription has no configured offer token",
            )
        }

        val purchases = billing.buyItemByType(
            BillingBuyItemParams(
                type = type,
                skuArr = arrayOf(product.id),
                obfuscatedAccountId = AccountToken.derive(distinctId),
                offerTokenArr = product.googlePlayOfferToken?.let { arrayOf(it) },
                isOfferPersonalized = false,
            ),
        )

        val purchase = purchases.firstOrNull()
            ?: throw VoidhashException("PURCHASE_FAILED", "No purchase returned from Google Billing")

        val transaction = if (developmentMode) {
            mapDevelopmentPurchaseToTransaction(
                productId = product.id,
                devTransactionId = purchase.orderId ?: purchase.purchaseToken,
                purchaseDate = purchase.purchaseTime,
                quantity = 1,
            )
        } else {
            mapBillingPurchaseToTransaction(purchase)
        }
        when (transaction.purchaseState) {
            "purchased" -> Unit
            "pending" -> throw VoidhashException("PURCHASE_PENDING", "The payment was deferred")
            else -> throw VoidhashException(
                "PURCHASE_UNKNOWN_RESULT",
                "Google Billing returned an unknown state",
            )
        }

        if (processTransaction(transaction, schema, readOnlyAtPurchaseStart)) {
            refreshPerson("a purchase")
        }
        return transaction
    }

    /** Restores purchases: reconciles everything the store still reports, then refreshes. */
    suspend fun restorePurchases(schema: RuntimeSchema) {
        reconcileObservedTransactions(schema)
        refreshPerson("a restore")
    }

    /**
     * Processes every transaction the store still reports. One-time consumables
     * are skipped: consuming them here would silently burn an entitlement the
     * app has already granted. When [deferStoreFinalization] is true, receipts
     * are synced but left unfinished until a schema can classify the product.
     */
    suspend fun reconcileObservedTransactions(
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean = false,
    ) {
        val purchases = billing.getAvailableItemsByType(BillingProductType.INAPP) +
            billing.getAvailableItemsByType(BillingProductType.SUBS)

        val observedByKey = linkedMapOf<String, VoidhashTransaction>()
        for (purchase in purchases) {
            val transaction = mapBillingPurchaseToTransaction(purchase)
            observedByKey[transaction.processingKey] = transaction
        }

        val failures = mutableListOf<String>()
        for (transaction in observedByKey.values) {
            if (resolveProductDefinition(transaction, schema)?.type == "one-time-consumable") {
                continue
            }
            try {
                processTransaction(
                    transaction,
                    schema,
                    if (deferStoreFinalization) true else null,
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                failures.add(transaction.transactionId)
                onWarning("Failed to process observed transaction ${transaction.transactionId}: ${error.message}")
            }
        }

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
     * it in the store until product metadata is available.
     */
    suspend fun processObservedTransaction(
        transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        deferStoreFinalization: Boolean = false,
    ) {
        if (
            processTransaction(
                transaction,
                schema,
                if (deferStoreFinalization) true else null,
            )
        ) {
            refreshPerson("an observed transaction")
        }
    }

    /**
     * Syncs [transaction] to the backend and — unless the SDK is in observer
     * mode — finishes it with the store.
     *
     * [readOnlyOverride] pins the ownership decision for a purchase this SDK
     * started; every other caller passes `null` and reads the live flag at the
     * moment the decision is made.
     *
     * Returns `true` only after the backend explicitly accepts the receipt. A
     * `false` result leaves the receipt queued and the store transaction unfinished.
     */
    suspend fun processTransaction(
        transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Boolean?,
    ): Boolean {
        if (transaction.purchaseState != "purchased") {
            return false
        }

        val processingKey = transaction.processingKey
        val processedCacheKey = "processed-transaction:$processingKey"

        val claim = claimTransaction(processingKey, readOnlyOverride)
        if (!claim.isOwner) {
            // Rethrows the owner's failure: a joiner must never read a failed —
            // or cancelled — run as a synced, finished transaction.
            val accepted = claim.entry.deferred.await()
            if (accepted && readOnlyOverride == false && takeStoreFinalizationPending(claim.entry)) {
                finalizeWithStore(transaction, schema, processedCacheKey)
            }
            return accepted
        }

        try {
            val accepted = runTransaction(
                transaction,
                schema,
                readOnlyOverride,
                claim.entry,
                processedCacheKey,
                processingKey,
            )
            claim.entry.deferred.complete(accepted)
            return accepted
        } catch (error: Throwable) {
            claim.entry.deferred.completeExceptionally(error)
            throw error
        } finally {
            withContext(NonCancellable) {
                inFlightMutex.withLock { inFlightTransactions.remove(processingKey) }
            }
        }
    }

    private suspend fun claimTransaction(
        processingKey: String,
        readOnlyOverride: Boolean?,
    ): TransactionClaim = inFlightMutex.withLock {
        val existing = inFlightTransactions[processingKey]
        if (existing != null) {
            if (readOnlyOverride == false) {
                existing.ownerClaimed = true
            }
            return@withLock TransactionClaim(existing, isOwner = false)
        }

        val entry = InFlightTransaction()
        entry.ownerClaimed = readOnlyOverride == false
        inFlightTransactions[processingKey] = entry
        TransactionClaim(entry, isOwner = true)
    }

    private suspend fun takeStoreFinalizationPending(entry: InFlightTransaction): Boolean =
        inFlightMutex.withLock {
            val pending = entry.storeFinalizationPending
            entry.storeFinalizationPending = false
            pending
        }

    private suspend fun runTransaction(
        transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Boolean?,
        entry: InFlightTransaction,
        processedCacheKey: String,
        processingKey: String,
    ): Boolean {
        val cachedState = readProcessedState(processedCacheKey)
        if (cachedState?.storeFinalized == true) {
            return true
        }

        if (!transaction.isDevelopment && transaction.purchaseToken.isNullOrEmpty()) {
            onWarning(
                "Skipping observed Android transaction without purchase token ${transaction.transactionId}",
            )
            return false
        }

        if (cachedState?.backendAccepted != true) {
            val distinctId = identityStore.getDistinctId()
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
                        "Deferred development transaction ${transaction.transactionId}: ${error.message}",
                    )
                    return false
                }
                if (!accepted) {
                    onWarning("Backend did not accept transaction ${transaction.transactionId}")
                    return false
                }
            } else {
                val request = SyncTransactionRequest(
                    appAccountToken = transaction.appAccountToken,
                    providerProductId = transaction.productId,
                    productSlug = resolveProductSlug(transaction, schema),
                    purchaseDate = transaction.purchaseDate,
                    purchaseToken = transaction.purchaseToken ?: "",
                    quantity = transaction.quantity,
                    receipt = transaction.receipt,
                    transactionId = transaction.transactionId,
                )
                // Recorded before the request so a crash, a kill, or an outage between here
                // and the backend's answer cannot lose a purchase the user already paid for.
                outbox?.enqueue(processingKey, distinctId, request)
                val verdict = try {
                    apiClient.syncTransactionVerdict(distinctId, request)
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Throwable) {
                    if (!isDeferredSyncFailure(error)) throw error
                    onWarning(
                        "Deferred transaction ${transaction.transactionId}: ${error.message}",
                    )
                    outbox?.postpone(processingKey)
                    return false
                }
                when (verdict) {
                    TransactionSyncVerdict.ACCEPTED -> outbox?.acknowledge(processingKey)
                    TransactionSyncVerdict.REJECTED,
                    TransactionSyncVerdict.INDETERMINATE,
                    -> {
                        onWarning("Backend did not accept transaction ${transaction.transactionId}")
                        outbox?.postpone(processingKey)
                        return false
                    }
                }
            }

            writeProcessedState(
                processedCacheKey,
                backendAccepted = true,
                storeFinalized = transaction.isAcknowledged,
            )
        }

        val deferFinalization = inFlightMutex.withLock {
            if (!entry.ownerClaimed && (readOnlyOverride ?: readOnlyProvider())) {
                entry.storeFinalizationPending = true
                true
            } else {
                false
            }
        }
        if (deferFinalization) {
            return true
        }

        finalizeWithStore(transaction, schema, processedCacheKey)
        return true
    }

    private fun isDeferredSyncFailure(error: Throwable): Boolean = when (error) {
        is VoidhashNetworkException -> true
        is VoidhashCircuitOpenException -> true
        is VoidhashOutboundPausedException -> true
        is VoidhashApiException -> true
        else -> false
    }

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

    private suspend fun finalizeWithStore(
        transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        processedCacheKey: String,
    ) {
        if (!transaction.isAcknowledged) {
            val token = transaction.purchaseToken
                ?: throw VoidhashException(
                    "BILLING_ERROR",
                    "Purchase token is required for acknowledgment",
                )

            val result = if (resolveProductDefinition(transaction, schema)?.type == "one-time-consumable") {
                billing.consumeProduct(token)
            } else {
                billing.acknowledgePurchase(token)
            }

            if (result.responseCode != 0.0) {
                throw VoidhashException("BILLING_ERROR", result.message)
            }
        }

        writeProcessedState(processedCacheKey, backendAccepted = true, storeFinalized = true)
    }

    private fun resolveProductDefinition(
        transaction: VoidhashTransaction,
        schema: RuntimeSchema,
    ): RuntimeProductDefinition? = schema.products.values.firstOrNull { definition ->
        definition.slug == transaction.productId ||
            definition.providers.googlePlay?.productId == transaction.productId ||
            definition.providers.development?.productId == transaction.productId
    }

    private fun resolveProductSlug(transaction: VoidhashTransaction, schema: RuntimeSchema): String =
        resolveProductDefinition(transaction, schema)?.slug ?: transaction.productId

    private fun readProcessedState(cacheKey: String): ProcessedTransactionState? {
        val cached = cacheManager.getObject(cacheKey) ?: return null
        // An expired marker is a miss: the cache serves expired entries for offline reads,
        // but a processed-transaction record past its lifetime must not stop a receipt
        // from syncing again.
        if (cached.isExpired) return null
        return ProcessedTransactionState(
            backendAccepted = cached.value.optBoolean("backendAccepted"),
            storeFinalized = cached.value.optBoolean("storeFinalized"),
        )
    }

    private fun writeProcessedState(
        cacheKey: String,
        backendAccepted: Boolean,
        storeFinalized: Boolean,
    ) {
        cacheManager.set(
            cacheKey,
            JSONObject()
                .put("backendAccepted", backendAccepted)
                .put("storeFinalized", storeFinalized),
            ttlMs = PROCESSED_TRANSACTION_TTL_MS,
        )
    }

    private data class ProcessedTransactionState(
        val backendAccepted: Boolean,
        val storeFinalized: Boolean,
    )
}
