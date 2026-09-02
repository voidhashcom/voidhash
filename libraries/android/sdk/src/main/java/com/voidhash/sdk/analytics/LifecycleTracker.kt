package com.voidhash.sdk.analytics

/**
 * Derives app-level foreground transitions from activity start/stop counts.
 *
 * The app is in the foreground while at least one activity is started. The
 * first foreground entry of the process is not reported: `$app_opened` already
 * covers it, so `$app_became_active` only follows an observed background.
 */
class LifecycleTracker {
    private var startedActivities = 0
    private var backgroundObserved = false
    private var skipNextStart = false

    /** Records an activity start; returns the event to capture, if any. */
    @Synchronized
    fun activityStarted(): String? {
        if (skipNextStart) {
            skipNextStart = false
            return null
        }
        startedActivities += 1
        if (startedActivities == 1 && backgroundObserved) {
            return AutomaticEvents.APP_BECAME_ACTIVE
        }
        return null
    }

    /**
     * Records an activity stop; returns the event to capture, if any.
     *
     * A stop caused by a configuration change is followed by the start of the
     * recreated activity, so the pair is ignored instead of reading as a
     * round-trip through the background.
     */
    @Synchronized
    fun activityStopped(changingConfigurations: Boolean = false): String? {
        if (changingConfigurations) {
            skipNextStart = true
            return null
        }
        if (startedActivities == 0) return null
        startedActivities -= 1
        if (startedActivities == 0) {
            backgroundObserved = true
            return AutomaticEvents.APP_BACKGROUNDED
        }
        return null
    }
}
