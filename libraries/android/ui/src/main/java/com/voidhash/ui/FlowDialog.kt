package com.voidhash.ui

import android.app.Activity
import android.app.Application
import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.window.BackEvent
import android.window.OnBackAnimationCallback
import android.window.OnBackInvokedDispatcher
import com.voidhash.sdk.flows.FlowRendererHost
import com.voidhash.sdk.flows.FlowRendererSession

/**
 * Presents a renderer's flow [view] the way every renderer of this module does: in a
 * fullscreen dialog above [activity], drawn edge to edge with the system bars as its safe area.
 *
 * The back button goes to the flow as the `back` envelope through [postMessage]; the flow goes
 * back through its screens and asks to close from its first one, so the dialog does not cancel
 * itself. The dialog goes with its activity: one destroyed underneath the paywall dismisses it,
 * and the SDK presents the flow again above an activity recreated for a configuration change.
 * Dismissing it, however it happens, calls [release] and then [FlowRendererHost.onDismiss].
 *
 * [start] runs before the dialog is shown, with the function that reports a failure to the host
 * and dismisses the dialog: it connects the view's callbacks and loads the package.
 *
 * With [predictiveBack], the predictive back gesture (API 34, in apps that opt into it) is told to
 * it as it moves, and the `back` envelope follows its completion.
 */
internal fun presentInDialog(
    activity: Activity,
    view: View,
    host: FlowRendererHost,
    postMessage: (String) -> Unit,
    release: () -> Unit,
    predictiveBack: PredictiveBack? = null,
    start: (fail: (String) -> Unit) -> Unit,
): FlowRendererSession {
    val dialog = Dialog(activity, android.R.style.Theme_Black_NoTitleBar)
    dialog.setContentView(
        view,
        ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
    )
    dialog.window?.let(::drawEdgeToEdge)

    // A dialog cannot outlive its activity; one destroyed underneath the paywall (a
    // configuration change, `finish()`) dismisses it instead of leaking its window. After a
    // configuration change the SDK presents the flow again above the recreated activity.
    val lifecycle = object : EmptyActivityLifecycleCallbacks() {
        override fun onActivityDestroyed(destroyed: Activity) {
            if (destroyed === activity) dialog.dismiss()
        }
    }
    activity.application.registerActivityLifecycleCallbacks(lifecycle)

    // Back is the flow's to answer: it asks to close (a `close` message) only from its
    // first screen, so the dialog does not cancel itself.
    dialog.setCancelable(false)
    dialog.setOnKeyListener { _, keyCode, event ->
        if (keyCode != KeyEvent.KEYCODE_BACK) return@setOnKeyListener false
        if (event.action == KeyEvent.ACTION_UP && !event.isCanceled) {
            postMessage(BACK_MESSAGE)
        }
        true
    }
    // Apps that opt into predictive back receive it here instead of as a key event.
    if (predictiveBack != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        dialog.onBackInvokedDispatcher.registerOnBackInvokedCallback(
            OnBackInvokedDispatcher.PRIORITY_DEFAULT,
            object : OnBackAnimationCallback {
                override fun onBackStarted(backEvent: BackEvent) = predictiveBack.started()

                override fun onBackProgressed(backEvent: BackEvent) = predictiveBack.progressed(backEvent.progress)

                override fun onBackCancelled() = predictiveBack.cancelled()

                override fun onBackInvoked() {
                    predictiveBack.invoked()
                    postMessage(BACK_MESSAGE)
                }
            },
        )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        dialog.onBackInvokedDispatcher.registerOnBackInvokedCallback(
            OnBackInvokedDispatcher.PRIORITY_DEFAULT,
        ) { postMessage(BACK_MESSAGE) }
    }
    dialog.setOnDismissListener {
        activity.application.unregisterActivityLifecycleCallbacks(lifecycle)
        release()
        host.onDismiss()
    }

    start { message ->
        host.onFailure(message)
        dialog.dismiss()
    }
    try {
        dialog.show()
    } catch (error: RuntimeException) {
        activity.application.unregisterActivityLifecycleCallbacks(lifecycle)
        release()
        throw error
    }

    val deliver = postMessage
    return object : FlowRendererSession {
        override fun postMessage(message: String) = deliver(message)

        override fun dismiss() = dialog.dismiss()
    }
}

private fun drawEdgeToEdge(window: Window) {
    window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    window.setBackgroundDrawable(ColorDrawable(Color.BLACK))
    window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
    // The flow makes room for the keyboard itself; a panned window would move it as well.
    @Suppress("DEPRECATION")
    window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        window.attributes = window.attributes.apply {
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        window.setDecorFitsSystemWindows(false)
    } else {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    }
}

/**
 * Follows the predictive back gesture before the flow answers the `back` it ends with: a
 * renderer previews going back by it.
 */
internal interface PredictiveBack {
    fun started()

    /** The gesture is [fraction] of the way, from `0` to `1`. */
    fun progressed(fraction: Float)

    fun cancelled()

    /** The gesture completed; the `back` envelope is posted right after. */
    fun invoked()
}

/** The bridge envelope reporting the platform's back button or gesture to the flow. */
private const val BACK_MESSAGE = """{"version":1,"type":"back","payload":{}}"""

private open class EmptyActivityLifecycleCallbacks : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}

    override fun onActivityStarted(activity: Activity) {}

    override fun onActivityResumed(activity: Activity) {}

    override fun onActivityPaused(activity: Activity) {}

    override fun onActivityStopped(activity: Activity) {}

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

    override fun onActivityDestroyed(activity: Activity) {}
}
