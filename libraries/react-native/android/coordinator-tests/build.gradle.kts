plugins {
    kotlin("jvm") version "2.1.20"
}

repositories {
    mavenCentral()
}

sourceSets {
    main {
        kotlin.srcDir("../src/main/java")
        kotlin.include("com/margelo/nitro/voidhash/PurchaseOperationCoordinator.kt")
    }
}

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
