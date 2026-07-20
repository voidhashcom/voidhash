package com.margelo.nitro.voidhash.measurement

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.os.Bundle
import java.security.MessageDigest
import java.time.Instant
import java.util.Collections
import java.util.UUID
import java.util.WeakHashMap
import java.util.concurrent.atomic.AtomicBoolean

/** Captures Android deep-link intents into the encrypted, pre-JavaScript inbox. */
object VoidhashLinkCollector {
    private const val DEDUPE_WINDOW_MS = 30_000L
    private val installed = AtomicBoolean(false)
    private val observedIntents = Collections.newSetFromMap(WeakHashMap<Intent, Boolean>())

    /** Installs lifecycle capture once for the process. */
    @JvmStatic
    fun install(context: Context) {
        val application = context.applicationContext as? Application ?: return
        if (!installed.compareAndSet(false, true)) return
        application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, state: Bundle?) {
                captureIntent(activity, activity.intent, if (state == null) "cold" else "warm")
            }

            override fun onActivityResumed(activity: Activity) {
                captureIntent(activity, activity.intent, "foreground")
            }

            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityPaused(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    /** Captures an initial or `onNewIntent` link without requiring a resumed activity. */
    @JvmStatic
    fun captureIntent(context: Context, intent: Intent?, appState: String = "warm"): Boolean {
        intent ?: return false
        synchronized(observedIntents) {
            if (!observedIntents.add(intent)) return false
        }
        val raw = intent.dataString ?: return false
        val source = if (intent.data?.scheme.equals("http", true) || intent.data?.scheme.equals("https", true)) {
            "appLink"
        } else {
            "customScheme"
        }
        val store = MeasurementStore(context)
        return try {
            capture(store, raw, source, appState)
        } finally {
            store.close()
        }
    }

    internal fun capture(
        store: MeasurementStore,
        raw: String,
        source: String,
        appState: String,
        nowMs: Long = System.currentTimeMillis(),
    ): Boolean {
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray())
            .joinToString("") { "%02x".format(it) }
        if (!store.checkAndSetDedupe("native-link-capture", digest, nowMs + DEDUPE_WINDOW_MS)) return false
        val blobId = "link-${UUID.randomUUID()}"
        store.putProtectedEvidence(
            blobId = blobId,
            purpose = "link-capture",
            consentRevision = 0,
            retentionClass = "installation",
            value = raw.toByteArray(),
        )
        val entryId = "inbox-${UUID.randomUUID()}"
        return store.appendInbox(
            id = entryId,
            kind = "link",
            source = source,
            appState = appState,
            receivedAt = Instant.ofEpochMilli(nowMs).toString(),
            protectedPayloadRef = blobId,
        )
    }
}
