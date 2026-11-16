# AndroidX Navigation is an optional integration: the SDK compiles against it and reaches it only
# in an app that ships it, for fragment destination names and VoidhashScreenTracking. An app
# without it must not fail its R8 build over classes the SDK never loads there.
-dontwarn androidx.navigation.**
