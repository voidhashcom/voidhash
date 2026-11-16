import java.time.Duration
import org.gradle.api.tasks.testing.logging.TestLogEvent

plugins {
    id("com.android.library") version "8.9.0" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
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
