package com.voidhash.sdk.paywall

import android.app.Activity

/**
 * Draws flows natively. The optional `ui` module provides one, `VoidhashUiPaywallRenderer`;
 * pass it as [com.voidhash.sdk.VoidhashOptions.paywallRenderer].
 *
 * The SDK downloads and verifies a flow's package and asks the renderer to present it;
 * purchases, restores, dismissal and every other flow action run through the SDK. [present] is
 * called on the main thread.
 */
interface PaywallRenderer {
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
     * JSON envelopes to [PaywallRendererHost.onMessage] and accepts the SDK's `configure`,
     * `status` and `response` envelopes through [PaywallRendererSession.postMessage].
     *
     * @throws Exception when the flow cannot be presented; the SDK then reports
     *   `FlowFailure.PRESENTATION_FAILED`.
     */
    fun present(
        activity: Activity,
        flowPackage: ByteArray,
        host: PaywallRendererHost,
    ): PaywallRendererSession
}

/** Receives what a presented paywall reports. Called on the main thread. */
interface PaywallRendererHost {
    /** One bridge envelope the paywall emitted. */
    fun onMessage(message: String)

    /** A problem the paywall recovered from, such as an image that failed to load. */
    fun onWarning(message: String)

    /**
     * The paywall could not keep running. The renderer dismisses it after reporting this, so
     * [onDismiss] follows.
     */
    fun onFailure(message: String)

    /** The paywall left the screen, however it was dismissed. Called once per session. */
    fun onDismiss()

    /**
     * Loads an image the paywall shows, from the images the SDK keeps on the device or, when it
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

/** A presented paywall. Every method is called on the main thread. */
interface PaywallRendererSession {
    /** Delivers one bridge envelope (`configure`, `status`, `response`) to the flow. */
    fun postMessage(message: String)

    /** Removes the paywall from the screen; [PaywallRendererHost.onDismiss] follows. */
    fun dismiss()
}
