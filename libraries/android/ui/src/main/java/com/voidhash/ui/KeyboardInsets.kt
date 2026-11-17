// Adapted from the Flutter engine's Android embedder (ImeSyncDeferringInsetsCallback.java in
// shell/platform/android/io/flutter/plugin/editing).
// Copyright 2013 The Flutter Authors. All rights reserved.
// Use of the adapted parts is governed by the BSD-style license in THIRD_PARTY_NOTICES.md.

package com.voidhash.ui

import android.annotation.TargetApi
import android.os.Build
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsAnimation

/**
 * How much of a view's bottom the keyboard covers, in pixels.
 *
 * The keyboard takes [keyboardHeight] from the bottom of the window. A view that ends above the
 * window's bottom, or that the window already resized to end above the keyboard, is covered by
 * less, or not at all.
 *
 * @param viewBottom the view's bottom edge, from the top of the window.
 */
internal fun keyboardOverlap(keyboardHeight: Int, windowHeight: Int, viewBottom: Int, viewHeight: Int): Int {
    if (keyboardHeight <= 0 || viewHeight <= 0) return 0
    return (keyboardHeight - (windowHeight - viewBottom)).coerceIn(0, viewHeight)
}

/**
 * The keyboard's height from the insets of a window before Android 11, which does not name it:
 * what the bottom inset has beyond the system bars, as it has while the keyboard is shown in a
 * window that resizes for it.
 */
internal fun legacyKeyboardHeight(systemWindowInsetBottom: Int, stableInsetBottom: Int): Int =
    (systemWindowInsetBottom - stableInsetBottom).coerceAtLeast(0)

/**
 * Follows Android's keyboard for a view: how much of the view it covers, frame by frame while it
 * slides in or out where the platform reports that (Android 11 and later), and whether it is
 * shown.
 *
 * @param onOverlap the pixels of the view's bottom the keyboard covers.
 * @param onVisibility whether the keyboard is shown, once it is known to have changed.
 */
internal class KeyboardInsetObserver(
    private val view: View,
    private val onOverlap: (pixels: Int) -> Unit,
    private val onVisibility: (visible: Boolean) -> Unit,
) {
    /** While the keyboard slides, its height comes from the animation, not the window's insets. */
    private var animating = false
    private var visible = false

    init {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) Animation.follow(view, this)
    }

    /** Reads the keyboard from the window's insets; call when they or the view's place change. */
    fun update() {
        val insets = view.rootWindowInsets
        if (insets == null) {
            onOverlap(0)
            return
        }
        val height: Int
        val shown: Boolean
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            height = insets.getInsets(WindowInsets.Type.ime()).bottom
            shown = insets.isVisible(WindowInsets.Type.ime())
        } else {
            @Suppress("DEPRECATION")
            height = legacyKeyboardHeight(insets.systemWindowInsetBottom, insets.stableInsetBottom)
            shown = height > 0
        }
        if (!animating) report(height)
        if (shown != visible) {
            visible = shown
            onVisibility(shown)
        }
    }

    /** The view left its window: nothing covers it. */
    fun detached() {
        animating = false
        onOverlap(0)
    }

    private fun report(keyboardHeight: Int) {
        val location = IntArray(2)
        view.getLocationInWindow(location)
        onOverlap(keyboardOverlap(keyboardHeight, view.rootView.height, location[1] + view.height, view.height))
    }

    @TargetApi(Build.VERSION_CODES.R)
    private class Animation(private val observer: KeyboardInsetObserver) :
        WindowInsetsAnimation.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
        override fun onPrepare(animation: WindowInsetsAnimation) {
            if (animation.typeMask and WindowInsets.Type.ime() != 0) observer.animating = true
        }

        override fun onProgress(insets: WindowInsets, running: MutableList<WindowInsetsAnimation>): WindowInsets {
            if (observer.animating) observer.report(insets.getInsets(WindowInsets.Type.ime()).bottom)
            return insets
        }

        override fun onEnd(animation: WindowInsetsAnimation) {
            if (animation.typeMask and WindowInsets.Type.ime() == 0) return
            observer.animating = false
            observer.update()
        }

        companion object {
            fun follow(view: View, observer: KeyboardInsetObserver) {
                view.setWindowInsetsAnimationCallback(Animation(observer))
            }
        }
    }
}
