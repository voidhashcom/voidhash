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
//     includeBuild("node_modules/@voidhash/android") { … }
//
// This example lives inside the SDK repository, so it points at the sources.
// The substitution maps the `com.voidhash:voidhash-android` coordinate used in
// `gradle/libs.versions.toml` onto the `:sdk` module of that build; the version
// declared there is never resolved from a repository.
includeBuild("../../libraries/android") {
    dependencySubstitution {
        substitute(module("com.voidhash:voidhash-android")).using(project(":sdk"))
    }
}
