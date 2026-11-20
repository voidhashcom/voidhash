# The SDK reads AndroidX Navigation destinations for screen names only in an app that uses
# Navigation, and checks for it at runtime. An app without Navigation has none of its classes, so
# shrinking must not fail over the references.
-dontwarn androidx.navigation.**
