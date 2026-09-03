plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.voidhash.sdk"
    compileSdk = (project.property("Voidhash_compileSdkVersion") as String).toInt()

    defaultConfig {
        minSdk = (project.property("Voidhash_minSdkVersion") as String).toInt()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
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
    api(project(":core"))
    implementation("com.android.billingclient:billing-ktx:8.0.0")
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
