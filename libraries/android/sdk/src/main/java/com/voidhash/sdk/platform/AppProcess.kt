package com.voidhash.sdk.platform

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import android.os.Build
import android.os.Process
import java.io.File

/**
 * The name of the process this code runs in, or `null` when the platform does not say.
 *
 * `Application.getProcessName` exists from API 28. Older devices are asked through the
 * activity manager, and `/proc/self/cmdline` is the last resort.
 */
internal fun currentProcessName(context: Context): String? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return Application.getProcessName()

    val pid = Process.myPid()
    val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    runCatching { manager?.runningAppProcesses?.firstOrNull { it.pid == pid }?.processName }
        .getOrNull()
        ?.let { return it }
    return runCatching { File("/proc/self/cmdline").readText().substringBefore('\u0000').trim() }
        .getOrNull()
        ?.takeIf { it.isNotEmpty() }
}

/**
 * Whether [processName] is the app's main process: the one `<application>` runs in, which is the
 * package name unless the manifest renames it. An unknown name counts as the main process, so a
 * platform that does not say never disables the SDK.
 */
internal fun isMainProcess(context: Context, processName: String?): Boolean {
    if (processName == null) return true
    val mainProcessName = context.applicationInfo?.processName ?: context.packageName
    return processName == mainProcessName
}

/**
 * Whether one of the app's activities is in the foreground, for a client configured after the
 * first activity started, whose start callback it never saw. A process started for a broadcast,
 * a job or a service reports `false`.
 */
internal fun isAppInForeground(): Boolean {
    val state = ActivityManager.RunningAppProcessInfo()
    return runCatching { ActivityManager.getMyMemoryState(state) }.isSuccess &&
        state.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
}
