package com.voidhash.sdk.analytics

import android.annotation.TargetApi
import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build

/**
 * A crash Android recorded for one of this app's processes.
 *
 * Holds when it happened and of what kind, and nothing else: an exit record's description and
 * trace can hold private data and are never read.
 */
internal data class ProcessCrash(val timestamp: Long, val kind: String)

/**
 * The crashes Android still remembers for this app, from `getHistoricalProcessExitReasons` on API
 * 30 and later; nothing earlier. The system records them itself: nothing here installs a signal or
 * uncaught exception handler in the app, which would conflict with its crash reporters. A binder
 * call, so never made on the launch path.
 */
internal fun readProcessCrashes(
    context: Context,
    sdkInt: Int = Build.VERSION.SDK_INT,
): List<ProcessCrash> {
    if (sdkInt < Build.VERSION_CODES.R) return emptyList()
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        ?: return emptyList()
    return ProcessExitRecords.crashes(manager)
}

/** Holds what names an API 30 class apart, so that older devices never have to resolve it. */
@TargetApi(Build.VERSION_CODES.R)
private object ProcessExitRecords {
    fun crashes(manager: ActivityManager): List<ProcessCrash> =
        manager.getHistoricalProcessExitReasons(null, 0, 0).mapNotNull { record ->
            val kind = when (record.reason) {
                ApplicationExitInfo.REASON_CRASH -> "crash"
                ApplicationExitInfo.REASON_CRASH_NATIVE -> "native_crash"
                ApplicationExitInfo.REASON_ANR -> "anr"
                else -> null
            }
            kind?.let { ProcessCrash(record.timestamp, it) }
        }
}
