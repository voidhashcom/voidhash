package com.voidhash.sdk.paywall

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.coroutines.resume

/**
 * Answers a flow's `requestPermission` with the platform prompt.
 *
 * Notifications: on Android 13 and later the user is asked for `POST_NOTIFICATIONS`, which the
 * app has to declare in its manifest; below Android 13 there is no prompt and the answer is
 * whether the user left notifications enabled. Tracking has no Android prompt and answers false.
 */
internal suspend fun requestFlowPermission(
    activity: Activity,
    permission: String,
    onWarning: (String) -> Unit,
): Boolean = when (permission) {
    "notifications" -> requestNotificationPermission(activity, onWarning)
    "tracking" -> {
        onWarning("Android has no tracking permission prompt; the flow's request answers false")
        false
    }
    else -> false
}

private suspend fun requestNotificationPermission(activity: Activity, onWarning: (String) -> Unit): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return notificationsEnabled(activity)

    val permission = Manifest.permission.POST_NOTIFICATIONS
    if (activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED) return true
    if (!declaresPermission(activity, permission)) {
        onWarning(
            "A flow asked for the notification permission, but the app does not declare " +
                "$permission in its manifest",
        )
        return false
    }
    return VoidhashPermissionActivity.request(activity, permission)
}

private fun notificationsEnabled(context: Context): Boolean {
    // Before Android 7 notifications cannot be turned off per app through a public API.
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return true
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return false
    return manager.areNotificationsEnabled()
}

private fun declaresPermission(context: Context, permission: String): Boolean =
    try {
        @Suppress("DEPRECATION")
        context.packageManager
            .getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions
            ?.contains(permission) == true
    } catch (error: PackageManager.NameNotFoundException) {
        false
    }

/**
 * A transparent activity that asks for one runtime permission on behalf of a flow and reports
 * the answer, since only an activity receives the result of a permission request. The SDK's
 * manifest declares it.
 */
class VoidhashPermissionActivity : Activity() {
    private var requestId = NO_REQUEST
    private var delivered = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestId = intent.getIntExtra(EXTRA_REQUEST_ID, NO_REQUEST)
        val permission = intent.getStringExtra(EXTRA_PERMISSION)
        if (permission == null || !pending.containsKey(requestId)) {
            deliver(false)
            finish()
            return
        }
        // A recreated activity receives the result of the request its predecessor made.
        if (savedInstanceState == null) {
            requestPermissions(arrayOf(permission), PERMISSION_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != PERMISSION_REQUEST_CODE) return
        deliver(grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        // Finished without an answer, for instance by the system: the permission stays denied.
        if (isFinishing) deliver(false)
    }

    private fun deliver(granted: Boolean) {
        if (delivered) return
        delivered = true
        pending.remove(requestId)?.invoke(granted)
    }

    internal companion object {
        private const val EXTRA_REQUEST_ID = "com.voidhash.sdk.permission.REQUEST_ID"
        private const val EXTRA_PERMISSION = "com.voidhash.sdk.permission.PERMISSION"
        private const val PERMISSION_REQUEST_CODE = 0x5648
        private const val NO_REQUEST = -1

        private val nextRequestId = AtomicInteger(0)
        private val pending = ConcurrentHashMap<Int, (Boolean) -> Unit>()

        /** Asks for [permission] above [activity] and suspends until the user answered. */
        suspend fun request(activity: Activity, permission: String): Boolean =
            suspendCancellableCoroutine { continuation ->
                val id = nextRequestId.incrementAndGet()
                pending[id] = { granted -> if (continuation.isActive) continuation.resume(granted) }
                continuation.invokeOnCancellation { pending.remove(id) }
                val intent = Intent(activity, VoidhashPermissionActivity::class.java)
                    .putExtra(EXTRA_REQUEST_ID, id)
                    .putExtra(EXTRA_PERMISSION, permission)
                activity.runOnUiThread {
                    try {
                        activity.startActivity(intent)
                    } catch (error: RuntimeException) {
                        pending.remove(id)?.invoke(false)
                    }
                }
            }
    }
}
