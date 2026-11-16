package com.voidhash.core.billing

import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/** How long Play gives a purchase to be acknowledged after its payment before it refunds it. */
internal const val ACKNOWLEDGEMENT_WINDOW_MS = 3 * 24 * 60 * 60_000L

/**
 * How long after a purchase was paid it may wait for its backend before it is acknowledged on the
 * device: half of Play's three days. That leaves a day and a half for the check to run. It needs
 * that much: the system puts the jobs of an app the user has not opened lately off by up to about
 * a day, and such an app is exactly the one whose buyer has not come back to let the SDK finish
 * the purchase the usual way. A prepaid plan shorter than a week gets less (see
 * [localFinishAfterMs]).
 */
internal const val LOCAL_FINISH_AFTER_MS = ACKNOWLEDGEMENT_WINDOW_MS / 2

/** A prepaid plan shorter than this has a window of half its duration instead of three days. */
internal const val SHORT_PREPAID_PLAN_MS = 7 * 24 * 60 * 60_000L

/**
 * The least time a purchase recorded from the store's list gets before it is acknowledged on the
 * device, counted from when it is recorded: Play's purchase time may be days older than the
 * payment, and the backend must get its chance to record the purchase first. A short prepaid plan
 * gets less (see [firstRecordGraceMs]).
 */
internal const val FIRST_RECORD_GRACE_MS = 4 * 60 * 60_000L

/**
 * How long Play gives a purchase to be acknowledged after its payment: three days, and half the
 * plan's duration for a prepaid plan shorter than a week ([prepaidPlanDurationMs]), such as twelve
 * hours for a one-day plan.
 */
internal fun acknowledgementWindowMs(prepaidPlanDurationMs: Long?): Long =
    if (prepaidPlanDurationMs != null && prepaidPlanDurationMs < SHORT_PREPAID_PLAN_MS) {
        prepaidPlanDurationMs / 2
    } else {
        ACKNOWLEDGEMENT_WINDOW_MS
    }

/**
 * How long after its payment a purchase is acknowledged on the device: halfway through Play's
 * window, [LOCAL_FINISH_AFTER_MS] for every purchase but a prepaid plan shorter than a week, whose
 * window is shorter. The other half is left for a check the system puts off.
 */
internal fun localFinishAfterMs(prepaidPlanDurationMs: Long?): Long = acknowledgementWindowMs(prepaidPlanDurationMs) / 2

/**
 * The least wait a purchase recorded from the store's list gets ([FIRST_RECORD_GRACE_MS]), cut to
 * an eighth of Play's window when that is shorter: an hour and a half for a one-day prepaid plan,
 * which a scan may find with little of its twelve hours left.
 */
internal fun firstRecordGraceMs(prepaidPlanDurationMs: Long?): Long =
    minOf(FIRST_RECORD_GRACE_MS, acknowledgementWindowMs(prepaidPlanDurationMs) / 8)

/**
 * The duration of a Play [billingPeriod], an ISO 8601 `PnD`, `PnW`, `PnM` or `PnY`, in
 * milliseconds, with a month as 30 days and a year as 365: only a duration under a week changes a
 * deadline, and those are exact. `null` for any other form.
 */
internal fun billingPeriodMs(billingPeriod: String): Long? {
    val match = Regex("^P(\\d{1,4})([DWMY])$").matchEntire(billingPeriod) ?: return null
    val count = match.groupValues[1].toLong()
    val days = when (match.groupValues[2]) {
        "D" -> count
        "W" -> 7 * count
        "M" -> 30 * count
        else -> 365 * count
    }
    return days * 24 * 60 * 60_000L
}

/** `ProductDetails.RecurrenceMode.NON_RECURRING`: the regular phase of a prepaid base plan. */
private const val NON_RECURRING = 3

/**
 * The duration of the prepaid base plan [offerToken] buys among [offers], a product's base plans
 * and offers as Play returned them: the billing period of the plan's regular phase, its last,
 * when that does not recur. `null` for an auto-renewing plan, a token Play did not return, or a
 * period that does not read.
 */
internal fun prepaidPlanDurationMs(offers: List<BillingSubscriptionOfferDetails>, offerToken: String?): Long? {
    val bought = offers.firstOrNull { it.offerToken == offerToken } ?: return null
    // An offer's phases end in its base plan's regular phase too; the base plan's own say it surely.
    val plan = offers.firstOrNull { it.basePlanId == bought.basePlanId && it.offerId == null } ?: bought
    val regular = plan.pricingPhases.lastOrNull()?.takeIf { it.recurrenceMode == NON_RECURRING } ?: return null
    return billingPeriodMs(regular.billingPeriod)
}

/**
 * The shortest prepaid base plan among [offers], for a purchase whose base plan is not known: a
 * purchase found on Play's list, which does not say. Its deadline is then the soonest any of the
 * product's plans can have, which only acknowledges an auto-renewing purchase sooner than needed.
 */
internal fun shortestPrepaidPlanDurationMs(offers: List<BillingSubscriptionOfferDetails>): Long? =
    offers.filter { it.offerId == null }.mapNotNull { prepaidPlanDurationMs(offers, it.offerToken) }.minOrNull()

/** How often the check runs while unfinished purchases remain. */
internal const val FINISH_CHECK_INTERVAL_MS = 4 * 60 * 60_000L

/** The wait before trying again after a check could not acknowledge a purchase that is due. */
internal const val FINISH_CHECK_RETRY_MS = 60 * 60_000L

/**
 * How long a paid purchase stays recorded. Past Play's three-day window acknowledging it can no
 * longer stop the refund, so retrying would only keep waking the app.
 */
internal const val PAID_RECORD_LIFETIME_MS = 4 * 24 * 60 * 60_000L

/** How long a purchase waiting for its payment stays recorded. */
internal const val PENDING_RECORD_LIFETIME_MS = 30 * 24 * 60 * 60_000L

/** `Purchase.PurchaseState.PURCHASED`. */
private const val PURCHASE_STATE_PURCHASED = 1.0

/**
 * A purchase the SDK started and owns, which Google Play has not reported acknowledged yet.
 *
 * @property recordedAt when it was recorded, epoch millis.
 * @property paidAt when it was paid, epoch millis, as early as the SDK can tell; `null` while its
 *   payment is pending. Play's three-day window starts with the payment, so the local deadline
 *   counts from here.
 * @property pendingSeenAt when a check last saw the payment pending; the payment came after it.
 * @property paidSeenAt when the payment was first seen made, epoch millis: the latest it can have
 *   been made. [paidAt] is the earliest, which the deadline needs; the record's lifetime counts
 *   from this one, so a purchase whose payment time is uncertain never expires before Play's
 *   window has closed.
 * @property prepaidPlanDurationMs the duration of the prepaid plan bought, in milliseconds; `null`
 *   for an auto-renewing plan or a one-time product. Play's window is shorter for a prepaid plan
 *   shorter than a week (see [acknowledgementWindowMs]).
 */
data class UnfinishedPurchase(
    val purchaseToken: String,
    val productId: String,
    val recordedAt: Long,
    val paidAt: Long?,
    val pendingSeenAt: Long? = null,
    val paidSeenAt: Long? = paidAt,
    val prepaidPlanDurationMs: Long? = null,
) {
    /**
     * When a payment first seen made at [now] was made at the latest: right after the last check
     * that saw it pending, while the device may have been offline, or right after it was recorded.
     */
    internal fun paidNoLaterThan(now: Long): Long = minOf(now, pendingSeenAt ?: recordedAt)

    /** This record once its payment was first seen made at [now]: earliest and latest payment time. */
    internal fun paidNow(now: Long): UnfinishedPurchase = copy(paidAt = paidNoLaterThan(now), paidSeenAt = now)

    /**
     * When the purchase is acknowledged on the device if nothing has acknowledged it by then:
     * [localFinishAfterMs] after its payment.
     */
    val localFinishAt: Long? get() = paidAt?.plus(localFinishAfterMs(prepaidPlanDurationMs))

    /** Whether the record is past any use: Play's window has closed, or the payment never came. */
    internal fun isExpired(now: Long): Boolean {
        val paidLatest = paidSeenAt ?: paidAt
        return if (paidLatest != null) now >= paidLatest + PAID_RECORD_LIFETIME_MS else now >= recordedAt + PENDING_RECORD_LIFETIME_MS
    }
}

/**
 * The durable list of [UnfinishedPurchase]s, one tab-separated line per purchase in [file].
 *
 * Every SDK flavour and the background check in the app's process read and write the same file,
 * so nothing is cached. The lock is per process and the temporary file has a fixed name, so two
 * processes of one app writing at once could race; the SDK runs in the main process only unless an
 * app opts into another, and the background check runs there too: each call reads it and each change rewrites it whole, synced to disk in a
 * temporary file that is renamed into place, under one process-wide lock. Calls do file IO; make
 * them off the main thread. A line that does not parse is dropped; a file that cannot be read, or
 * that a newer release wrote in a format this one does not know, throws [IOException] instead of
 * reading as empty, so no change overwrites the records in it.
 */
class UnfinishedPurchaseStore(private val file: () -> File?) {
    private companion object {
        val lock = Any()
        const val HEADER_PREFIX = "voidhash-unfinished-purchases v"
        const val VERSION = 5

        /** The format before records kept the prepaid plan's duration, still read as such. */
        const val VERSION_WITHOUT_PLAN = 4
    }

    /** Every purchase recorded and not finished yet. */
    fun all(): List<UnfinishedPurchase> = synchronized(lock) { read() }

    /**
     * Records [purchases]. A token recorded already keeps its record, which only learns a payment
     * it did not know of: recording the same purchase twice, from Play's update and from the buy
     * that returned it, never moves its clock. Returns whether anything changed.
     */
    fun record(purchases: List<UnfinishedPurchase>): Boolean {
        if (purchases.isEmpty()) return false
        return synchronized(lock) {
            val current = read()
            val byToken = current.associateBy { it.purchaseToken }
            val merged = current.map { existing ->
                val again = purchases.firstOrNull { it.purchaseToken == existing.purchaseToken }
                if (existing.paidAt == null && again?.paidAt != null) existing.paidNow(again.paidAt) else existing
            }
            val added = purchases.filter { it.purchaseToken !in byToken }.distinctBy { it.purchaseToken }
            val changed = added.isNotEmpty() || merged != current
            if (changed) write(merged + added)
            changed
        }
    }

    /**
     * Applies what a check or Play's update learnt: the purchases of [paidNow] were seen paid at
     * [now] (see [UnfinishedPurchase.paidNow]), unless they were known paid already, and
     * [stillPending] were seen pending at [now]. Records written since the caller read the store
     * are kept as they are.
     */
    fun update(paidNow: Collection<String> = emptyList(), stillPending: Collection<String> = emptyList(), now: Long) {
        if (paidNow.isEmpty() && stillPending.isEmpty()) return
        synchronized(lock) {
            val current = read()
            val updated = current.map { record ->
                when {
                    record.purchaseToken in paidNow && record.paidAt == null -> record.paidNow(now)
                    record.purchaseToken in stillPending -> record.copy(pendingSeenAt = now)
                    else -> record
                }
            }
            if (updated != current) write(updated)
        }
    }

    /** Forgets the purchases of [tokens]; returns whether any was recorded. */
    fun remove(tokens: Collection<String>): Boolean = synchronized(lock) {
        if (tokens.isEmpty()) return@synchronized false
        val current = read()
        val remaining = current.filterNot { it.purchaseToken in tokens }
        if (remaining.size == current.size) return@synchronized false
        write(remaining)
        true
    }

    /**
     * Reads the records. A file a newer release wrote, in a format this one does not know, throws,
     * so nothing here overwrites what that release keeps in it; so does a file that cannot be read.
     * A file without a header of ours, or of a format older than [VERSION_WITHOUT_PLAN], is garbled
     * or obsolete and reads as empty, so the next write replaces it instead of recording being off
     * for good. One of [VERSION_WITHOUT_PLAN] reads with no prepaid plan, as it was written.
     */
    private fun read(): List<UnfinishedPurchase> {
        val target = file() ?: return emptyList()
        if (!target.exists()) return emptyList()
        val lines = target.readLines()
        val version = lines.firstOrNull()?.takeIf { it.startsWith(HEADER_PREFIX) }?.removePrefix(HEADER_PREFIX)?.toIntOrNull()
        if (version != null && version > VERSION) throw IOException("$target was written by a newer release")
        val fieldCount = when (version) {
            VERSION -> 7
            VERSION_WITHOUT_PLAN -> 6
            else -> return emptyList()
        }
        return lines.drop(1).mapNotNull { line ->
            val fields = line.split('\t')
            if (fields.size != fieldCount || fields[0].isEmpty()) return@mapNotNull null
            val recordedAt = fields[2].toLongOrNull() ?: return@mapNotNull null
            val paidAt = optionalLong(fields[3]) ?: return@mapNotNull null
            val pendingSeenAt = optionalLong(fields[4]) ?: return@mapNotNull null
            val paidSeenAt = optionalLong(fields[5]) ?: return@mapNotNull null
            val prepaidPlan = if (fieldCount == 7) optionalLong(fields[6]) ?: return@mapNotNull null else Optional(null)
            UnfinishedPurchase(fields[0], fields[1], recordedAt, paidAt.value, pendingSeenAt.value, paidSeenAt.value, prepaidPlan.value)
        }
    }

    /** An optional number field: empty for none; `null` when it does not parse. */
    private class Optional(val value: Long?)

    private fun optionalLong(field: String): Optional? =
        if (field.isEmpty()) Optional(null) else field.toLongOrNull()?.let { Optional(it) }

    private fun write(purchases: List<UnfinishedPurchase>) {
        val target = file() ?: throw IOException("No directory to keep unfinished purchases in")
        if (purchases.isEmpty()) {
            if (target.exists() && !target.delete()) throw IOException("Could not delete $target")
            return
        }
        target.parentFile?.mkdirs()
        val temporary = File(target.parentFile, target.name + ".tmp")
        val lines = purchases.map {
            listOf(
                it.purchaseToken, it.productId, it.recordedAt, it.paidAt ?: "", it.pendingSeenAt ?: "", it.paidSeenAt ?: "",
                it.prepaidPlanDurationMs ?: "",
            ).joinToString("\t")
        }
        val text = (listOf("$HEADER_PREFIX$VERSION") + lines)
            .joinToString("\n", postfix = "\n")
        // Synced before the rename, as `AtomicFile` does, so a power cut cannot leave the rename
        // pointing at data still in the page cache.
        FileOutputStream(temporary).use { out ->
            out.write(text.toByteArray())
            out.fd.sync()
        }
        if (!temporary.renameTo(target)) {
            temporary.delete()
            throw IOException("Could not replace $target")
        }
    }
}

/** What Google Play reports for an owned purchase, as far as finishing it goes. */
internal data class OwnedPurchase(val isAcknowledged: Boolean, val isPurchased: Boolean)

/**
 * What one check does: [clear] the records that need nothing more, note the payments it first sees
 * ([paidNow]) and the payments still [stillPending], and [acknowledge] the ones past their
 * [UnfinishedPurchase.localFinishAt].
 */
internal data class FinishPlan(
    val clear: List<String> = emptyList(),
    val paidNow: List<String> = emptyList(),
    val stillPending: List<String> = emptyList(),
    val acknowledge: List<UnfinishedPurchase> = emptyList(),
)

/**
 * Decides what to do with each unfinished purchase, given what Google Play reports it owns.
 *
 * An expired record is cleared whatever Play says. One Play lists as acknowledged is safe from the
 * refund and cleared. A pending one Play no longer lists was cancelled and is cleared. A paid one
 * Play does not list is kept until it expires: Play lists only the purchases of the account signed
 * in now, so a user who switched Google accounts for a while would otherwise lose the record of a
 * purchase still waiting to be acknowledged. A purchase still waiting for payment is kept, and the
 * time noted. A paid one is noted as paid when first seen so — at the latest right after the check
 * that last saw it pending — and acknowledged once its local finish time has come. With [owned]
 * `null` — Play could not be asked — only expired records are cleared.
 */
internal fun planUnfinishedPurchases(
    records: List<UnfinishedPurchase>,
    owned: Map<String, OwnedPurchase>?,
    now: Long,
): FinishPlan {
    val clear = mutableListOf<String>()
    val paidNow = mutableListOf<String>()
    val stillPending = mutableListOf<String>()
    val acknowledge = mutableListOf<UnfinishedPurchase>()
    for (record in records) {
        val token = record.purchaseToken
        if (record.isExpired(now)) {
            clear += token
            continue
        }
        if (owned == null) continue
        val state = owned[token]
        when {
            state == null -> if (record.paidAt == null) clear += token
            state.isAcknowledged -> clear += token
            !state.isPurchased -> stillPending += token
            else -> {
                val known = if (record.paidAt != null) record else record.paidNow(now).also { paidNow += token }
                val finishAt = known.localFinishAt
                if (finishAt != null && now >= finishAt) acknowledge += known
            }
        }
    }
    return FinishPlan(clear, paidNow, stillPending, acknowledge)
}

/**
 * When the next check is due for [remaining] records: every [FINISH_CHECK_INTERVAL_MS], or at the
 * earliest local finish time if that comes sooner, and [FINISH_CHECK_RETRY_MS] from now for one
 * whose time has passed without it being acknowledged. A purchase waiting for its payment is
 * checked at the usual interval. `null` when nothing remains.
 */
internal fun nextFinishCheckAt(remaining: List<UnfinishedPurchase>, now: Long): Long? {
    if (remaining.isEmpty()) return null
    val earliest = remaining.minOf { record ->
        val finishAt = record.localFinishAt
        when {
            finishAt == null -> now + FINISH_CHECK_INTERVAL_MS
            finishAt > now -> finishAt
            else -> now + FINISH_CHECK_RETRY_MS
        }
    }
    return minOf(now + FINISH_CHECK_INTERVAL_MS, earliest)
}

/**
 * The record of [purchase], of a prepaid plan of [prepaidPlanDurationMs] if it is one, or `null`
 * for a purchase there is nothing to finish.
 */
internal fun unfinishedPurchaseOf(purchase: BillingPurchase, now: Long, prepaidPlanDurationMs: Long? = null): UnfinishedPurchase? {
    // A suspended subscription grants nothing and is never acknowledged.
    if (purchase.isAcknowledged || purchase.isSuspended || purchase.purchaseToken.isEmpty()) return null
    val paidAt = if (purchase.purchaseState == PURCHASE_STATE_PURCHASED) now else null
    return UnfinishedPurchase(
        purchase.purchaseToken, purchase.id, recordedAt = now, paidAt = paidAt, paidSeenAt = paidAt,
        prepaidPlanDurationMs = prepaidPlanDurationMs,
    )
}

/** What [planUnfinishedPurchases] needs to know about [purchase]. */
internal fun ownedPurchaseOf(purchase: BillingPurchase): OwnedPurchase =
    OwnedPurchase(isAcknowledged = purchase.isAcknowledged, isPurchased = purchase.purchaseState == PURCHASE_STATE_PURCHASED)
