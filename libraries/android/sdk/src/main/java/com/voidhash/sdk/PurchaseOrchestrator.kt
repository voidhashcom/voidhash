package com.voidhash.sdk

import com.voidhash.core.billing.BillingBuyItemParams
import com.voidhash.core.billing.BillingProductType
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.api.VoidhashApiClient
import com.voidhash.sdk.billing.BillingEnginePort
import com.voidhash.sdk.billing.VoidhashProduct
import com.voidhash.sdk.billing.VoidhashTransaction
import com.voidhash.sdk.billing.mapBillingProductToProduct
import com.voidhash.sdk.billing.mapBillingPurchaseToTransaction
import com.voidhash.sdk.cache.CacheManager
import com.voidhash.sdk.identity.AccountToken
import com.voidhash.sdk.identity.IdentityStore
import com.voidhash.sdk.schema.RuntimeProductDefinition
import com.voidhash.sdk.schema.RuntimeSchema
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject

private const val PROCESSED_TRANSACTION_TTL_MS = 1000L * 60 * 30

private class InFlightTransaction {
    val deferred = CompletableDeferred<Unit>()
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
    private val onPersonRefresh: suspend () -> Unit = {},
    private val onWarning: (String) -> Unit = {},
) {
    private val inFlightTransactions = mutableMapOf<String, InFlightTransaction>()

    // The observer callback processes transactions on its own coroutine, so the
    // registry and the entry flags are reached from several threads; both the
    // lookups and the check-then-act flag transitions run under this mutex.
    private val inFlightMutex = Mutex()

    /** Queries the store for every product configured in [schema]. */
    suspend fun getProducts(schema: RuntimeSchema): List<VoidhashProduct> {
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
    suspend fun purchase(product: VoidhashProduct, schema: RuntimeSchema): VoidhashTransaction {
        // Pinned at purchase start: a purchase this SDK owns must still be
        // finished with the store even if the app flips to observer mode while
        // the store sheet is open.
        val readOnlyAtPurchaseStart = readOnlyProvider()
        val distinctId = identityStore.getDistinctId()

        val type = if (product.isSubscription) BillingProductType.SUBS else BillingProductType.INAPP
        if (type == BillingProductType.SUBS && product.googlePlayOfferToken == null) {
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

        val transaction = mapBillingPurchaseToTransaction(purchase)
        when (transaction.purchaseState) {
            "purchased" -> Unit
            "pending" -> throw VoidhashException("PURCHASE_PENDING", "The payment was deferred")
            else -> throw VoidhashException(
                "PURCHASE_UNKNOWN_RESULT",
                "Google Billing returned an unknown state",
            )
        }

        processTransaction(transaction, schema, readOnlyAtPurchaseStart)
        refreshPerson("a purchase")
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
     * app has already granted.
     */
    suspend fun reconcileObservedTransactions(schema: RuntimeSchema) {
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
                processTransaction(transaction, schema, null)
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

    /** Processes one observed transaction and refreshes the person snapshot. */
    suspend fun processObservedTransaction(transaction: VoidhashTransaction, schema: RuntimeSchema) {
        processTransaction(transaction, schema, null)
        refreshPerson("an observed transaction")
    }

    /**
     * Syncs [transaction] to the backend and — unless the SDK is in observer
     * mode — finishes it with the store.
     *
     * [readOnlyOverride] pins the ownership decision for a purchase this SDK
     * started; every other caller passes `null` and reads the live flag at the
     * moment the decision is made.
     */
    suspend fun processTransaction(
        transaction: VoidhashTransaction,
        schema: RuntimeSchema,
        readOnlyOverride: Boolean?,
    ) {
        if (transaction.purchaseState != "purchased") {
            return
        }

        val processingKey = transaction.processingKey
        val processedCacheKey = "processed-transaction:$processingKey"

        val claim = claimTransaction(processingKey, readOnlyOverride)
        if (!claim.isOwner) {
            // Rethrows the owner's failure: a joiner must never read a failed —
            // or cancelled — run as a synced, finished transaction.
            claim.entry.deferred.await()
            if (readOnlyOverride == false && takeStoreFinalizationPending(claim.entry)) {
                finalizeWithStore(transaction, schema, processedCacheKey)
            }
            return
        }

        try {
            runTransaction(transaction, schema, readOnlyOverride, claim.entry, processedCacheKey)
            claim.entry.deferred.complete(Unit)
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
    ) {
        val cachedState = readProcessedState(processedCacheKey)
        if (cachedState?.storeFinalized == true) {
            return
        }

        if (transaction.purchaseToken.isNullOrEmpty()) {
            onWarning(
                "Skipping observed Android transaction without purchase token ${transaction.transactionId}",
            )
            return
        }

        if (cachedState?.backendAccepted != true) {
            val distinctId = identityStore.getDistinctId()
            val accepted = apiClient.syncTransaction(
                distinctId,
                SyncTransactionRequest(
                    appAccountToken = transaction.appAccountToken,
                    providerProductId = transaction.productId,
                    productSlug = resolveProductSlug(transaction, schema),
                    purchaseDate = transaction.purchaseDate,
                    purchaseToken = transaction.purchaseToken,
                    quantity = transaction.quantity,
                    receipt = transaction.receipt,
                    transactionId = transaction.transactionId,
                ),
            )
            if (!accepted) {
                throw VoidhashException(
                    "TRANSACTION_VERIFICATION_FAILED",
                    "Backend rejected transaction ${transaction.transactionId}",
                )
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
            return
        }

        finalizeWithStore(transaction, schema, processedCacheKey)
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
            definition.providers.googlePlay?.productId == transaction.productId
    }

    private fun resolveProductSlug(transaction: VoidhashTransaction, schema: RuntimeSchema): String =
        resolveProductDefinition(transaction, schema)?.slug ?: transaction.productId

    private fun readProcessedState(cacheKey: String): ProcessedTransactionState? {
        val cached = cacheManager.getObject(cacheKey) ?: return null
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
