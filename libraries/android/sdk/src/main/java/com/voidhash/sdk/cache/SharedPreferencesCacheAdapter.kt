package com.voidhash.sdk.cache

import android.content.Context
import android.content.SharedPreferences

private const val PREFERENCES_NAME = "com.voidhash.sdk.cache"

/** Written once a namespace has adopted whatever an unprefixed release left behind. */
internal const val LEGACY_MIGRATION_MARKER = "__legacy-migrated"

/** Every [CacheAdapter] the SDK persists through, plus the operations migration needs. */
interface EnumerableCacheAdapter : CacheAdapter {
    /** Every key currently stored, including keys outside this adapter's namespace. */
    fun allStoredKeys(): Set<String>

    /** Reads a key exactly as stored, bypassing the namespace prefix. */
    fun getRaw(key: String): String?

    /** Removes a key exactly as stored, bypassing the namespace prefix. */
    fun deleteRaw(key: String)
}

/**
 * [CacheAdapter] persisting to a private `SharedPreferences` file.
 *
 * Every stored key carries [keyPrefix] so entries belonging to different publishable keys
 * or API origins never collide inside the shared file.
 *
 * The `SharedPreferences` handle is resolved lazily: obtaining one parses the whole backing
 * XML file, which must not happen on the thread that called `Voidhash.configure`.
 */
class SharedPreferencesCacheAdapter private constructor(
    private val keyPrefix: String,
    preferencesProvider: () -> SharedPreferences,
) : EnumerableCacheAdapter {
    @JvmOverloads
    constructor(preferences: SharedPreferences, keyPrefix: String = "") :
        this(keyPrefix, { preferences })

    @JvmOverloads
    constructor(context: Context, keyPrefix: String = "") : this(
        keyPrefix,
        {
            context.applicationContext
                .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
        },
    )

    private val preferences: SharedPreferences by lazy(preferencesProvider)

    override fun get(key: String): String? = preferences.getString(keyPrefix + key, null)

    override fun set(key: String, value: String) {
        preferences.edit().putString(keyPrefix + key, value).apply()
    }

    override fun delete(key: String) {
        preferences.edit().remove(keyPrefix + key).apply()
    }

    override fun allStoredKeys(): Set<String> = preferences.all.keys.toSet()

    override fun snapshot(): Map<String, String> = preferences.all
        .asSequence()
        .filter { (key, value) -> key.startsWith(keyPrefix) && value is String }
        .associate { (key, value) -> key.removePrefix(keyPrefix) to value as String }

    override fun getRaw(key: String): String? = preferences.getString(key, null)

    override fun deleteRaw(key: String) {
        preferences.edit().remove(key).apply()
    }

    /**
     * Adopts the state an earlier, unnamespaced SDK release left in the same file.
     *
     * Before namespacing, everything — the distinct id, the analytics session, the last seen
     * app release, processed-transaction receipts, the per-app-version schema — lived under
     * bare keys. Simply switching to a prefix would orphan all of it: the device would
     * silently become a new anonymous user and re-fire `$app_installed`. This copies each
     * bare key into the namespace once and deletes the original, then records a marker so it
     * never runs again.
     *
     * The per-version schema entry is copied as-is; `SchemaManager` recognises it and
     * rewrites it under `schema:current` on the next read.
     */
    fun migrateLegacyEntries(): Boolean {
        if (keyPrefix.isEmpty()) return false
        if (preferences.getString(keyPrefix + LEGACY_MIGRATION_MARKER, null) != null) return false

        val editor = preferences.edit()
        var migrated = 0
        for (key in allStoredKeys()) {
            // Anything already namespaced belongs to some project, including this one.
            if (key.startsWith("vh:")) continue
            val value = preferences.getString(key, null) ?: continue
            editor.putString(keyPrefix + key, value)
            editor.remove(key)
            migrated += 1
        }
        editor.putString(keyPrefix + LEGACY_MIGRATION_MARKER, migrated.toString())
        editor.apply()
        return migrated > 0
    }
}
