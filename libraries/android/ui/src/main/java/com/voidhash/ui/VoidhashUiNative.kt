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

    /**
     * Shows [bytes] with the runtime its release needs: in module mode the module
     * [nativeRuntimePrepare] chose for the release's module [sha256] (empty for a release naming
     * none); otherwise as [nativeLoadPackage]. Returns `null` on success, otherwise the error.
     */
    @JvmStatic
    external fun nativeLoadPackageFor(handle: Long, bytes: ByteArray, sha256: String): String?

    /** Chooses the flow runtime: 0 the one linked into the SDK (the default), 1 runtime modules. */
    @JvmStatic
    external fun nativeSetRuntimeMode(mode: Int)

    /** The flow runtime newly shown packages run with: 0 linked, 1 modules. */
    @JvmStatic
    external fun nativeRuntimeMode(): Int

    /** The newest runtime bridge version the engine hosts. */
    @JvmStatic
    external fun nativeRuntimeBridgeVersion(): Int

    /** Where downloaded runtime modules are kept. Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeRuntimeSetCacheDirectory(path: String): String?

    /**
     * Advances the choice of the runtime module a release needs: `ready`, `waiting` or
     * `unavailable: <reason>`. May compile a module: never on the main thread.
     */
    @JvmStatic
    external fun nativeRuntimePrepare(version: String, sha256: String, url: String): String

    /** The next runtime module to download, as `<sha256> <url>`, or `null`. */
    @JvmStatic
    external fun nativeRuntimeTakeDownload(): String?

    /** Hands over a downloaded runtime module. Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeRuntimeDownloadFinished(sha256: String, bytes: ByteArray): String?

    /** Reports a failed runtime module download. Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeRuntimeDownloadFailed(sha256: String, reason: String): String?

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

    /**
     * Replaces the whole text of the text field [nodeId] (the `setText` action), as assistive
     * technology does for the end user; the field needs no focus. `null` on success.
     */
    @JvmStatic
    external fun nativeAccessibilitySetText(handle: Long, nodeId: Int, text: String): String?

    // Text input. Every call acts on the input that has the keyboard and answers at once.
    // Offsets are UTF-16 code units, the unit of a `CharSequence`; rectangles are
    // `[x, y, width, height]` in dp.

    /**
     * Replaces [start]..[end] of the text before the edit with [text], and sets the selection
     * and composing range of the text after it ([composingMode]: 0 keep, 1 set, 2 clear).
     * Returns the revision of the editing state after the edit, or -1 when no input is focused
     * or the edit was refused.
     */
    @JvmStatic
    external fun nativeTextReplace(
        handle: Long,
        start: Int,
        end: Int,
        text: String,
        selectionBase: Int,
        selectionExtent: Int,
        composingMode: Int,
        composingStart: Int,
        composingEnd: Int,
    ): Long

    /** Moves the selection and ends any composition. */
    @JvmStatic
    external fun nativeTextSetSelection(handle: Long, base: Int, extent: Int): Boolean

    /** The editing state as the JSON of a `textState` payload, or `null` when no input is focused. */
    @JvmStatic
    external fun nativeTextState(handle: Long): String?

    /** The return key: `newline`, `next`, `done`, `go`, `search` or `send`. */
    @JvmStatic
    external fun nativeTextAction(handle: Long, action: String): Boolean

    /**
     * A key the input method did not take, as its USB HID [usage] and a modifier mask (1 shift,
     * 2 control, 4 alt, 8 command). Returns whether the input used it.
     */
    @JvmStatic
    external fun nativeTextKey(handle: Long, usage: Int, modifiers: Int): Boolean

    @JvmStatic
    external fun nativeTextUndo(handle: Long): Boolean

    @JvmStatic
    external fun nativeTextRedo(handle: Long): Boolean

    /** Takes the keyboard from the input: the platform dismissed it. */
    @JvmStatic
    external fun nativeTextBlur(handle: Long)

    /** Where the caret would be at [offset], or `null` when no input is focused. */
    @JvmStatic
    external fun nativeTextCaretRect(handle: Long, offset: Int): FloatArray?

    /** The rectangles covering [start]..[end], four numbers each. */
    @JvmStatic
    external fun nativeTextRectsForRange(handle: Long, start: Int, end: Int): FloatArray?

    /** The offset nearest to a point of the surface, or -1 when no input is focused. */
    @JvmStatic
    external fun nativeTextPositionForPoint(handle: Long, x: Float, y: Float): Int

    /** Where the input is drawn, or `null` when no input is focused. */
    @JvmStatic
    external fun nativeTextBounds(handle: Long): FloatArray?

    /** How much of the surface's bottom the keyboard covers, in dp; 0 when it is hidden. */
    @JvmStatic
    external fun nativeSetKeyboardInset(handle: Long, height: Float)
}

/** Bits of the value [VoidhashUiNative.nativeFrame] returns. */
internal object FrameFlags {
    const val PAINTED = 1
    const val WANTS_NEXT_FRAME = 1 shl 1
    const val HAS_MESSAGES = 1 shl 2
    const val HAS_SEMANTICS = 1 shl 3
    const val ERROR = 1 shl 31
}
