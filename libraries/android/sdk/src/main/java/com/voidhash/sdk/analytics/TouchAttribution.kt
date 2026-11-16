package com.voidhash.sdk.analytics

import com.voidhash.sdk.network.formatIsoTimestamp
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** Reserved event that writes a touch onto the person, as the web SDK sends it. */
internal const val TOUCH_EVENT = "\$set"

internal const val TOUCH_SOURCE_PLAY = "play_install_referrer"
internal const val TOUCH_SOURCE_META = "meta_install_referrer"

/** Click ids and the ad network each one means, in the order that decides between them. */
private val CLICK_ID_NETWORKS = linkedMapOf(
    "fbclid" to "meta",
    "gclid" to "google",
    "gbraid" to "google",
    "wbraid" to "google",
    "gad_source" to "google",
    "gad_campaignid" to "google",
    "dclid" to "google",
    "ttclid" to "tiktok",
    "msclkid" to "microsoft",
    "twclid" to "x",
    "li_fat_id" to "linkedin",
    "ScCid" to "snapchat",
    "rdt_cid" to "reddit",
    "epik" to "pinterest",
)

private val UTM_PARAMS = listOf("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id")
private val AD_OBJECT_PARAMS = listOf("campaign_id", "adset_id", "ad_id")

/** Referrer parameters whose presence makes a referrer a touch. */
private val TOUCH_PARAMS = UTM_PARAMS + CLICK_ID_NETWORKS.keys + AD_OBJECT_PARAMS

/** Every value a native touch carries, written under both trait prefixes. */
private val TOUCH_KEYS = UTM_PARAMS + CLICK_ID_NETWORKS.keys + listOf(
    "ad_network",
    "ad_campaign_id",
    "ad_adset_id",
    "ad_id",
    "touch_source",
    "touch_kind",
    "touch_at",
    "meta_referrer_data",
    "meta_referrer_nonce",
)

private val PAID_MEDIUMS = setOf(
    "cpc", "ppc", "paid", "paid_social", "paidsocial", "paid-social", "paid_search", "paidsearch",
    "paid-search", "cpm", "cpv", "display", "banner", "retargeting", "remarketing", "ad", "ads", "sem",
)

/** Lowercased `utm_source` values of the known ad platforms and the name each one normalizes to. */
private val AD_PLATFORM_SOURCES = mapOf(
    "facebook" to "meta",
    "fb" to "meta",
    "instagram" to "meta",
    "ig" to "meta",
    "meta" to "meta",
    "google" to "google",
    "adwords" to "google",
    "googleads" to "google",
    "tiktok" to "tiktok",
    "bing" to "microsoft",
    "microsoft" to "microsoft",
    "twitter" to "x",
    "x" to "x",
    "linkedin" to "linkedin",
    "snapchat" to "snapchat",
    "reddit" to "reddit",
    "pinterest" to "pinterest",
)

/** Longest parameter value kept, as on the web. Meta's encrypted values are never cut: they would not decrypt. */
private const val MAX_VALUE_LENGTH = 1_000

/**
 * The ad network behind a touch's parameters, `null` when the touch is organic: a click id decides;
 * else a paid medium or an ad object id names the source; else a source alone counts only when it
 * is a known ad platform. The web SDK applies the same rule, and both run the shared
 * `touch-attribution.json` fixture so it cannot drift.
 */
internal fun adNetworkOf(params: Map<String, String>): String? {
    CLICK_ID_NETWORKS.entries.firstOrNull { it.key in params }?.let { return it.value }
    val source = params["utm_source"]?.lowercase(Locale.ROOT)
    val normalizedSource = source?.let { AD_PLATFORM_SOURCES[it] ?: it }
    val medium = params["utm_medium"]?.lowercase(Locale.ROOT)
    return when {
        medium in PAID_MEDIUMS || AD_OBJECT_PARAMS.any { it in params } -> normalizedSource
        medium == null && source in AD_PLATFORM_SOURCES -> normalizedSource
        else -> null
    }
}

internal fun adCampaignIdOf(params: Map<String, String>): String? =
    params["campaign_id"] ?: params["utm_id"] ?: params["gad_campaignid"]

/**
 * Decodes a referrer query string like `URLSearchParams.get`: only the first value of a name counts,
 * blank or not, `+` is a space, and each escape decodes on its own, so a malformed one stays as it is
 * without costing the rest of the value. Blank values count as absent, and so does Play's `(not set)`
 * placeholder.
 */
internal fun parseReferrerQuery(query: String): Map<String, String> {
    val seen = hashSetOf<String>()
    val params = linkedMapOf<String, String>()
    for (pair in query.split('&')) {
        if (pair.isEmpty()) continue
        val separator = pair.indexOf('=')
        val name = decodeReferrerComponent(if (separator < 0) pair else pair.substring(0, separator))
        if (!seen.add(name)) continue
        val value = if (separator < 0) "" else decodeReferrerComponent(pair.substring(separator + 1)).trim()
        if (value.isEmpty() || value == "(not set)") continue
        params[name] = value
    }
    return params
}

private fun decodeReferrerComponent(raw: String): String {
    val bytes = raw.replace('+', ' ').toByteArray(Charsets.UTF_8)
    val decoded = ByteArrayOutputStream(bytes.size)
    var index = 0
    while (index < bytes.size) {
        val high = if (bytes[index] == '%'.code.toByte() && index + 2 < bytes.size) hexDigit(bytes[index + 1]) else -1
        val low = if (high >= 0) hexDigit(bytes[index + 2]) else -1
        if (low >= 0) {
            decoded.write(high * 16 + low)
            index += 3
        } else {
            decoded.write(bytes[index].toInt())
            index += 1
        }
    }
    return String(decoded.toByteArray(), Charsets.UTF_8)
}

private fun hexDigit(byte: Byte): Int = Character.digit(byte.toInt(), 16)

/**
 * The epoch milliseconds of a referrer's `touch_at`, the ISO-8601 UTC form the web SDK writes; `null`
 * for anything else.
 */
private fun parseReferrerTouchAt(text: String): Long? {
    for (pattern in listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")) {
        val formatter = SimpleDateFormat(pattern, Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        formatter.isLenient = false
        val position = ParsePosition(0)
        val date = formatter.parse(text, position)
        if (date != null && position.index == text.length) return date.time
    }
    return null
}

/** Meta's encrypted install referrer, as hex strings. Only the backend can read it. */
internal data class MetaEncryptedReferrer(val data: String, val nonce: String)

/**
 * Reads Meta's encrypted referrer out of a `utm_content` value, a JSON object or a JSON string
 * holding one. Meta warns its keys may change, so anything else is simply none.
 */
internal fun metaEncryptedReferrer(utmContent: Any?): MetaEncryptedReferrer? {
    val source = jsonObjectOf(jsonObjectOf(utmContent)?.opt("source")) ?: return null
    val data = (source.opt("data") as? String)?.takeIf { it.isNotBlank() } ?: return null
    val nonce = (source.opt("nonce") as? String)?.takeIf { it.isNotBlank() } ?: return null
    return MetaEncryptedReferrer(data, nonce)
}

private fun jsonObjectOf(value: Any?): JSONObject? = when (value) {
    is JSONObject -> value
    is String -> runCatching { JSONObject(value) }.getOrNull()
    else -> null
}

/** What Play Install Referrer answered about this install. Timestamps of 0 mean absent. */
internal data class PlayReferrerDetails(
    val installReferrer: String?,
    val clickTimestampSeconds: Long,
    val clickTimestampServerSeconds: Long,
)

/**
 * The touch a Play referrer carries, `null` for none: no touch parameters, or Google Play's organic
 * default. Values are campaign values only: a referrer never names an identity.
 *
 * The time is the earlier of Play's click and the `touch_at` a link from the web carries, which is
 * when the visitor first arrived from the campaign: the click on the store link alone would make an
 * expired ad click look fresh. A `touch_at` cannot move the touch later than Play's click, and one
 * in the future or unreadable is ignored. It is not a touch parameter: on its own it is no touch.
 */
internal fun playReferrerTouch(details: PlayReferrerDetails, nowMs: Long): Map<String, String>? {
    val params = parseReferrerQuery(details.installReferrer.orEmpty())
    val touchParams = params.filterKeys { it in TOUCH_PARAMS }
    if (touchParams.isEmpty() || isPlayOrganicDefault(touchParams)) return null

    val encrypted = metaEncryptedReferrer(touchParams["utm_content"])
    val clickedAtMs = (
        details.clickTimestampServerSeconds.takeIf { it > 0 }
            ?: details.clickTimestampSeconds.takeIf { it > 0 }
        )?.times(1_000) ?: nowMs
    val carriedAtMs = params["touch_at"]?.let(::parseReferrerTouchAt)?.takeIf { it in 1..nowMs }
    return buildMap {
        for (key in UTM_PARAMS + CLICK_ID_NETWORKS.keys) {
            touchParams[key]?.let { put(key, it.take(MAX_VALUE_LENGTH)) }
        }
        (if (encrypted != null) "meta" else adNetworkOf(touchParams))?.let { put("ad_network", it.take(MAX_VALUE_LENGTH)) }
        adCampaignIdOf(touchParams)?.let { put("ad_campaign_id", it.take(MAX_VALUE_LENGTH)) }
        touchParams["adset_id"]?.let { put("ad_adset_id", it.take(MAX_VALUE_LENGTH)) }
        touchParams["ad_id"]?.let { put("ad_id", it.take(MAX_VALUE_LENGTH)) }
        put("touch_source", TOUCH_SOURCE_PLAY)
        put("touch_at", formatIsoTimestamp(minOf(clickedAtMs, carriedAtMs ?: clickedAtMs)))
        if (encrypted != null) {
            remove("utm_content")
            put("meta_referrer_data", encrypted.data)
            put("meta_referrer_nonce", encrypted.nonce)
        }
    }
}

private fun isPlayOrganicDefault(touchParams: Map<String, String>): Boolean =
    touchParams.size == 2 &&
        touchParams["utm_source"]?.lowercase(Locale.ROOT) == "google-play" &&
        touchParams["utm_medium"]?.lowercase(Locale.ROOT) == "organic"

/** One row of a Meta app's install referrer provider, every column as the text the cursor gave. */
internal data class MetaReferrerRow(
    val installReferrer: String?,
    val isClickThrough: String?,
    val actualTimestampSeconds: String?,
)

/**
 * The touch a Meta app reports for this install, `null` when its row carries no referrer. A row with
 * a referrer is a Meta touch even when the encrypted values are not where they used to be: Meta's
 * keys may change, and the network, kind and time are still worth having.
 */
internal fun metaReferrerTouch(row: MetaReferrerRow, nowMs: Long): Map<String, String>? {
    val raw = row.installReferrer?.takeIf { it.isNotBlank() } ?: return null
    val referrer = runCatching { JSONObject(raw) }.getOrNull()
    val encrypted = metaEncryptedReferrer(referrer?.opt("utm_content"))
    val touchedAtSeconds = row.actualTimestampSeconds?.trim()?.toLongOrNull()?.takeIf { it > 0 }
    return buildMap {
        for (key in UTM_PARAMS) {
            (referrer?.opt(key) as? String)?.trim()?.takeIf { it.isNotEmpty() }?.let { put(key, it.take(MAX_VALUE_LENGTH)) }
        }
        put("ad_network", "meta")
        put("touch_source", TOUCH_SOURCE_META)
        when (row.isClickThrough?.trim()?.toLongOrNull()) {
            1L -> put("touch_kind", "click")
            0L -> put("touch_kind", "view")
            else -> {}
        }
        put("touch_at", formatIsoTimestamp(touchedAtSeconds?.times(1_000) ?: nowMs))
        if (encrypted != null) {
            remove("utm_content")
            put("meta_referrer_data", encrypted.data)
            put("meta_referrer_nonce", encrypted.nonce)
        }
    }
}

/**
 * The properties of a touch's [TOUCH_EVENT]: the web SDK's wire format, every key under both
 * prefixes. A key the touch lacks is written as `null`, since person traits are folded key by key
 * and a key left out would keep the value of another touch.
 */
internal fun touchEventProperties(touch: Map<String, String>): Map<String, Any?> = mapOf(
    "\$process_person_profile" to true,
    "\$set" to TOUCH_KEYS.associate { "\$latest_$it" to touch[it] },
    "\$set_once" to TOUCH_KEYS.associate { "\$initial_$it" to touch[it] },
)
