plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

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

// The views host's JVM tests load the views core built for this machine, with its JNI bindings,
// from the Cargo workspace. Whenever it is built the tests require it, so a core that does not
// load fails them instead of skipping them. In CI (`CI` set) it is always built, and a build that
// fails fails the tests. Elsewhere, a machine without Cargo or the crates skips the tests that
// need the core, and `-Pvoidhash.skipViewsCore=true` skips them on purpose.
val cratesDir = file("../../../crates")
val viewsCoreDir = File(cratesDir, "target/debug")
val inCi = System.getenv("CI").let { !it.isNullOrEmpty() && it != "false" }
val cargo = (System.getenv("PATH").orEmpty().split(File.pathSeparator) + "${System.getProperty("user.home")}/.cargo/bin")
    .map { File(it, "cargo") }
    .firstOrNull { it.canExecute() }
val viewsCoreWanted = findProperty("voidhash.skipViewsCore") != "true" &&
    (inCi || (cargo != null && cratesDir.isDirectory))
// Like the SDK builds, the core bundles the newest released runtime module as the baseline
// module mode falls back to.
val runtimeModulesDir = file("../../../packages/first-party-components/runtime")
val bundledRuntimeModule = runtimeModulesDir.listFiles { file -> file.extension == "wasm" }.orEmpty()
    .maxByOrNull { file -> file.nameWithoutExtension.split('.').map { it.toIntOrNull() ?: 0 }.fold(0L) { sum, part -> sum * 10_000 + part } }
val buildViewsCoreForTests by tasks.registering(Exec::class) {
    description = "Builds the views core with its JNI bindings and the bundled runtime module for the JVM tests."
    workingDir = cratesDir
    commandLine(cargo?.path ?: "cargo", "build", "-p", "voidhash-ui-views", "--features", "jni,bundled-runtime")
    bundledRuntimeModule?.let { environment("VOIDHASH_RUNTIME_MODULE", it.absolutePath) }
    onlyIf("the views core is wanted for the tests") { viewsCoreWanted }
}

tasks.withType<Test>().configureEach {
    dependsOn(buildViewsCoreForTests)
    systemProperty("java.library.path", viewsCoreDir.absolutePath)
    systemProperty("voidhash.sourceRoot", file("../../..").absolutePath)
    systemProperty("voidhash.requireViewsCore", viewsCoreWanted.toString())
    bundledRuntimeModule?.let { systemProperty("voidhash.bundledRuntimeModule", it.absolutePath) }
    System.getenv("VOIDHASH_VIEWS_SNAPSHOT_DIR")?.let { environment("VOIDHASH_VIEWS_SNAPSHOT_DIR", it) }
    if (!viewsCoreWanted) {
        doFirst { logger.warn("Skipping the views tests that need the views core: it is not built (no Cargo, no crates, or -Pvoidhash.skipViewsCore=true).") }
    }
}

// The library redistributes the views core, a binary built from third-party crates, so the AAR
// carries the package's notices (which list them and their licenses) as a Java resource under a
// path of its own, which an app's packaging keeps beside other libraries' notices.
abstract class ThirdPartyNotices : DefaultTask() {
    @get:InputFile
    abstract val notices: RegularFileProperty

    @get:OutputDirectory
    abstract val output: DirectoryProperty

    @TaskAction
    fun copy() {
        val directory = output.get().dir("META-INF/com.voidhash/voidhash-ui").asFile
        directory.deleteRecursively()
        directory.mkdirs()
        notices.get().asFile.copyTo(File(directory, "THIRD_PARTY_NOTICES.md"))
    }
}

val noticesFile = file("../THIRD_PARTY_NOTICES.md")
if (noticesFile.isFile) {
    val thirdPartyNotices = tasks.register<ThirdPartyNotices>("thirdPartyNotices") {
        notices.set(noticesFile)
        output.set(layout.buildDirectory.dir("generated/thirdPartyNotices"))
    }
    androidComponents {
        onVariants { variant ->
            variant.sources.resources?.addGeneratedSourceDirectory(thirdPartyNotices, ThirdPartyNotices::output)
        }
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
    // A build that vendors the modules under other paths names the SDK one here.
    api(project((findProperty("voidhash.sdkProjectPath") as String?) ?: ":sdk"))
    // Waiting for a runtime module off the main thread; the SDK already depends on it.
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    testImplementation("org.json:json:20231013")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.13.13")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.robolectric:robolectric:4.16.1")
}
