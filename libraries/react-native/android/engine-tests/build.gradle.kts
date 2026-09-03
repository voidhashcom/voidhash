// JVM harness for the Nitro-free cores of the React Native Android layer (engine, platform,
// storage).
// Included from `libraries/android/settings.gradle.kts` so it can depend on the bare SDK
// module; the source is compiled straight from the React Native module, so the class under
// test is the one shipped.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
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
            java.srcDir("../src/main/java/com/margelo/nitro/voidhash/engine")
            java.srcDir("../src/main/java/com/margelo/nitro/voidhash/platform")
            java.srcDir("../src/main/java/com/margelo/nitro/voidhash/storage")
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8)
    }
}

dependencies {
    implementation(project(":sdk"))
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // See `sdk/build.gradle.kts`: the real `org.json` has to win over the stubbed android.jar.
    testImplementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.13")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
