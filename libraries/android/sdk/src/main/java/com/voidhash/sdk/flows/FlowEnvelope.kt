package com.voidhash.sdk.flows

import com.voidhash.core.paywall.PaywallBridge
import com.voidhash.sdk.VoidhashException
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener
import java.util.TimeZone
import kotlin.random.Random

/** A message a flow sent to the SDK. */
data class FlowInboundEnvelope(
    val type: String,
    val requestId: String?,
    val payload: JSONObject,
)

/**
 * Raised when a raw flow message is not a valid bridge envelope. The codes are
 * shared with the other platforms' SDKs.
 */
class FlowEnvelopeParseException(
    code: String,
    description: String,
) : VoidhashException(code, description)

/**
 * Parsing and serialization for the flow bridge envelopes. The wire shape is
 * `{version: 1, type, requestId?, payload}` and every outbound message is
 * ASCII-escaped.
 */
object FlowEnvelope {
    private val INBOUND_TYPES = setOf(
        "ready",
        "close",
        "purchase",
        "restore",
        "openExternal",
        "log",
        "finish",
        "requestPermission",
        "setAttribute",
        "track",
        "screen",
        "state",
        "appAction",
    )

    /** Types whose payload carries required fields, so an absent payload is invalid. */
    private val PAYLOAD_REQUIRED_TYPES = setOf(
        "purchase",
        "openExternal",
        "log",
        "finish",
        "requestPermission",
        "setAttribute",
        "track",
        "screen",
        "state",
        "appAction",
    )

    private val LOG_LEVELS = setOf("debug", "info", "warn", "warning", "error")

    /**
     * Parses a raw bridge message.
     *
     * @throws FlowEnvelopeParseException with an `INVALID_JSON`,
     *   `INVALID_ENVELOPE`, `UNSUPPORTED_VERSION`, `UNSUPPORTED_TYPE` or
     *   `INVALID_PAYLOAD` code, so the caller can surface why a message was
     *   rejected instead of dropping it silently.
     */
    fun parse(raw: String): FlowInboundEnvelope {
        val json = parseJson(raw) as? JSONObject
            ?: throw FlowEnvelopeParseException(
                "INVALID_ENVELOPE",
                "Invalid paywall bridge payload: expected object envelope",
            )

        // Strict integer match: a stringified "1" is a different wire contract.
        val version = json.opt("version")
        if (version !is Int || version != PaywallBridge.VERSION) {
            throw FlowEnvelopeParseException(
                "UNSUPPORTED_VERSION",
                "Unsupported paywall bridge version: $version",
            )
        }

        val type = json.opt("type")
        if (type !is String || type !in INBOUND_TYPES) {
            throw FlowEnvelopeParseException(
                "UNSUPPORTED_TYPE",
                "Unsupported paywall bridge message type: $type",
            )
        }

        val requestId = if (json.has("requestId")) {
            val value = json.opt("requestId")
            if (value !is String || value.isEmpty()) {
                throw FlowEnvelopeParseException(
                    "INVALID_ENVELOPE",
                    "Invalid paywall bridge payload: 'requestId' must be a non-empty string when present",
                )
            }
            value
        } else {
            null
        }

        return FlowInboundEnvelope(
            type = type,
            requestId = requestId,
            payload = parsePayload(type, json),
        )
    }

    private fun parseJson(raw: String): Any? {
        val tokener = JSONTokener(raw)
        val value = runCatching { tokener.nextValue() }.getOrElse {
            throw FlowEnvelopeParseException(
                "INVALID_JSON",
                "Invalid paywall bridge payload: failed to parse JSON",
            )
        }
        // `nextValue` happily stops at the first token, so trailing content is
        // the only way to tell `{"a":1} garbage` (and bare words) from valid JSON.
        if (runCatching { tokener.nextClean() }.getOrDefault(0.toChar()) != 0.toChar()) {
            throw FlowEnvelopeParseException(
                "INVALID_JSON",
                "Invalid paywall bridge payload: failed to parse JSON",
            )
        }
        return value
    }

    private fun parsePayload(type: String, json: JSONObject): JSONObject {
        if (!json.has("payload") || json.isNull("payload")) {
            if (type in PAYLOAD_REQUIRED_TYPES) {
                throw invalidPayload(type, "payload is required")
            }
            return JSONObject()
        }

        val payload = json.opt("payload") as? JSONObject
            ?: throw invalidPayload(type, "payload must be an object")

        when (type) {
            "purchase" -> requireNonEmptyString(payload, "productId", type)
            "openExternal" -> requireNonEmptyString(payload, "url", type)
            "log" -> {
                val level = payload.opt("level")
                if (level !is String || level !in LOG_LEVELS) {
                    throw invalidPayload(type, "'level' must be debug|info|warn|warning|error")
                }
                requireNonEmptyString(payload, "message", type)
            }
            "finish" -> {
                if (payload.opt("result") !is String) throw invalidPayload(type, "'result' must be a string")
                requireOptionalObject(payload, "variables", type)
                requireOptionalObject(payload, "output", type)
            }
            "close" -> requireOptionalObject(payload, "output", type)
            "appAction" -> {
                requireNonEmptyString(payload, "name", type)
                requireOptionalObject(payload, "args", type)
            }
            "requestPermission" -> requireNonEmptyString(payload, "permission", type)
            "setAttribute" -> {
                requireNonEmptyString(payload, "name", type)
                if (!payload.has("value")) throw invalidPayload(type, "'value' is required")
            }
            "track" -> {
                requireNonEmptyString(payload, "name", type)
                requireOptionalObject(payload, "properties", type)
            }
            "screen" -> {
                if (payload.opt("index") !is Number) throw invalidPayload(type, "'index' must be a number")
                if (payload.opt("name") !is String) throw invalidPayload(type, "'name' must be a string")
            }
            "state" -> {
                if (payload.opt("variables") !is JSONObject) throw invalidPayload(type, "'variables' must be an object")
                requireOptionalObject(payload, "output", type)
            }
        }

        return payload
    }

    private fun requireNonEmptyString(payload: JSONObject, field: String, type: String) {
        val value = payload.opt(field)
        if (value !is String || value.isEmpty()) {
            throw invalidPayload(type, "'$field' must be a non-empty string")
        }
    }

    private fun requireOptionalObject(payload: JSONObject, field: String, type: String) {
        if (payload.has(field) && !payload.isNull(field) && payload.opt(field) !is JSONObject) {
            throw invalidPayload(type, "'$field' must be an object when present")
        }
    }

    private fun invalidPayload(type: String, reason: String) = FlowEnvelopeParseException(
        "INVALID_PAYLOAD",
        "Invalid paywall bridge payload for '$type': $reason",
    )

    /** Serializes an in-progress or terminal purchase status. */
    fun statusMessage(
        status: String,
        requestId: String? = null,
        productId: String? = null,
        error: String? = null,
    ): String {
        val payload = JSONObject().put("status", status)
        productId?.let { payload.put("productId", it) }
        error?.let { payload.put("error", it) }
        return envelope("status", requestId, payload)
    }

    /** Serializes a successful action response. */
    fun successResponse(
        action: String,
        requestId: String? = null,
        data: JSONObject? = null,
    ): String {
        val payload = JSONObject()
            .put("action", action)
            .put("status", "success")
        data?.let { payload.put("data", it) }
        return envelope("response", requestId, payload)
    }

    /** Tells the flow on screen the permission statuses that changed while it was shown. */
    fun permissionsContext(statuses: Map<String, String>): String =
        envelope("context", null, JSONObject().put("permissions", JSONObject(statuses)))

    /** Serializes a failed action response. */
    fun errorResponse(
        action: String,
        code: String,
        message: String,
        requestId: String? = null,
    ): String {
        val payload = JSONObject()
            .put("action", action)
            .put("status", "error")
            .put("error", JSONObject().put("code", code).put("message", message))
        return envelope("response", requestId, payload)
    }

    /** Serializes the app's reply to the `appAction` the flow sent as [requestId]. */
    fun appActionReply(requestId: String, value: JSONObject): String =
        envelope("response", requestId, JSONObject().put("ok", true).put("value", value))

    /** Serializes the failure of the `appAction` the flow sent as [requestId]. */
    fun appActionFailure(requestId: String, error: String): String =
        envelope("response", requestId, JSONObject().put("ok", false).put("error", error))

    /**
     * Serializes the `products` message, which sends a flow on screen its [products] again, as
     * `configure` gives them, after a purchase or restore changed what the store says of them.
     */
    fun productsMessage(products: List<FlowRuntimeConfigProduct>): String =
        envelope("products", null, JSONObject().put("products", JSONArray(products.map { it.toJson() })))

    /** Serializes the `input` message, which changes the inputs of a flow that is shown. */
    fun inputMessage(values: JSONObject): String = envelope("input", null, JSONObject().put("values", values))

    /**
     * The `configure` envelope a flow receives once it is on screen, with the device's clock as
     * it is when sent (`now`, milliseconds since 1970 UTC, and `utcOffset`, minutes ahead of UTC),
     * which the flow's logic reads as today's date, and the seed its random numbers are drawn
     * from (`randomSeed`, a whole number below 2^53, fresh for each presentation).
     */
    fun configureMessage(
        config: FlowRuntimeConfig,
        requestId: String? = null,
        now: Long = System.currentTimeMillis(),
        timeZone: TimeZone = TimeZone.getDefault(),
        randomSeed: Long = Random.nextLong(0, 1L shl 53),
    ): String = envelope(
        "configure",
        requestId,
        config.toJson()
            .put("now", now)
            .put("utcOffset", timeZone.getOffset(now) / 60_000)
            .put("randomSeed", randomSeed),
    )

    private fun envelope(type: String, requestId: String?, payload: JSONObject): String {
        val json = JSONObject()
            .put("version", PaywallBridge.VERSION)
            .put("type", type)
        requestId?.let { json.put("requestId", it) }
        json.put("payload", payload)
        return PaywallBridge.escapeNonAscii(json.toString())
    }
}
