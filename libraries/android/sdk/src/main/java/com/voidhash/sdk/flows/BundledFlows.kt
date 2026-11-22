package com.voidhash.sdk.flows

import android.content.Context
import com.voidhash.sdk.api.PaywallAnswer
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream

/**
 * The flows an app ships in its assets, so a location shows a flow on a first launch without a
 * connection, or during an outage, when the device has no answer for it yet.
 *
 * They live in the app's `assets/voidhash-flows/` folder, with two files per location:
 *
 * - `<location>.json`: the location's answer, as the resolve API returns it (`location`, `showing`
 *   with its `paywallRelease` and `flowPackage`), and `interfaceRevision`, the revision of the
 *   location's interface it was taken for (0 when absent). An exposure token and a list of
 *   withdrawn packages in it are ignored.
 * - `<location>.vhfp`: the flow package that answer names, whose SHA-256 must match it.
 *
 * A bundled flow is used only when the device has no answer for the location, cached or fresh,
 * and cannot get one; never when Voidhash answered that the location shows nothing, however long
 * ago; never when its revision is not the one the app presents; never when its package is
 * withdrawn, which any answer since may have said, or is one the renderer cannot draw. Nothing is
 * read until a presentation needs it.
 *
 * @param open opens a file of the folder by name, `null` when there is none.
 */
internal class BundledFlows(private val open: (name: String) -> InputStream?) {
    /** A verified bundled flow: the answer it stands for, without an exposure token, and its package. */
    class Flow(val answer: PaywallAnswer, val bytes: ByteArray)

    /**
     * The verified flow bundled for [location] at interface [revision], unless it is past its
     * `notAfter` at [now] (epoch milliseconds); `null`, with a warning for a file that is there but
     * unusable, when there is none to show. Reads files: call it off the main thread.
     */
    fun flow(location: String, revision: Int, now: Long, warn: (String) -> Unit): Flow? {
        // A slug names a file in the folder, and nothing outside it.
        if (!SAFE_NAME.matches(location)) return null
        val manifest = read("$location.json", MAX_MANIFEST_BYTES) ?: return null
        fun skip(reason: String): Flow? {
            warn("The flow bundled for \"$location\" is not shown: $reason")
            return null
        }
        val text = String(manifest, Charsets.UTF_8)
        // org.json parses by recursion: nesting this deep is no answer, and would exhaust the stack.
        if (nestingDepth(text) > MAX_NESTING) return skip("$location.json is nested too deeply")
        val json = try {
            JSONObject(text)
        } catch (error: JSONException) {
            return skip("$location.json is not a JSON object")
        } catch (error: StackOverflowError) {
            return skip("$location.json is nested too deeply")
        }
        val bundledRevision = when (val value = json.opt("interfaceRevision")) {
            null -> 0
            is Int, is Long -> (value as Number).toLong().takeIf { it in 0..Int.MAX_VALUE }?.toInt()
            is Double -> value.takeIf { it % 1.0 == 0.0 && it >= 0 && it <= Int.MAX_VALUE }?.toInt()
            else -> null
        } ?: return skip("its interfaceRevision is not a whole number")
        if (bundledRevision != revision) {
            return skip(
                "it was taken for revision $bundledRevision of the location's interface, and the app presents revision $revision",
            )
        }
        if (json.has("notAfter")) {
            val notAfter = (json.opt("notAfter") as? String)?.let(::parseTimestamp)
                ?: return skip("its notAfter is not a timestamp such as 2026-12-31T00:00:00Z")
            if (now > notAfter) return skip("it is past its notAfter")
        }
        // Its exposure was counted, if ever, where the answer was taken; the withdrawn packages
        // that count are those the device has heard of.
        json.remove("withdrawnPackages")
        json.optJSONObject("showing")?.remove("exposureToken")
        val answer = PaywallAnswer.fromJson(json) ?: return skip("$location.json is not a resolve answer")
        if (answer.paywall.locationSlug != location) {
            return skip("$location.json is the answer for \"${answer.paywall.locationSlug}\"")
        }
        val reference = answer.paywall.flowPackage ?: return skip("its answer names no flow package")
        val bytes = read("$location.vhfp", MAX_FLOW_PACKAGE_BYTES)
            ?: return skip("$location.vhfp is missing or larger than a flow package may be")
        if (FlowPackageStore.sha256Hex(bytes) != reference.sha256.lowercase()) {
            return skip("$location.vhfp does not match the SHA-256 its answer names")
        }
        return Flow(answer, bytes)
    }

    /** The bytes of [name], or `null` when it is missing, unreadable or longer than [maxBytes]. */
    private fun read(name: String, maxBytes: Int): ByteArray? = try {
        open(name)?.use { input ->
            val bytes = input.readNBytesCompat(maxBytes + 1)
            bytes.takeIf { it.size <= maxBytes }
        }
    } catch (error: IOException) {
        null
    }

    companion object {
        /** The folder of the app's assets the flows are in. */
        const val DIRECTORY = "voidhash-flows"

        private const val MAX_MANIFEST_BYTES = 256 * 1024

        /** The deepest nesting of objects and arrays a bundled answer may have; a real one has 5. */
        private const val MAX_NESTING = 32

        /** `2026-12-31T00:00:00Z`, with optional fractional seconds and a `±HH:MM` offset for `Z`. */
        private val TIMESTAMP = Regex("""(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})""")

        /** The deepest nesting of `{` and `[` in [text] outside strings. */
        private fun nestingDepth(text: String): Int {
            var depth = 0
            var deepest = 0
            var inString = false
            var escaped = false
            for (character in text) {
                when {
                    escaped -> escaped = false
                    inString && character == '\\' -> escaped = true
                    character == '"' -> inString = !inString
                    inString -> Unit
                    character == '{' || character == '[' -> deepest = maxOf(deepest, ++depth)
                    character == '}' || character == ']' -> depth--
                }
            }
            return deepest
        }

        /** Epoch milliseconds of an ISO 8601 timestamp with a time zone, as `notAfter` is written; `null` for any other text. */
        internal fun parseTimestamp(text: String): Long? {
            val match = TIMESTAMP.matchEntire(text) ?: return null
            val (year, month, day, hour, minute, second, zone) = match.destructured
            val calendar = java.util.GregorianCalendar(java.util.TimeZone.getTimeZone("UTC")).apply {
                isLenient = false
                clear()
                set(year.toInt(), month.toInt() - 1, day.toInt(), hour.toInt(), minute.toInt(), second.toInt())
            }
            val utc = try {
                calendar.timeInMillis
            } catch (error: IllegalArgumentException) {
                return null
            }
            val offsetMinutes = if (zone == "Z") {
                0
            } else {
                val sign = if (zone[0] == '-') -1 else 1
                sign * (zone.substring(1, 3).toInt() * 60 + zone.substring(4, 6).toInt())
            }
            return utc - offsetMinutes * 60_000L
        }
        private val SAFE_NAME = Regex("[A-Za-z0-9_-][A-Za-z0-9._-]*")

        /** The flows in [context]'s assets. */
        fun assets(context: Context): BundledFlows = BundledFlows { name ->
            try {
                context.assets.open("$DIRECTORY/$name")
            } catch (error: IOException) {
                null
            }
        }

        /** Up to [limit] bytes of the stream. */
        private fun InputStream.readNBytesCompat(limit: Int): ByteArray {
            val out = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(64 * 1024)
            while (out.size() < limit) {
                val read = read(buffer, 0, minOf(buffer.size, limit - out.size()))
                if (read < 0) break
                out.write(buffer, 0, read)
            }
            return out.toByteArray()
        }
    }
}
