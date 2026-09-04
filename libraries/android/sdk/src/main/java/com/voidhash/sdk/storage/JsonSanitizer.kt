package com.voidhash.sdk.storage

import org.json.JSONArray
import org.json.JSONObject

/**
 * Converts [value] into something `org.json` can always write.
 *
 * Non-finite numbers are not representable in JSON. The platform `JSONObject.toString()`
 * answers them with `null` for the *whole* document rather than throwing, which would turn
 * one bad property into an unwritable queue file or an unsendable batch. They become JSON
 * `null` here instead, at any depth; [onNonFinite] is told the path of each one. Nested maps,
 * collections, arrays and JSON containers are rebuilt recursively; everything else is
 * returned as is.
 */
internal fun sanitizeJsonValue(
    value: Any?,
    path: String = "",
    onNonFinite: (String) -> Unit = {},
): Any = when (value) {
    null, JSONObject.NULL -> JSONObject.NULL
    is Double -> if (value.isFinite()) value else JSONObject.NULL.also { onNonFinite(path) }
    is Float -> if (value.isFinite()) value else JSONObject.NULL.also { onNonFinite(path) }
    is Map<*, *> -> JSONObject().also { json ->
        for ((key, entry) in value) {
            val name = key.toString()
            json.put(name, sanitizeJsonValue(entry, childPath(path, name), onNonFinite))
        }
    }
    is JSONObject -> JSONObject().also { json ->
        for (key in value.keys()) {
            json.put(key, sanitizeJsonValue(value.opt(key), childPath(path, key), onNonFinite))
        }
    }
    is JSONArray -> JSONArray().also { json ->
        for (index in 0 until value.length()) {
            json.put(sanitizeJsonValue(value.opt(index), "$path[$index]", onNonFinite))
        }
    }
    is Iterable<*> -> JSONArray().also { json ->
        value.forEachIndexed { index, entry ->
            json.put(sanitizeJsonValue(entry, "$path[$index]", onNonFinite))
        }
    }
    is Array<*> -> sanitizeJsonValue(value.asList(), path, onNonFinite)
    else -> value
}

/** [sanitizeJsonValue] over a whole property map, returning the `JSONObject` to embed. */
internal fun sanitizeJsonObject(
    values: Map<String, Any?>,
    onNonFinite: (String) -> Unit = {},
): JSONObject = sanitizeJsonValue(values, "", onNonFinite) as JSONObject

private fun childPath(path: String, key: String): String =
    if (path.isEmpty()) key else "$path.$key"
