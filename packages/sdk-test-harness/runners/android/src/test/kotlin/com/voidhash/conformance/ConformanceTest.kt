package com.voidhash.conformance

import kotlin.test.Test

class ConformanceTest {
    @Test
    fun mobileCoreSuite() {
        val baseUrl = System.getProperty("HARNESS_URL")
            ?: System.getenv("HARNESS_URL")
            ?: "http://127.0.0.1:4919"
        ConformanceRunner(baseUrl).run("mobile/core")
    }
}
