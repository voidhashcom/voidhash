package com.voidhash.sdk.analytics

import java.util.concurrent.atomic.AtomicBoolean

/**
 * Derives app-level foreground transitions from activity start/stop counts.
 *
 * The app is in the foreground while at least one activity is started. The first foreground of
 * the process is `$app_opened`: a process started in the background, for a push, a job or a
 * broadcast, opens nothing until the user brings up one of its activities. Later foregrounds
 * that follow an observed background are `$app_became_active`.
 *
 * @param processOpened whether the process has reported `$app_opened`. Shared by every tracker in
 *   the process, so a client configured again does not report a second one.
 */
class LifecycleTracker(private val processOpened: AtomicBoolean = AtomicBoolean(false)) {
    private var startedActivities = 0
    private var backgroundObserved = false
    private var skipNextStart = false

    /**
     * Whether an activity is started. A configuration change keeps it set: the recreated
     * activity's start is already accounted for.
     */
    val isInForeground: Boolean
        @Synchronized get() = startedActivities > 0

    /** Records an activity start; returns the event to capture, if any. */
    @Synchronized
    fun activityStarted(): String? {
        if (skipNextStart) {
            skipNextStart = false
            return null
        }
        startedActivities += 1
        if (startedActivities != 1) return null
        return when {
            processOpened.compareAndSet(false, true) -> AutomaticEvents.APP_OPENED
            backgroundObserved -> AutomaticEvents.APP_BECAME_ACTIVE
            else -> null
        }
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
