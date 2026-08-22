package com.voidhash.example.nimbus

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper

/**
 * Walks the [ContextWrapper] chain to the hosting [Activity].
 *
 * The `Context` a composable reads from `LocalContext` is usually a
 * `ContextThemeWrapper`, not the activity — casting it directly is the classic
 * way to crash the first time someone starts a purchase. Play Billing and the
 * paywall presenter both need the real activity.
 */
tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}
