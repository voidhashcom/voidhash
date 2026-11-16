package com.voidhash.sdk.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import com.voidhash.sdk.ScreenTrackingOptions
import com.voidhash.sdk.VoidhashClient
import com.voidhash.sdk.analytics.LifecycleTracker
import com.voidhash.sdk.analytics.activityScreenView
import java.util.Collections
import java.util.WeakHashMap

private const val FRAGMENT_ACTIVITY_CLASS = "androidx.fragment.app.FragmentActivity"

/**
 * The one set of activity callbacks a configured SDK installs: foreground
 * transitions for the `$app_*` events and activity (optionally fragment)
 * arrivals for `$screen`.
 *
 * Reads the client lazily so it never outlives a re-configured singleton by
 * holding on to the old client.
 *
 * @param postAfterResume runs a task once the activity's resume has settled; by default after
 *   the decor view's next traversal, when a Compose tracker attached in the first frame has
 *   already taken over the activity's screen. An activity without content runs it at once.
 */
internal class VoidhashActivityLifecycleCallbacks(
    private val clientProvider: () -> VoidhashClient?,
    private val screenTracking: ScreenTrackingOptions,
    private val lifecycleTracker: LifecycleTracker = LifecycleTracker(),
    private val isFragmentActivityAvailable: () -> Boolean = ::hasFragmentActivity,
    private val postAfterResume: (Activity, Runnable) -> Unit = { activity, task ->
        activity.window?.peekDecorView()?.post(task) ?: task.run()
    },
) : Application.ActivityLifecycleCallbacks {
    /** Activities showing a tracked fragment, which is reported as the screen instead of them. */
    private val fragmentHosts: MutableSet<Activity> =
        Collections.synchronizedSet(Collections.newSetFromMap(WeakHashMap()))

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        if (!screenTracking.automatic || !screenTracking.fragments) return
        if (!isFragmentActivityAvailable()) return
        FragmentScreenTracking.register(activity, clientProvider) { fragmentHosts.add(activity) }
    }

    override fun onActivityStarted(activity: Activity) {
        val client = clientProvider()
        lifecycleTracker.activityStarted()?.let { client?.captureAutomaticEvent(it) }
        // The foreground transition is also the SDK's cue to run its retry timer, half-open the
        // circuit breaker and refresh, independent of whether the host wants the lifecycle events.
        client?.onAppForegrounded()
    }

    override fun onActivityResumed(activity: Activity) {
        if (!screenTracking.automatic || activity.isFinishing) return
        // Deferred: fragments resume after the activity does, and a Compose tracker attaches in
        // the first frame; either one is the screen instead of the activity hosting it.
        postAfterResume(activity) {
            val client = clientProvider() ?: return@postAfterResume
            if (activity.isFinishing || client.activityScreensSuppressed || activity in fragmentHosts) {
                return@postAfterResume
            }
            client.trackScreen(
                activityScreenView(
                    identity = System.identityHashCode(activity),
                    simpleName = activity.javaClass.simpleName,
                    title = activity.title,
                ),
            )
        }
    }

    override fun onActivityPaused(activity: Activity) {}

    override fun onActivityStopped(activity: Activity) {
        val client = clientProvider()
        lifecycleTracker.activityStopped(activity.isChangingConfigurations)?.let {
            client?.captureAutomaticEvent(it)
        }
        // Backgrounding closes the persist-behind window: anything captured in the last
        // 250 ms has to be on disk before the process can be killed.
        client?.persistQueuedEvents()
        if (!lifecycleTracker.isInForeground) client?.onAppBackgrounded()
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

    override fun onActivityDestroyed(activity: Activity) {
        fragmentHosts.remove(activity)
    }
}

private fun hasFragmentActivity(): Boolean =
    runCatching { Class.forName(FRAGMENT_ACTIVITY_CLASS) }.isSuccess
