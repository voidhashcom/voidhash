package com.voidhash.sdk.cache

import android.content.Context
import android.content.SharedPreferences

private const val PREFERENCES_NAME = "com.voidhash.sdk.cache"

/** [CacheAdapter] persisting to a private `SharedPreferences` file. */
class SharedPreferencesCacheAdapter(
    private val preferences: SharedPreferences,
) : CacheAdapter {
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE),
    )

    override fun get(key: String): String? = preferences.getString(key, null)

    override fun set(key: String, value: String) {
        preferences.edit().putString(key, value).apply()
    }

    override fun delete(key: String) {
        preferences.edit().remove(key).apply()
    }
}
