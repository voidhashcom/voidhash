package com.margelo.nitro.voidhash

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.util.concurrent.ConcurrentHashMap
import com.margelo.nitro.voidhash.measurement.VoidhashPushCollector

class HybridNotifications : HybridNotificationsSpec() {
    private val listeners = ConcurrentHashMap<String, (NativeNotificationEvent) -> Unit>()
    private val collectorSubscriptionId = "hybrid-${System.identityHashCode(this)}"

    init {
        VoidhashPushCollector.subscribe(collectorSubscriptionId) { event ->
            val kind = when (event.kind) {
                "received" -> NativeNotificationEventKind.RECEIVED
                "opened" -> NativeNotificationEventKind.OPENED
                "tokenChanged" -> NativeNotificationEventKind.TOKENCHANGED
                else -> NativeNotificationEventKind.REGISTRATIONERROR
            }
            val bridged = NativeNotificationEvent(
                event.id,
                kind,
                event.occurredAt,
                event.protectedPayloadRef,
                event.pushNotificationSendId,
                event.link,
                event.errorCode,
            )
            listeners.values.forEach { it(bridged) }
        }
    }

    override fun getPermissionStatus(): Promise<String> = Promise.async {
        val context = NitroModules.applicationContext
            ?: throw IllegalStateException("NITRO_CONTEXT_UNAVAILABLE")
        if (Build.VERSION.SDK_INT < 33) "notRequired"
        else if (context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) "authorized"
        else if (context.getSharedPreferences("voidhash-notifications", 0).getBoolean("permission-requested", false)) "denied"
        else "notDetermined"
    }

    override fun requestPermission(provisional: Boolean): Promise<String> = Promise.async {
        if (Build.VERSION.SDK_INT < 33) return@async "notRequired"
        val context = NitroModules.applicationContext
            ?: throw IllegalStateException("NITRO_CONTEXT_UNAVAILABLE")
        if (context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return@async "authorized"
        }
        val activity = context.currentActivity
            ?: throw IllegalStateException("PERMISSION_REQUEST_REQUIRES_ACTIVITY")
        context.getSharedPreferences("voidhash-notifications", 0)
            .edit().putBoolean("permission-requested", true).apply()
        activity.runOnUiThread {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                0x5648,
            )
        }
        repeat(300) {
            if (context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
                return@async "authorized"
            }
            Thread.sleep(100)
        }
        "denied"
    }

    override fun getToken(): Promise<NativePushToken> = Promise.async {
        val observed = VoidhashPushCollector.currentToken()
            ?: throw IllegalStateException("PUSH_TOKEN_NOT_OBSERVED")
        NativePushToken(observed.token, NativePushProvider.FCM, NativePushEnvironment.PRODUCTION)
    }

    override fun setBadgeCount(count: Double): Promise<Unit> = Promise.async {
        require(count >= 0 && count % 1.0 == 0.0) { "INVALID_BADGE_COUNT" }
        throw IllegalStateException("BADGE_COUNT_UNSUPPORTED_BY_ANDROID")
    }

    override fun subscribe(subscriptionId: String, listener: (NativeNotificationEvent) -> Unit) {
        listeners[subscriptionId] = listener
    }

    override fun unsubscribe(subscriptionId: String) {
        listeners.remove(subscriptionId)
    }
}
