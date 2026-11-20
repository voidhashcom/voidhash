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

// The SDK resolves from Maven Central at the version in `gradle/libs.versions.toml`, as in an
// app. `-Pvoidhash.sdkFromSource=true` (or the property in gradle.properties) builds it from the
// sources in this repository instead: Gradle substitutes the included build's modules for the
// `com.voidhash:voidhash` and `com.voidhash:voidhash-ui` coordinates. The renderer's native
// library is not part of those sources, so a source build draws flows only once it is built.
if (providers.gradleProperty("voidhash.sdkFromSource").orNull == "true") {
    includeBuild("../../libraries/android")
}
