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

// Each module's project is named after the Maven artifact it publishes, so a build that includes
// this one (`includeBuild`) substitutes it for `com.voidhash:<artifact>`, the same coordinate an
// app resolves from Maven Central.
include(":voidhash-core", ":voidhash")
project(":voidhash-core").projectDir = file("core")
project(":voidhash").projectDir = file("sdk")

// The renderer that draws flows; an app that depends on it presents them.
if (file("ui/build.gradle.kts").exists()) {
    include(":voidhash-ui")
    project(":voidhash-ui").projectDir = file("ui")
}

// The modules name each other by these project paths (see the README on vendoring them).
gradle.beforeProject {
    extensions.extraProperties["voidhash.coreProjectPath"] = ":voidhash-core"
    extensions.extraProperties["voidhash.sdkProjectPath"] = ":voidhash"
}

// JVM harness for the React Native Android engine core; lives with the React Native
// module but compiles the SDK's sources, so it is built from here.
val reactNativeEngineTests = file("../react-native/android/engine-tests")
if (reactNativeEngineTests.exists()) {
    include(":react-native-engine-tests")
    project(":react-native-engine-tests").projectDir = reactNativeEngineTests
}
