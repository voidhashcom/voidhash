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

    /** Presents [flowPackage], described by [reference]; see [present], which it calls by default. */
    fun present(
        activity: Activity,
        flowPackage: ByteArray,
        reference: FlowPackageReference,
        host: FlowRendererHost,
    ): FlowRendererSession = present(activity, flowPackage, host)
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
