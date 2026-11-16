package com.voidhash.sdk.platform

import android.app.Activity
import android.app.Application
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.UserManager
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Whether the app's private storage is available: the device was unlocked at least once since it
 * started. Before that, in a process Android starts for a `directBootAware` component, opening
 * the SDK's preferences throws and its queue files look as if they did not exist. Direct Boot
 * exists from API 24; a platform that cannot say counts as unlocked.
 */
internal fun isUserUnlocked(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return true
    val users = context.getSystemService(Context.USER_SERVICE) as? UserManager ?: return true
    return runCatching { users.isUserUnlocked }.getOrDefault(true)
}

/**
 * Runs [action] once, on the main thread, when the device is unlocked for the first time since it
 * started. Returns what stops waiting for it, or `null` when Android refused the receiver, so that
 * nothing will announce the unlock: see [whenStartedUnlocked] for what still can. An unlock
 * between a check of [isUserUnlocked] and this call is not seen: check again after it.
 */
internal fun whenUserUnlocked(context: Context, action: () -> Unit): (() -> Unit)? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return {}
    val done = AtomicBoolean(false)
    val receiver = object : BroadcastReceiver() {
        override fun onReceive(receiverContext: Context, intent: Intent) {
            if (!done.compareAndSet(false, true)) return
            runCatching { context.unregisterReceiver(this) }
            action()
        }
    }
    val filter = IntentFilter(Intent.ACTION_USER_UNLOCKED)
    val registered = runCatching {
        // Only the system sends this broadcast, which a receiver that is not exported still gets.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
    }.isSuccess
    if (!registered) return null
    return {
        if (done.compareAndSet(false, true)) runCatching { context.unregisterReceiver(receiver) }
    }
}

/**
 * Runs [action] once, on the main thread, when an activity of the app next starts while
 * [isUnlocked] answers that the device is unlocked: what is left when [whenUserUnlocked] cannot
 * watch for the unlock itself. An app's activities start only once the device is unlocked, unless
 * it marks them `directBootAware`. Returns what stops waiting for it; without an [Application] to
 * watch, nothing is waited for.
 */
internal fun whenStartedUnlocked(context: Context, isUnlocked: () -> Boolean, action: () -> Unit): () -> Unit {
    val application = context.applicationContext as? Application ?: return {}
    val done = AtomicBoolean(false)
    val callbacks = object : Application.ActivityLifecycleCallbacks {
        override fun onActivityStarted(activity: Activity) {
            if (!isUnlocked() || !done.compareAndSet(false, true)) return
            application.unregisterActivityLifecycleCallbacks(this)
            action()
        }

        override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}

        override fun onActivityResumed(activity: Activity) {}

        override fun onActivityPaused(activity: Activity) {}

        override fun onActivityStopped(activity: Activity) {}

        override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

        override fun onActivityDestroyed(activity: Activity) {}
    }
    application.registerActivityLifecycleCallbacks(callbacks)
    return {
        if (done.compareAndSet(false, true)) application.unregisterActivityLifecycleCallbacks(callbacks)
    }
}
