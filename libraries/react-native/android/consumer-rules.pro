# The flow renderer is found by name when the app compiles it in, so shrinking must keep it.
-keep class com.voidhash.ui.VoidhashUiPaywallRenderer {
    <init>();
}

# The SDK reads AndroidX Navigation destinations for screen names only in an app that uses
# Navigation, and checks for it at runtime. An app without Navigation has none of its classes, so
# shrinking must not fail over the references.
-dontwarn androidx.navigation.**
