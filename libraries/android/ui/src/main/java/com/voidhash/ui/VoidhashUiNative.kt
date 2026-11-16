package com.voidhash.ui

import android.view.Surface

/**
 * JNI surface of the native paywall renderer. Every call happens on the main thread; a handle
 * is bound to the [Surface] it was created for and must be destroyed before that surface is.
 */
internal object VoidhashUiNative {
    /** Whether the native library loaded; false on an ABI it was not built for. */
    val isAvailable: Boolean by lazy {
        try {
            System.loadLibrary("voidhash_ui")
            true
        } catch (error: UnsatisfiedLinkError) {
            false
        }
    }

    /** The newest flow-package format version the bundled engine reads. */
    @JvmStatic
    external fun nativePackageAbiVersion(): Int

    /** The oldest flow-package format version the bundled engine reads. */
    @JvmStatic
    external fun nativeMinPackageAbiVersion(): Int

    /** The newest code component ABI version the bundled engine runs. */
    @JvmStatic
    external fun nativeGuestAbiVersion(): Int

    /** The native components the bundled engine provides, comma-separated `id@version`. */
    @JvmStatic
    external fun nativeNativeComponents(): String?

    /** Creates a renderer drawing into [surface]; 0 on failure. */
    @JvmStatic
    external fun nativeCreate(surface: Surface): Long

    @JvmStatic
    external fun nativeDestroy(handle: Long)

    /** Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeLoadPackage(handle: Long, bytes: ByteArray): String?

    /** Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativePostMessage(handle: Long, message: String): String?

    /** Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeProvideImage(handle: Long, url: String, bytes: ByteArray): String?

    /** Sizes and insets in dp; [scale] is the display density. */
    @JvmStatic
    external fun nativeSetViewport(
        handle: Long,
        width: Float,
        height: Float,
        safeTop: Float,
        safeRight: Float,
        safeBottom: Float,
        safeLeft: Float,
        scale: Float,
    )

    /** [phase]: 0 down, 1 move, 2 up, 3 cancel. Coordinates in dp. */
    @JvmStatic
    external fun nativePointer(handle: Long, pointerId: Long, phase: Int, x: Float, y: Float, timestampSeconds: Double)

    /** Returns the frame flags; see [FrameFlags]. */
    @JvmStatic
    external fun nativeFrame(handle: Long, timestampSeconds: Double): Int

    /**
     * When the surface next needs a frame although its last frame did not want one: a
     * component's timer is due. Seconds on the clock of [nativeFrame]'s timestamps; infinite
     * when nothing is scheduled.
     */
    @JvmStatic
    external fun nativeWakeTime(handle: Long): Double

    /** The next message the paywall emitted, or `null` when there is none. */
    @JvmStatic
    external fun nativeTakeMessage(handle: Long): String?

    /** Turns the accessibility tree on while assistive technology is active. */
    @JvmStatic
    external fun nativeSetAccessibilityEnabled(handle: Long, enabled: Boolean)

    /** The accessibility tree as JSON if it changed since the last call, otherwise `null`. */
    @JvmStatic
    external fun nativeTakeSemantics(handle: Long): String?

    /** Performs an accessibility [action] (`activate`, `scrollUp`, …); `null` on success. */
    @JvmStatic
    external fun nativeAccessibilityAction(handle: Long, nodeId: Int, action: String): String?
}

/** Bits of the value [VoidhashUiNative.nativeFrame] returns. */
internal object FrameFlags {
    const val PAINTED = 1
    const val WANTS_NEXT_FRAME = 1 shl 1
    const val HAS_MESSAGES = 1 shl 2
    const val HAS_SEMANTICS = 1 shl 3
    const val ERROR = 1 shl 31
}
