package com.voidhash.sdk.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import com.voidhash.sdk.ScreenTrackingOptions
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.analytics.LifecycleTracker
import com.voidhash.sdk.analytics.activityScreenView

private const val FRAGMENT_ACTIVITY_CLASS = "androidx.fragment.app.FragmentActivity"

/**
 * The one set of activity callbacks a configured SDK installs: foreground
 * transitions for the `$app_*` events and activity (optionally fragment)
 * arrivals for `$screen`.
 *
 * Reads the client lazily so it never outlives a re-configured singleton by
 * holding on to the old client.
 */
internal class VoidhashActivityLifecycleCallbacks(
    private val clientProvider: () -> VoidhashClient?,
    private val screenTracking: ScreenTrackingOptions,
    private val lifecycleTracker: LifecycleTracker = LifecycleTracker(),
    private val isFragmentActivityAvailable: () -> Boolean = ::hasFragmentActivity,
) : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        if (!screenTracking.automatic || !screenTracking.fragments) return
        if (!isFragmentActivityAvailable()) return
        if (FragmentScreenTracking.register(activity, clientProvider)) {
            clientProvider()?.suppressActivityScreens()
        }
    }

    override fun onActivityStarted(activity: Activity) {
        lifecycleTracker.activityStarted()?.let { clientProvider()?.captureAutomaticEvent(it) }
    }

    override fun onActivityResumed(activity: Activity) {
        if (!screenTracking.automatic) return
        val client = clientProvider() ?: return
        if (client.activityScreensSuppressed) return
        client.trackScreen(
            activityScreenView(
                identity = System.identityHashCode(activity),
                simpleName = activity.javaClass.simpleName,
                title = activity.title,
            ),
        )
    }

    override fun onActivityPaused(activity: Activity) {}

    override fun onActivityStopped(activity: Activity) {
        lifecycleTracker.activityStopped(activity.isChangingConfigurations)?.let {
            clientProvider()?.captureAutomaticEvent(it)
        }
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

    override fun onActivityDestroyed(activity: Activity) {}
}

private fun hasFragmentActivity(): Boolean =
    runCatching { Class.forName(FRAGMENT_ACTIVITY_CLASS) }.isSuccess
