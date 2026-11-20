plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.voidhash.core"
    // The package's gradle.properties sets these; a build that vendors the module may not.
    compileSdk = (findProperty("Voidhash_compileSdkVersion") as String?)?.toInt() ?: 35

    defaultConfig {
        minSdk = (findProperty("Voidhash_minSdkVersion") as String?)?.toInt() ?: 23
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
        // The Java target set above, which an app that builds this module from source raises for every
        // module (React Native's Gradle plugin sets 17); the two must match.
        jvmTarget.set(
            provider {
                org.jetbrains.kotlin.gradle.dsl.JvmTarget.fromTarget(
                    project.extensions.getByType<com.android.build.api.dsl.LibraryExtension>().compileOptions.targetCompatibility.toString(),
                )
            },
        )
    }
}

dependencies {
    implementation("com.android.billingclient:billing:9.1.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.13")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
