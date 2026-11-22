package com.voidhash.sdk.flows

import android.app.Activity
import com.voidhash.sdk.api.FlowPackageReference
import java.util.ServiceLoader

/**
 * Draws flows natively. The `com.voidhash:voidhash-ui` artifact provides one, `FlowViewRenderer`,
 * which the SDK finds by itself once the app depends on it ([FlowRendererDiscovery]); pass a
 * renderer as [com.voidhash.sdk.VoidhashOptions.flowRenderer] only to use another one.
 *
 * The SDK downloads and verifies a flow's package and asks the renderer to present it;
 * purchases, restores, dismissal and every other flow action run through the SDK. [present] is
 * called on the main thread.
 */
interface FlowRenderer {
    /**
     * Whether this renderer can draw packages of flow-package format [abiVersion] on this
     * device. May be called on any thread.
     */
    fun supportsAbiVersion(abiVersion: Int): Boolean

    /**
     * What this renderer's engine can run, reported when the SDK resolves a paywall so the
     * backend serves only flows it can show. `null` reports nothing, and the backend then serves
     * only flows the first engine release could show. May be called on any thread.
     */
    val engineCapabilities: FlowEngineCapabilities?
        get() = null

    /**
     * Presents [flowPackage] fullscreen above [activity].
     *
     * The flow reports its messages (`ready`, `purchase`, `restore`, `close`, `finish`,
     * `openExternal`, `requestPermission`, `setAttribute`, `track`, `screen`, `state`, `log`) as
     * JSON envelopes to [FlowRendererHost.onMessage] and accepts the SDK's `configure`,
     * `status` and `response` envelopes through [FlowRendererSession.postMessage].
     *
     * @throws Exception when the flow cannot be presented; the SDK then reports
     *   `FlowFailure.PRESENTATION_FAILED`.
     */
    fun present(
        activity: Activity,
        flowPackage: ByteArray,
        host: FlowRendererHost,
    ): FlowRendererSession

    /**
     * Whether this renderer can draw the release whose package [reference] describes. A renderer
     * running the flow runtime as a downloaded module draws any release naming a runtime module;
     * by default, whether it reads the package's format. May be called on any thread.
     */
    fun supports(reference: FlowPackageReference): Boolean = supportsAbiVersion(reference.abiVersion)

    /**
     * Gets what the renderer needs, beyond the package, to draw [reference] above [activity]: in
     * module mode the runtime module the release names. Called off the main thread before
     * [present]; nothing to do by default.
     *
     * @throws Exception when the flow cannot be drawn; the SDK then reports it unavailable.
     */
    suspend fun prepare(activity: Activity, reference: FlowPackageReference) {}

    /**
     * Switches the renderer to flow runtime modules, process-wide, for a host that cannot name
     * the renderer's class (the React Native `flowRuntime: "module"` option). Called before the
     * client resolves its first flow; does nothing by default.
     */
    fun useRuntimeModules() {}

    /**
     * Turns the renderer's loading state on or off, for a host that cannot name the renderer's
     * class (React Native's `flowLoading` option). Called before the client presents a flow; does
     * nothing by default.
     */
    fun useLoading(shows: Boolean) {}

    /** Presents [flowPackage], described by [reference]; see [present], which it calls by default. */
    fun present(
        activity: Activity,
        flowPackage: ByteArray,
        reference: FlowPackageReference,
        host: FlowRendererHost,
    ): FlowRendererSession = present(activity, flowPackage, host)

    /**
     * Begins the loading state of a presentation that waits for its flow above [activity]: its
     * answer, its package, or the flow before it to leave the screen. The renderer shows it once
     * the presentation has waited a delay short enough to go unnoticed and long enough that a flow
     * already on the device is shown first; [waitedMs] says how long it has waited already, so a
     * loading state begun again above an activity recreated for a configuration change shows at
     * once. It stays until the SDK ends the returned session: once the flow [present] showed above
     * it has drawn, or when the presentation failed or was cancelled. Never begun while a flow is
     * on screen. Called on the main thread; `null`, the default, shows none.
     *
     * @param onCancel called on the main thread when the end user leaves the loading state: the
     *   SDK then cancels the presentation as the end user's, as it cancels it for the app.
     */
    fun beginLoading(activity: Activity, waitedMs: Long, onCancel: () -> Unit): FlowLoadingSession? = null
}

/** The loading state of one presentation; see [FlowRenderer.beginLoading]. Main thread. */
interface FlowLoadingSession {
    /**
     * How much longer, in milliseconds, the loading state wants to stay before a flow replaces
     * it, so one that just appeared is not a flash: 0, the default, when it is not on screen or
     * has been up long enough.
     */
    fun remainingMs(): Long = 0

    /** Takes the loading state down, or keeps it from showing. Called once. */
    fun end()
}

/** Receives what a presented flow reports. Called on the main thread. */
interface FlowRendererHost {
    /** One bridge envelope the flow emitted. */
    fun onMessage(message: String)

    /** A problem the flow recovered from, such as an image that failed to load. */
    fun onWarning(message: String)

    /**
     * The paywall could not keep running. The renderer dismisses it after reporting this, so
     * [onDismiss] follows.
     */
    fun onFailure(message: String)

    /** The paywall left the screen, however it was dismissed. Called once per session. */
    fun onDismiss()

    /**
     * Loads an image the flow shows, from the images the SDK keeps on the device or, when it
     * is not among them, from the network, off the calling thread. [onResult] gets the image's
     * bytes, or why it could not be had, on the main thread.
     *
     * The host verifies an image the flow's build pinned against the hash the package it
     * presents records ([FlowPackageImages.sha256]): it hands out only those bytes, and fails the
     * image with [FlowImageMismatchException] otherwise.
     *
     * @return whether the host loads the image. `false`, the default, leaves it to the renderer,
     *   and [onResult] is never called.
     */
    fun loadImage(url: String, onResult: (Result<ByteArray>) -> Unit): Boolean = false

    /**
     * The renderer could not use the image [loadImage] gave it for [url], because it is not an
     * image it decodes. The host stops keeping it, so the next presentation fetches it again.
     */
    fun onImageRejected(url: String) {}
}

/** A presented flow. Every method is called on the main thread. */
interface FlowRendererSession {
    /** Delivers one bridge envelope (`configure`, `status`, `response`) to the flow. */
    fun postMessage(message: String)

    /** Removes the flow from the screen; [FlowRendererHost.onDismiss] follows. */
    fun dismiss()
}

/**
 * Finds the renderer of a renderer artifact the app depends on without naming it in code.
 *
 * A renderer artifact registers its [FlowRenderer] as a `java.util.ServiceLoader` provider in
 * `META-INF/services/com.voidhash.sdk.flows.FlowRenderer`, with a public constructor without
 * arguments. `com.voidhash:voidhash-ui` registers its `FlowViewRenderer`, so an app that adds it
 * presents flows without configuring a renderer. R8 resolves the lookup at build time.
 */
object FlowRendererDiscovery {
    /**
     * A new instance of the first registered renderer, or `null` when the app links none.
     *
     * @throws java.util.ServiceConfigurationError when a registered renderer cannot be created.
     */
    @JvmStatic
    fun linkedRenderer(): FlowRenderer? {
        // This exact form (the interface's own class loader, then `iterator()`) is the one R8
        // rewrites into a direct construction of the registered class, skipping the lookup of
        // the service file on the device.
        val renderers = ServiceLoader.load(FlowRenderer::class.java, FlowRenderer::class.java.classLoader).iterator()
        return if (renderers.hasNext()) renderers.next() else null
    }
}
