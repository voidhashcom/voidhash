// JVM harness for the React Native Android layer: the Nitro-free flows core and the
// `VoidhashNativeClient` hybrid with its legacy storage importer. Included from
// `libraries/android/settings.gradle.kts`. Like the React Native module, it compiles the bare SDK's
// and core's sources into itself rather than depending on their modules, so the hybrid reaches
// the SDK's `internal` members exactly as it does when shipped. The Nitro-generated classes the
// hybrid implements are compiled from `nitrogen/generated`, over small stand-ins for Nitro's
// runtime (`src/nitroStubs`), which the JVM cannot load.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

val voidhashAndroid = file("../../../android")
val nitroGenerated = file("../../nitrogen/generated/android/kotlin/com/margelo/nitro/voidhash")

// Only what the native client's spec needs; the other generated specs bind classes not built here.
val nativeClientSpec = tasks.register<Sync>("nativeClientSpec") {
    from(nitroGenerated) {
        include("HybridVoidhashNativeClientSpec.kt", "Func_void_NativeClientEvent.kt", "Native*.kt")
    }
    into(layout.buildDirectory.dir("generated/native-client/com/margelo/nitro/voidhash"))
}

android {
    namespace = "com.voidhash.reactnative.enginetests"
    compileSdk = (project.property("Voidhash_compileSdkVersion") as String).toInt()

    defaultConfig {
        minSdk = (project.property("Voidhash_minSdkVersion") as String).toInt()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    sourceSets {
        getByName("main") {
            java.srcDir("../src/main/java/com/margelo/nitro/voidhash/flows")
            java.srcDir("../src/main/java/com/margelo/nitro/voidhash/client")
            java.srcDir(File(voidhashAndroid, "core/src/main/java"))
            java.srcDir(File(voidhashAndroid, "sdk/src/main/java"))
            java.srcDir(layout.buildDirectory.dir("generated/native-client"))
            java.srcDir("src/nitroStubs/java")
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

tasks.matching { it.name.startsWith("compile") && it.name.endsWith("Kotlin") }.configureEach {
    dependsOn(nativeClientSpec)
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8)
    }
}

dependencies {
    // What the SDK and core sources need, as in their own modules and the React Native module.
    implementation("com.android.billingclient:billing:9.1.0")
    implementation("com.android.installreferrer:installreferrer:2.2")
    implementation("com.google.android.gms:play-services-base:18.7.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.annotation:annotation:1.8.0")
    compileOnly("androidx.fragment:fragment:1.1.0")
    compileOnly("androidx.navigation:navigation-runtime:2.8.9")

    // See `sdk/build.gradle.kts`: the real `org.json` has to win over the stubbed android.jar.
    testImplementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.13")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
