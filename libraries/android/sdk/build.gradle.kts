plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.voidhash.sdk"
    // The package's gradle.properties sets these; a build that vendors the module may not.
    compileSdk = (findProperty("Voidhash_compileSdkVersion") as String?)?.toInt() ?: 35

    defaultConfig {
        minSdk = (findProperty("Voidhash_minSdkVersion") as String?)?.toInt() ?: 23
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

// Through the `com.android.build.api.dsl` type, which reads the same under the Android Gradle plugin
// of an app that builds this module from source; the `android` block's own accessor does not.
extensions.getByType<com.android.build.api.dsl.LibraryExtension>().sourceSets.getByName("test")
    .resources.srcDir("../../test-fixtures")

kotlin {
    compilerOptions {
        // The Java target set above, which an app that builds this module from source raises for every
        // module (React Native's Gradle plugin sets 17); the two must match.
        jvmTarget.set(
            provider {
                org.jetbrains.kotlin.gradle.dsl.JvmTarget.fromTarget(
                    project.extensions.getByType<com.android.build.api.dsl.LibraryExtension>().compileOptions.targetCompatibility.toString(),
                )
            },
        )
        // The SDK's own code uses what it offers host SDKs freely.
        optIn.add("com.voidhash.sdk.VoidhashHostApi")
        // Interface members with a body are the JVM's default methods, so an implementation written
        // in Java gets their defaults.
        freeCompilerArgs.add("-Xjvm-default=all")
    }
}

dependencies {
    // A build that vendors the modules under other paths names the core one here.
    api(project((findProperty("voidhash.coreProjectPath") as String?) ?: ":core"))
    api("com.android.billingclient:billing:9.1.0")
    implementation("com.android.installreferrer:installreferrer:2.2")
    // `@RestrictTo` on what only the SDK's own flow renderer calls; class-retained, so no
    // dependency at run time.
    compileOnly("androidx.annotation:annotation:1.3.0")
    implementation("com.google.android.gms:play-services-base:18.7.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // Optional screen-tracking integrations: the SDK compiles against them but only
    // reaches them when the host app ships them (see `lifecycle/FragmentScreenTracking`
    // and `VoidhashScreenTracking`). The fragment version is the one play-services
    // already resolves at runtime; AGP's consistent resolution rejects any other.
    compileOnly("androidx.fragment:fragment:1.1.0")
    compileOnly("androidx.navigation:navigation-runtime:2.8.9")

    // `org.json` ships with the platform at runtime; the unit-test JVM only has
    // the stubbed `android.jar` implementation, so the real one is added for
    // tests. AGP appends the mockable android.jar last on the test classpath,
    // which lets this dependency win.
    testImplementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.13")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("androidx.fragment:fragment:1.1.0")
    testImplementation("androidx.navigation:navigation-runtime:2.8.9")
}
