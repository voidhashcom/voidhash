import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

/**
 * Reads the publishable key from the uncommitted `local.properties`, falling
 * back to the `VOIDHASH_PUBLISHABLE_KEY` environment variable for CI. An empty
 * value builds fine — the app then renders setup instructions instead of
 * configuring the SDK.
 */
val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use(::load)
}

val publishableKey: String = localProperties.getProperty("voidhash.publishableKey")
    ?: System.getenv("VOIDHASH_PUBLISHABLE_KEY")
    ?: ""

/**
 * Overrides the Voidhash API origin, for example `http://10.0.2.2:8788` to reach
 * a backend running on the machine hosting the emulator. Empty means the SDK's
 * default origin.
 */
val apiBaseUrl: String = localProperties.getProperty("voidhash.apiBaseUrl")
    ?: System.getenv("VOIDHASH_API_BASE_URL")
    ?: ""

android {
    namespace = "com.voidhash.example.nimbus"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.voidhash.example.nimbus"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "VOIDHASH_PUBLISHABLE_KEY", "\"$publishableKey\"")
        buildConfigField("String", "VOIDHASH_API_BASE_URL", "\"$apiBaseUrl\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.voidhash.android)
    implementation(libs.voidhash.android.ui)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.kotlinx.coroutines.android)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
