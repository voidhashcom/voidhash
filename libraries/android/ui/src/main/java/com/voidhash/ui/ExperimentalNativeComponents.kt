package com.voidhash.ui

/**
 * Marks the API for the app's own components, built from Android views, that flows show:
 * [NativeComponentFactory], [NativeComponent], [NativeComponentContext],
 * [NativeComponentEnvironment] and the [FlowViewRenderer] constructor taking them.
 * It is not yet part of the public API and may change without notice; opt in with
 * `@OptIn(ExperimentalNativeComponents::class)`.
 */
@RequiresOptIn(
    level = RequiresOptIn.Level.ERROR,
    message = "Native components are not yet part of the public API and may change without notice.",
)
@Retention(AnnotationRetention.BINARY)
@Target(AnnotationTarget.CLASS, AnnotationTarget.CONSTRUCTOR)
annotation class ExperimentalNativeComponents
