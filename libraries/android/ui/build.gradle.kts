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
        // Robolectric reads the module's manifest; its native graphics draw the views host.
        unitTests.isIncludeAndroidResources = true
    }
}

// The views host's JVM tests load the views core built for this machine, with its JNI
// bindings, from the Cargo workspace; without a Rust toolchain they skip what needs it.
val cratesDir = file("../../../crates")
val viewsCoreDir = File(cratesDir, "target/debug")
val buildViewsCoreForTests by tasks.registering(Exec::class) {
    description = "Builds the views core with its JNI bindings for the JVM tests."
    workingDir = cratesDir
    commandLine("cargo", "build", "-p", "voidhash-ui-views", "--features", "jni")
    isIgnoreExitValue = true
    onlyIf { cratesDir.isDirectory }
}

tasks.withType<Test>().configureEach {
    dependsOn(buildViewsCoreForTests)
    systemProperty("java.library.path", viewsCoreDir.absolutePath)
    systemProperty("voidhash.sourceRoot", file("../../..").absolutePath)
    System.getenv("VOIDHASH_VIEWS_SNAPSHOT_DIR")?.let { environment("VOIDHASH_VIEWS_SNAPSHOT_DIR", it) }
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
    testImplementation("org.robolectric:robolectric:4.16.1")
}
