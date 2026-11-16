package com.margelo.nitro

import com.facebook.react.bridge.ReactApplicationContext

/** JVM stand-in for Nitro's module registry; tests construct hybrids with explicit providers. */
object NitroModules {
    var applicationContext: ReactApplicationContext? = null
}
