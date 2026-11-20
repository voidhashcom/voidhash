package com.voidhash.ui

/**
 * JNI surface of the views core (`libvoidhash_ui_views.so`). Every call happens on the main
 * thread, the one that created the handle. A handle measures text and registers fonts through
 * the [ViewsTextHost] it was created with, synchronously, during [nativeFrame] and
 * [nativeLoadPackage].
 */
internal object ViewsNative {
    /** Whether the native library loaded; false on an ABI it was not built for. */
    val isAvailable: Boolean by lazy {
        try {
            System.loadLibrary("voidhash_ui_views")
            true
        } catch (error: UnsatisfiedLinkError) {
            false
        }
    }

    /** The newest flow-package format version the views core reads. */
    @JvmStatic
    external fun nativePackageAbiVersion(): Int

    /** The oldest flow-package format version the views core reads. */
    @JvmStatic
    external fun nativeMinPackageAbiVersion(): Int

    /** The newest code component ABI version the views core runs. */
    @JvmStatic
    external fun nativeGuestAbiVersion(): Int

    /** The view operation batch version the views core writes. */
    @JvmStatic
    external fun nativeOperationsVersion(): Int

    // Native component registries (views protocol, "Registration"). A registry may be used from
    // any thread; a surface keeps its own reference to the registry it was created with.

    /** Creates an empty registry of the native components one renderer provides; 0 on failure. */
    @JvmStatic
    external fun nativeComponentsCreate(): Long

    /** Releases the host's handle of registry [components]; surfaces created with it keep theirs. */
    @JvmStatic
    external fun nativeComponentsRelease(components: Long)

    /**
     * Provides native component [id] at [version] under [renderer] to the surfaces of registry
     * [components]; `null` on success, otherwise why the core refused it. Registering the same
     * again succeeds.
     */
    @JvmStatic
    external fun nativeComponentsRegister(components: Long, id: String, version: String, renderer: String): String?

    /**
     * What a surface created with registry [components] provides, comma-separated `id@version`:
     * the components linked into the core and the registry's; 0 lists only the linked ones.
     */
    @JvmStatic
    external fun nativeComponentsCapabilities(components: Long): String?

    /** The number of files of the default font, Inter. */
    @JvmStatic
    external fun nativeDefaultFontCount(): Int

    /** The CSS weight of the default font's file at [index]. */
    @JvmStatic
    external fun nativeDefaultFontWeight(index: Int): Int

    /** A copy of the default font's file at [index]; `null` past the count. */
    @JvmStatic
    external fun nativeDefaultFont(index: Int): ByteArray?

    /**
     * Creates a surface measuring text and registering fonts through [host] and showing the
     * native components of registry [components] (only the linked ones when 0); 0 on failure.
     */
    @JvmStatic
    external fun nativeCreateSurface(host: ViewsTextHost, components: Long): Long

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

    // Flow runtime modules (runtime bridge spec, §6.1), process-wide; see `RuntimeModules`.

    /** Chooses the flow runtime: 0 the one linked into the core (the default), 1 runtime modules. */
    @JvmStatic
    external fun nativeSetRuntimeMode(mode: Int)

    /** The flow runtime newly shown packages run with: 0 linked, 1 modules. */
    @JvmStatic
    external fun nativeRuntimeMode(): Int

    /** The newest runtime bridge version the core hosts. */
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
    external fun nativeRuntimeDownloadFinished(sha256: String, module: ByteArray): String?

    /** Reports a failed runtime module download. Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeRuntimeDownloadFailed(sha256: String, reason: String): String?

    /** Removes the shown package; the next batch resets the views. */
    @JvmStatic
    external fun nativeReset(handle: Long)

    /** Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativePostMessage(handle: Long, message: String): String?

    /** The next message the paywall emitted, or `null` when there is none. */
    @JvmStatic
    external fun nativeTakeMessage(handle: Long): String?

    /** The view operations written since the last call, as one batch. */
    @JvmStatic
    external fun nativeTakeOperations(handle: Long): ByteArray?

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

    /** Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeImageLoaded(handle: Long, url: String): String?

    /** The platform's fonts changed: the next frame measures every text again. */
    @JvmStatic
    external fun nativeFontsChanged(handle: Long)

    @JvmStatic
    external fun nativePress(handle: Long, handler: Long)

    /**
     * [phase]: 0 down, 1 move, 2 up, 3 cancel; coordinates in the view's own dp. False only when
     * no shown view carries [handler].
     */
    @JvmStatic
    external fun nativePointer(handle: Long, handler: Long, pointerId: Long, phase: Int, x: Float, y: Float): Boolean

    /** An action no component takes presses the view, so it is true whenever a package is shown. */
    @JvmStatic
    external fun nativeAccessibilityAction(handle: Long, handler: Long, action: String): Boolean

    /** Returns `null` on success, otherwise the error. */
    @JvmStatic
    external fun nativeScreenEvent(handle: Long, nodeId: Int, event: String, closing: Boolean): String?

    /**
     * Delivers an event the native component of `external` view [nodeId] emitted, with a JSON
     * object [payload]: [COMPONENT_EVENT_TAKEN], [COMPONENT_EVENT_IGNORED] when the flow takes no
     * more events, or [COMPONENT_EVENT_FAILED] (no package, a stale view id, a payload that is
     * not an object).
     */
    @JvmStatic
    external fun nativeDeliverComponentEvent(handle: Long, nodeId: Int, name: String, payload: String): Int

    const val COMPONENT_EVENT_TAKEN = 1
    const val COMPONENT_EVENT_IGNORED = 0
    const val COMPONENT_EVENT_FAILED = -1

    /**
     * Writes prop [name] of the native component of `external` view [nodeId], [json] its new
     * value: [COMPONENT_PROP_WRITTEN], [COMPONENT_PROP_IGNORED] when nothing changed (the flow
     * ended, the prop may not be written or holds the value already), or [COMPONENT_PROP_FAILED]
     * (no package, a stale view id, a view that is not a component node's, no such prop, a value
     * not of its type). Run a frame after it: the value shows in the next one.
     */
    @JvmStatic
    external fun nativeWriteComponentProp(handle: Long, nodeId: Int, name: String, json: String): Int

    const val COMPONENT_PROP_WRITTEN = 1
    const val COMPONENT_PROP_IGNORED = 0
    const val COMPONENT_PROP_FAILED = -1

    /**
     * The size in dp the native component of `external` view [nodeId] wants; `NaN` leaves an axis
     * to the layout. False for a view showing no host-provided component, or a negative or
     * infinite size. Run a frame after it.
     */
    @JvmStatic
    external fun nativeSetComponentSize(handle: Long, nodeId: Int, width: Float, height: Float): Boolean

    // Text fields (views protocol, "Text input"). Run a frame after each call.

    /** The platform gave text field [nodeId] the keyboard. False when it is not a text field. */
    @JvmStatic
    external fun nativeTextFocused(handle: Long, nodeId: Int): Boolean

    /**
     * The platform took the keyboard from text field [nodeId] and gave it to no other field.
     * False when the surface had already moved the keyboard on.
     */
    @JvmStatic
    external fun nativeTextBlurred(handle: Long, nodeId: Int): Boolean

    /**
     * Text field [nodeId] changed: its whole [text], its selection in UTF-16 code units, whether
     * the input method composes in it and whether the end user made the change. Returns the
     * field's revision after the change, or -1 when it is not a text field.
     */
    @JvmStatic
    external fun nativeTextChanged(
        handle: Long,
        nodeId: Int,
        text: String,
        selectionBase: Int,
        selectionExtent: Int,
        composing: Boolean,
        byUser: Boolean,
    ): Long

    /**
     * [nativeTextChanged] for a change whose edit the platform named: it replaced
     * [replacedStart]..[replacedEnd] (UTF-16 code units of the text before it) with
     * [insertedLength] UTF-16 code units. The maximum length reads it, so a paste over a selection
     * of a full field is cut to fit rather than refused. -1 also for a negative offset.
     */
    @JvmStatic
    external fun nativeTextEdited(
        handle: Long,
        nodeId: Int,
        text: String,
        selectionBase: Int,
        selectionExtent: Int,
        replacedStart: Int,
        replacedEnd: Int,
        insertedLength: Int,
        composing: Boolean,
        byUser: Boolean,
    ): Long

    /** The return key of text field [nodeId]: `newline`, `next`, `done`, `go`, `search` or `send`. */
    @JvmStatic
    external fun nativeTextAction(handle: Long, nodeId: Int, action: String): Boolean

    /** A tap outside every text field while one has the keyboard. */
    @JvmStatic
    external fun nativeTextTapOutside(handle: Long)

    /** How much of the surface's bottom the keyboard covers, in dp; 0 when it is hidden. */
    @JvmStatic
    external fun nativeSetKeyboardInset(handle: Long, height: Float)

    /** Returns the frame flags; see [ViewsFrameFlags]. */
    @JvmStatic
    external fun nativeFrame(handle: Long, timestampSeconds: Double): Int

    /** Why the last frame failed, or `null`. */
    @JvmStatic
    external fun nativeLastError(handle: Long): String?

    /**
     * When the surface next needs a frame although its last frame did not want one: a
     * component's timer is due. Seconds on the clock of [nativeFrame]'s timestamps; infinite
     * when nothing is scheduled.
     */
    @JvmStatic
    external fun nativeWakeTime(handle: Long): Double
}

/** Bits of the value [ViewsNative.nativeFrame] returns (`VHV_FRAME_*`). */
internal object ViewsFrameFlags {
    const val WANTS_NEXT_FRAME = 1
    const val HAS_MESSAGES = 1 shl 1
    const val HAS_OPERATIONS = 1 shl 2
    const val ERROR = 1 shl 31
}

/**
 * The text stack the views core measures through, called from native code during a frame or a
 * package load. Its method names and signatures are part of the JNI contract.
 */
internal class ViewsTextHost(private val text: TextSystem) {
    /**
     * Measures a paragraph in logical pixels, exactly as a `text` view draws it. Returns the
     * width (high 32 bits) and height (low 32 bits) as float bit patterns. [runs] holds the text's
     * styled runs, seven ints each (see [TextRun.fromInts]), or is null.
     */
    @Suppress("unused") // Called from native code.
    fun measureText(
        content: String,
        family: String,
        size: Float,
        lineHeight: Float,
        letterSpacing: Float,
        weight: Int,
        italic: Boolean,
        align: Int,
        maxLines: Int,
        maxWidth: Float,
        scale: Float,
        runs: IntArray?,
    ): Long {
        val (width, height) = try {
            text.measure(
                content,
                TextStyle(family, size, weight, italic, lineHeight, letterSpacing, align, maxLines, TextRun.fromInts(runs)),
                maxWidth,
                scale,
            )
        } catch (error: RuntimeException) {
            0f to 0f
        }
        return (width.toRawBits().toLong() shl 32) or (height.toRawBits().toLong() and 0xFFFFFFFFL)
    }

    /**
     * Registers a font file a package carries as one more face of [family]: a family may come in
     * several files, its bold and italic faces. False when Android rejects it.
     */
    @Suppress("unused") // Called from native code.
    fun registerFont(family: String, data: ByteArray): Boolean {
        // Package fonts arrive while a package loads, before the tree it shows is laid out.
        val registered = text.fonts.register(family, data)
        if (registered) text.fontsChanged()
        return registered
    }
}
