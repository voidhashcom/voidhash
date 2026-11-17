plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

// Gives an included build's module the coordinate `com.voidhash:<module>`, so a host can
// substitute it (see the README's Install section).
group = "com.voidhash"

android {
    namespace = "com.voidhash.ui"
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

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8)
    }
}

dependencies {
    // A build that vendors the modules under other paths names the SDK one here.
    api(project((findProperty("voidhash.sdkProjectPath") as String?) ?: ":sdk"))
    // Waiting for a runtime module off the main thread; the SDK already depends on it.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.13")
}
