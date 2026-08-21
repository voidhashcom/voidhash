plugins {
    kotlin("jvm") version "2.0.21"
}

repositories {
    mavenCentral()
}

sourceSets {
    main {
        kotlin.srcDir("../../../android/core/src/main/java")
        kotlin.include("com/voidhash/core/billing/PurchaseOperationCoordinator.kt")
    }
}

dependencies {
    testImplementation(kotlin("test"))
}

tasks.test {
    useJUnitPlatform()
}
