pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "nimbus-android"

include(":app")

// A real project installs the SDK from npm and includes the package directory:
//
//     includeBuild("node_modules/@voidhash/android")
//
// This example lives inside the SDK repository, so it points at the sources.
// Gradle substitutes the included build's `:sdk` and `:ui` modules for the
// `com.voidhash:sdk` and `com.voidhash:ui` coordinates used in
// `gradle/libs.versions.toml`; the version declared there is never resolved
// from a repository.
includeBuild("../../libraries/android")
