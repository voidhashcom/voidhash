package com.voidhash.core.billing

import android.Manifest
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference

/**
 * What an SDK configured in the process contributes to the background check.
 *
 * @property deliverReceipts sends the receipts the SDK still holds to its backend, so a purchase it
 *   accepts is finished the usual way rather than on the device. The check waits for it at most
 *   [PlayFinishJob.DELIVERY_TIMEOUT_MS].
 * @property onFinishedLocally told about each purchase the check finished on the device.
 * @property onWarning receives what the check and its scheduling run into. The check itself
 *   writes nothing to logcat, so without a configured SDK nothing is reported.
 */
class PlayFinishHooks(
    val deliverReceipts: suspend () -> Unit,
    val onFinishedLocally: (UnfinishedPurchase) -> Unit,
    val onWarning: (String) -> Unit = {},
)

/**
 * Keeps the purchases the SDK started from being refunded by Google Play when its backend cannot
 * be reached.
 *
 * Play refunds a purchase nobody acknowledged within three days, and the SDK finishes a purchase
 * only once its backend accepted the receipt, which it sends only while the app runs. A buyer who
 * purchases during an outage and does not open the app again would be refunded. So each purchase
 * the SDK owns is recorded in an [UnfinishedPurchaseStore] when Play reports it, or when the SDK
 * finds it among the purchases Play lists after an answer it never got, and a JobScheduler
 * job checks it every few hours while the device has a network, until Play reports it finished:
 * it lets a configured SDK deliver its receipts first, then acknowledges on the device whatever
 * is still unacknowledged halfway through Play's window after the purchase was paid
 * ([localFinishAfterMs]: a day and a half, less for a prepaid plan shorter than a week) — never consumes, so
 * the purchase stays on Play's list for the SDK's next scan. A receipt the SDK still holds is
 * delivered afterwards, and the SDK consumes a consumable once its backend recorded it; only
 * Play's automatic refund no longer covers a purchase the backend never records. A record is
 * dropped once Play's window has closed, or when a payment never came.
 *
 * The job needs [PlayFinishJobService] in the app's manifest, which the SDK's manifest declares.
 * It is persisted across reboots when the app holds `RECEIVE_BOOT_COMPLETED`, which the SDK's
 * manifest asks for, and is scheduled again on every store connection otherwise.
 */
object PlayFinishJob {
    /**
     * The job's id. JobScheduler ids are shared by everything in the app — its own jobs,
     * WorkManager's, other libraries' — so from API 34 the job lives in its own [NAMESPACE], where
     * no other id can meet it. Below that this fixed id, spelling "vhpf", sits far above the small
     * and sequential ids apps and WorkManager hand out; a job of someone else's found under it is
     * left alone (see [scheduleIfNeeded]).
     */
    const val JOB_ID = 0x76687066

    /** The JobScheduler namespace of the job from API 34 on. */
    const val NAMESPACE = "com.voidhash.play-finish"

    /** How long a check waits for [PlayFinishHooks.deliverReceipts]. */
    const val DELIVERY_TIMEOUT_MS = 30_000L

    private val hooks = AtomicReference<PlayFinishHooks?>(null)

    /** The store of unfinished purchases of the app [context] belongs to. */
    fun store(context: () -> Context?): UnfinishedPurchaseStore =
        UnfinishedPurchaseStore { context()?.let { File(it.noBackupFilesDir, "voidhash/unfinished-purchases.tsv") } }

    /** The hooks of the SDK the check works with, if one is configured in this process. */
    val registeredHooks: PlayFinishHooks? get() = hooks.get()

    /** Makes [registered] the SDK the check works with, replacing any earlier one. */
    fun register(registered: PlayFinishHooks) {
        hooks.set(registered)
    }

    /** Stops working with [registered], unless another SDK registered since. */
    fun unregister(registered: PlayFinishHooks) {
        hooks.compareAndSet(registered, null)
    }

    /** Reports [message] to the SDK configured in this process, if any. */
    internal fun warn(message: String) {
        hooks.get()?.onWarning?.invoke(message)
    }

    /** How long the check waits for each Google Play call. */
    internal const val PLAY_CALL_TIMEOUT_MS = 30_000L

    /** Set while a check runs in this process, which only its own end reschedules or cancels. */
    internal val running = AtomicBoolean(false)

    /**
     * Makes sure a check is scheduled while [store] holds records, for a host: after a buy recorded
     * one, on a store connection, and after a record was forgotten. A check already scheduled — or
     * running, which JobScheduler counts as pending — is left as it is, since scheduling the same id
     * would stop a running check, and only the check itself moves its own time. With nothing left
     * the pending check is cancelled, unless it is running here. Does IO and a system call; run it
     * off the main thread. Never throws: a job that cannot be scheduled is retried by the next
     * store connection.
     */
    fun scheduleIfNeeded(context: Context, store: UnfinishedPurchaseStore = store { context }) {
        synchronized(scheduleLock) {
            // A check running here reads the store again as it ends, under this lock, and
            // schedules for what it finds then, this change included.
            if (running.get()) return
            withOwnJob(context) { scheduler, pending ->
                val records = store.all()
                when {
                    records.isEmpty() -> if (pending != null) scheduler.cancel(JOB_ID)
                    pending == null -> schedule(context, scheduler, records)
                }
            }
        }
    }

    /**
     * Schedules the next check for what [store] holds as a check ends, replacing the one running,
     * and ends the check's [running] state. With nothing left, nothing is scheduled.
     */
    internal fun rescheduleAfterCheck(context: Context, store: UnfinishedPurchaseStore = store { context }) {
        synchronized(scheduleLock) {
            running.set(false)
            withOwnJob(context) { scheduler, _ ->
                val records = store.all()
                if (records.isNotEmpty()) schedule(context, scheduler, records)
            }
        }
    }

    /** Orders a host's [scheduleIfNeeded] against the end of a check; see [rescheduleAfterCheck]. */
    private val scheduleLock = Any()

    /**
     * Runs [block] with the job scheduler and the check pending under [JOB_ID], when the id is not
     * another component's. Reports and swallows every failure: a missing service declaration or a
     * system refusal must not fail a store call.
     */
    private fun withOwnJob(context: Context, block: (JobScheduler, JobInfo?) -> Unit) {
        try {
            val scheduler = jobScheduler(context) ?: return
            val existing = scheduler.allPendingJobs.firstOrNull { it.id == JOB_ID }
            if (existing != null && existing.service?.className != PlayFinishJobService::class.java.name) {
                warn("Job id $JOB_ID is taken by ${existing.service}; not scheduling the purchase check")
                return
            }
            block(scheduler, existing)
        } catch (error: Exception) {
            warn("Could not schedule the purchase check: ${error.message}")
        }
    }

    /**
     * Schedules the check for when it is next due, with a network. No deadline is set on the job:
     * past an override deadline the system runs a job whether or not its other requirements are
     * met, the network included, and a check without one can do nothing. A deadline does not lift
     * the deferral of a rarely used app's jobs either; [localFinishAfterMs] leaves half of Play's window for it.
     */
    private fun schedule(context: Context, scheduler: JobScheduler, records: List<UnfinishedPurchase>) {
        val next = nextFinishCheckAt(records, System.currentTimeMillis()) ?: return
        val bootPermission = context.checkSelfPermission(Manifest.permission.RECEIVE_BOOT_COMPLETED) ==
            PackageManager.PERMISSION_GRANTED
        val job = JobInfo.Builder(JOB_ID, ComponentName(context, PlayFinishJobService::class.java))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setMinimumLatency(maxOf(0L, next - System.currentTimeMillis()))
            .setPersisted(bootPermission)
            .build()
        scheduler.schedule(job)
    }

    private fun jobScheduler(context: Context): JobScheduler? {
        val scheduler = context.getSystemService(Context.JOB_SCHEDULER_SERVICE) as? JobScheduler ?: return null
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) scheduler.forNamespace(NAMESPACE) else scheduler
    }

    /** One check, as the job runs it. */
    internal suspend fun run(context: Context) {
        val store = store { context }
        val engine = BillingEngine(
            contextProvider = { context },
            activityProvider = { null },
            onWarning = ::warn,
            unfinishedPurchases = store,
        )
        try {
            checkPurchases(store, engine, hooks.get())
        } finally {
            runCatching { engine.endConnection() }
        }
    }

    /**
     * One check over [store]: [registered] delivers its receipts first, then the records read
     * before Play was asked are planned against what Play reports through [engine], the due ones
     * are acknowledged, and only then is the store updated, best effort. A record written while
     * Play was asked is left for the next check.
     */
    internal suspend fun checkPurchases(
        store: UnfinishedPurchaseStore,
        engine: BillingEngine,
        registered: PlayFinishHooks?,
        now: () -> Long = System::currentTimeMillis,
    ) {
        val warn = registered?.onWarning ?: {}
        val records = try {
            store.all()
        } catch (error: IOException) {
            warn("Could not read the unfinished purchases: ${error.message}")
            return
        }
        if (records.isEmpty()) return
        if (registered != null) {
            try {
                withTimeoutOrNull(DELIVERY_TIMEOUT_MS) { registered.deliverReceipts() }
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                warn("Delivering receipts before the purchase check failed: ${error.message}")
            }
        }

        val owned = try {
            withTimeoutOrNull(PLAY_CALL_TIMEOUT_MS) {
                (engine.getAvailableItemsByType(BillingProductType.INAPP) + engine.getAvailableItemsByType(BillingProductType.SUBS))
                    .associate { it.purchaseToken to ownedPurchaseOf(it) }
            }
        } catch (error: BillingEngineException) {
            warn("Could not read purchases from Google Play: ${error.message}")
            null
        }
        val plan = planUnfinishedPurchases(records, owned, now())
        // Only ever acknowledged, consumables too: a consumed purchase leaves Play's list, and with
        // it any trace a later scan could deliver to the backend.
        for (record in plan.acknowledge) {
            val result = try {
                withTimeoutOrNull(PLAY_CALL_TIMEOUT_MS) { engine.acknowledgePurchase(record.purchaseToken) }
            } catch (error: BillingEngineException) {
                warn("Could not acknowledge a purchase on the device: ${error.message}")
                null
            }
            if (result?.responseCode == 0.0) runCatching { registered?.onFinishedLocally?.invoke(record) }
        }
        try {
            store.update(paidNow = plan.paidNow, stillPending = plan.stillPending, now = now())
            store.remove(plan.clear)
        } catch (error: IOException) {
            warn("Could not update the unfinished purchases: ${error.message}")
        }
    }
}

/**
 * Runs [PlayFinishJob]'s check. Declared in the SDK's manifest with `BIND_JOB_SERVICE`; the app
 * never starts it itself.
 */
class PlayFinishJobService : JobService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Set once the check rescheduled itself, which stops this run as it finishes. */
    private val rescheduled = AtomicBoolean(false)

    override fun onStartJob(params: JobParameters): Boolean {
        PlayFinishJob.running.set(true)
        rescheduled.set(false)
        scope.launch {
            try {
                PlayFinishJob.run(applicationContext)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                PlayFinishJob.warn("The purchase check failed: ${error.message}")
            } finally {
                // Rescheduled before the run is reported finished: once it is, the system may stop
                // the process before another line runs. Scheduling the id stops this run, which is
                // over anyway.
                rescheduled.set(true)
                PlayFinishJob.rescheduleAfterCheck(applicationContext)
                jobFinished(params, false)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        scope.coroutineContext.cancelChildren()
        PlayFinishJob.running.set(false)
        // Stopped by its own rescheduling, the next check is already scheduled.
        return !rescheduled.get()
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
