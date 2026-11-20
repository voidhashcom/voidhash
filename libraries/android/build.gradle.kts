import com.vanniktech.maven.publish.MavenPublishBaseExtension
import groovy.json.JsonSlurper
import java.time.Duration
import org.gradle.api.tasks.testing.logging.TestLogEvent

plugins {
    id("com.android.library") version "8.9.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("com.vanniktech.maven.publish") version "0.35.0" apply false
}

subprojects {
    tasks.withType<Test>().configureEach {
        // Each module's unit tests finish in under a minute, so a test that never returns
        // fails the run here instead of holding it silently until CI cancels the job. Gradle
        // reports the test still running when it stops the task as skipped, which names it.
        timeout.set(Duration.ofMinutes(5))
        testLogging.events(TestLogEvent.FAILED, TestLogEvent.SKIPPED)
    }
}

// Maven Central publishing. It is configured here rather than in the modules' own build files,
// so a build that vendors the modules (see the README) needs no publishing plugin. The version is
// the npm package's, which changesets set on release.
// Each project is named after its artifact (`settings.gradle.kts`).
val artifactDescriptions = mapOf(
    "voidhash-core" to "The shared native core of the Voidhash Android SDK.",
    "voidhash" to "The Voidhash Android SDK: purchases, entitlements, feature flags, analytics and flows.",
    "voidhash-ui" to "Draws Voidhash flows with Android views; the Voidhash SDK finds it when the app depends on it.",
)
val packageVersion = (JsonSlurper().parse(file("package.json")) as Map<*, *>)["version"] as String
// Signs only with a key at hand (`signingInMemoryKey`, or the `signing.*` properties), so local
// and CI dry runs publish unsigned. Maven Central refuses unsigned artifacts.
val hasSigningKey = listOf("signingInMemoryKey", "signing.keyId", "signing.gnupg.keyName").any { project.hasProperty(it) }

subprojects {
    val artifactId = name
    val artifactDescription = artifactDescriptions[name] ?: return@subprojects
    group = "com.voidhash"
    version = packageVersion
    pluginManager.withPlugin("com.android.library") {
        pluginManager.apply("com.vanniktech.maven.publish")
        extensions.configure<MavenPublishBaseExtension> {
            // The release variant with its sources and javadoc jars, which Maven Central requires.
            publishToMavenCentral()
            if (hasSigningKey) signAllPublications()
            coordinates("com.voidhash", artifactId, packageVersion)
            pom {
                name.set(artifactId)
                description.set(artifactDescription)
                url.set("https://voidhash.com")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/licenses/MIT")
                        distribution.set("repo")
                    }
                }
                developers {
                    developer {
                        id.set("voidhash")
                        name.set("Voidhash")
                        url.set("https://voidhash.com")
                    }
                }
                scm {
                    url.set("https://github.com/voidhashcom/voidhash")
                    connection.set("scm:git:https://github.com/voidhashcom/voidhash.git")
                    developerConnection.set("scm:git:ssh://git@github.com/voidhashcom/voidhash.git")
                }
            }
        }
    }
}
