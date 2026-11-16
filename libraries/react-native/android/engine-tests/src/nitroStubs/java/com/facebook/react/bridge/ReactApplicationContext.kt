package com.facebook.react.bridge

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper

/** JVM stand-in for React Native's application context. */
open class ReactApplicationContext(base: Context) : ContextWrapper(base) {
    open val currentActivity: Activity? get() = null
}
