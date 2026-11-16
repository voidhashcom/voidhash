package com.margelo.nitro.core

import com.facebook.jni.HybridData

/** JVM stand-in for Nitro's `HybridObject`: the shape the generated specs extend. */
abstract class HybridObject {
    protected open fun createCxxPart(): CxxPart = CxxPart(this)

    protected open class CxxPart(val javaPart: HybridObject) {
        protected open external fun initHybrid(): HybridData
    }
}
