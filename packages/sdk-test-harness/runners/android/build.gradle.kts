plugins {
    kotlin("jvm") version "2.1.20"
}

repositories {
    mavenCentral()
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("com.google.code.gson:gson:2.11.0")
}

tasks.test {
    useJUnitPlatform()
    System.getenv("HARNESS_URL")?.let { systemProperty("HARNESS_URL", it) }
    testLogging {
        events("passed", "failed")
        showExceptions = true
    }
}
