package com.margelo.nitro.voidhash.measurement

import android.content.Context
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONObject

internal data class ObservedFcmToken(val token: String)

internal data class PushCollectorEvent(
    val id: String,
    val kind: String,
    val occurredAt: String,
    val protectedPayloadRef: String? = null,
    val pushNotificationSendId: String? = null,
    val link: String? = null,
    val errorCode: String? = null,
)

/** Native FCM callback sink that remains available before JavaScript starts. */
object VoidhashPushCollector {
    private val listeners = ConcurrentHashMap<String, (PushCollectorEvent) -> Unit>()
    @Volatile private var token: ObservedFcmToken? = null

    /** Records a newly issued FCM token in memory and announces a safe rotation event. */
    fun observeToken(value: String) {
        if (value.isBlank()) {
            observeRegistrationError("FCM_EMPTY_TOKEN")
            return
        }
        token = ObservedFcmToken(value)
        emit(PushCollectorEvent(newId(), "tokenChanged", now()))
    }

    /** Records a typed registration failure without retaining its message. */
    fun observeRegistrationError(code: String) {
        emit(PushCollectorEvent(newId(), "registrationError", now(), errorCode = code.ifBlank { "FCM_REGISTRATION_FAILED" }))
    }

    /** Records an opened notification projection supplied by the host Activity hook. */
    fun observeOpened(
        id: String,
        protectedPayloadRef: String?,
        pushNotificationSendId: String?,
        link: String?,
    ) {
        emit(PushCollectorEvent(id, "opened", now(), protectedPayloadRef, pushNotificationSendId, link))
    }

    internal fun currentToken(): ObservedFcmToken? = token
    internal fun subscribe(id: String, listener: (PushCollectorEvent) -> Unit) { listeners[id] = listener }
    internal fun unsubscribe(id: String) { listeners.remove(id) }
    internal fun emit(event: PushCollectorEvent) { listeners.values.forEach { it(event) } }
    private fun newId() = "notification_${UUID.randomUUID().toString().lowercase()}"
    private fun now() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
}

/** Firebase service that durably vaults payloads and forwards safe receipt metadata. */
class VoidhashFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        VoidhashPushCollector.observeToken(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val id = message.messageId ?: "notification_${UUID.randomUUID().toString().lowercase()}"
        val raw = JSONObject(message.data as Map<*, *>).toString()
        val store = MeasurementStore(applicationContext)
        try {
            val protectedRef = store.putProtectedEvidence(
                blobId = "push_payload_$id",
                purpose = "push-token",
                consentRevision = 0,
                retentionClass = "ephemeral",
                value = raw.toByteArray(Charsets.UTF_8),
            )
            store.appendInbox(id, "push", "fcm", "background", now(), protectedRef)
            VoidhashPushCollector.emit(
                PushCollectorEvent(
                    id = id,
                    kind = "received",
                    occurredAt = now(),
                    protectedPayloadRef = protectedRef,
                    pushNotificationSendId = message.data["voidhash_send_id"],
                    link = message.data["voidhash_link"],
                ),
            )
        } finally {
            store.close()
        }
    }

    private fun now() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
        timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date())
}
