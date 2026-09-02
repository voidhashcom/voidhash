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

rootProject.name = "voidhash-android"

include(":core")
include(":sdk")

// JVM harness for the React Native Android engine core; lives with the React Native
// module but needs `:sdk`, so it is built from here.
val reactNativeEngineTests = file("../react-native/android/engine-tests")
if (reactNativeEngineTests.exists()) {
    include(":react-native-engine-tests")
    project(":react-native-engine-tests").projectDir = reactNativeEngineTests
}
