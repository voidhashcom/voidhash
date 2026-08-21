package com.voidhash.sdk.paywall

import com.voidhash.core.paywall.PaywallBridge
import com.voidhash.sdk.VoidhashException
import org.json.JSONObject
import org.json.JSONTokener

/** A page → native bridge envelope. */
data class PaywallInboundEnvelope(
    val type: String,
    val requestId: String?,
    val payload: JSONObject,
)

/**
 * Raised when a raw page → native message is not a valid bridge envelope. The
 * codes mirror the TypeScript `PaywallBridgeParseError` ones so a bundle sees
 * the same rejection reason on every platform.
 */
class PaywallEnvelopeParseException(
    code: String,
    description: String,
) : VoidhashException(code, description)

/**
 * Parsing and serialization for the paywall bridge envelopes. The wire shape is
 * `{version: 1, type, requestId?, payload}` and every outbound message is
 * ASCII-escaped before it reaches the WebView.
 */
object PaywallEnvelope {
    private val INBOUND_TYPES = setOf(
        "ready",
        "close",
        "purchase",
        "restore",
        "openExternal",
        "event",
        "log",
    )

    /** Types whose payload carries required fields, so an absent payload is invalid. */
    private val PAYLOAD_REQUIRED_TYPES = setOf("purchase", "openExternal", "event", "log")

    private val LOG_LEVELS = setOf("debug", "info", "warn", "error")

    /**
     * Parses a raw bridge message.
     *
     * @throws PaywallEnvelopeParseException with an `INVALID_JSON`,
     *   `INVALID_ENVELOPE`, `UNSUPPORTED_VERSION`, `UNSUPPORTED_TYPE` or
     *   `INVALID_PAYLOAD` code, so the caller can surface why a message was
     *   rejected instead of dropping it silently.
     */
    fun parse(raw: String): PaywallInboundEnvelope {
        val json = parseJson(raw) as? JSONObject
            ?: throw PaywallEnvelopeParseException(
                "INVALID_ENVELOPE",
                "Invalid paywall bridge payload: expected object envelope",
            )

        // Strict integer match: a stringified "1" is a different wire contract.
        val version = json.opt("version")
        if (version !is Int || version != PaywallBridge.VERSION) {
            throw PaywallEnvelopeParseException(
                "UNSUPPORTED_VERSION",
                "Unsupported paywall bridge version: $version",
            )
        }

        val type = json.opt("type")
        if (type !is String || type !in INBOUND_TYPES) {
            throw PaywallEnvelopeParseException(
                "UNSUPPORTED_TYPE",
                "Unsupported paywall bridge message type: $type",
            )
        }

        val requestId = if (json.has("requestId")) {
            val value = json.opt("requestId")
            if (value !is String || value.isEmpty()) {
                throw PaywallEnvelopeParseException(
                    "INVALID_ENVELOPE",
                    "Invalid paywall bridge payload: 'requestId' must be a non-empty string when present",
                )
            }
            value
        } else {
            null
        }

        return PaywallInboundEnvelope(
            type = type,
            requestId = requestId,
            payload = parsePayload(type, json),
        )
    }

    private fun parseJson(raw: String): Any? {
        val tokener = JSONTokener(raw)
        val value = runCatching { tokener.nextValue() }.getOrElse {
            throw PaywallEnvelopeParseException(
                "INVALID_JSON",
                "Invalid paywall bridge payload: failed to parse JSON",
            )
        }
        // `nextValue` happily stops at the first token, so trailing content is
        // the only way to tell `{"a":1} garbage` (and bare words) from valid JSON.
        if (runCatching { tokener.nextClean() }.getOrDefault(0.toChar()) != 0.toChar()) {
            throw PaywallEnvelopeParseException(
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
            "event" -> {
                requireNonEmptyString(payload, "name", type)
                if (payload.has("properties") &&
                    !payload.isNull("properties") &&
                    payload.opt("properties") !is JSONObject
                ) {
                    throw invalidPayload(type, "'properties' must be an object when present")
                }
            }
            "log" -> {
                val level = payload.opt("level")
                if (level !is String || level !in LOG_LEVELS) {
                    throw invalidPayload(type, "'level' must be debug|info|warn|error")
                }
                requireNonEmptyString(payload, "message", type)
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

    private fun invalidPayload(type: String, reason: String) = PaywallEnvelopeParseException(
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

    /** Serializes the `configure` envelope carrying the runtime config. */
    fun configureMessage(config: PaywallRuntimeConfig, requestId: String? = null): String =
        envelope("configure", requestId, config.toJson())

    private fun envelope(type: String, requestId: String?, payload: JSONObject): String {
        val json = JSONObject()
            .put("version", PaywallBridge.VERSION)
            .put("type", type)
        requestId?.let { json.put("requestId", it) }
        json.put("payload", payload)
        return PaywallBridge.escapeNonAscii(json.toString())
    }
}
