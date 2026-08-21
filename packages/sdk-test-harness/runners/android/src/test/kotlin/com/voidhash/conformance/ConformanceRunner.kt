package com.voidhash.conformance

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse

/**
 * Generic conformance runner shared by every suite: it fetches step
 * descriptors from the harness control plane, replays them verbatim over
 * JDK HttpClient, and asserts the final report passes. It never encodes
 * fixture data locally, so suites can evolve without touching this file.
 */
class ConformanceRunner(private val baseUrl: String) {

    // HTTP/1.1 explicitly: JDK HttpClient's default h2c upgrade attempt sends
    // `Upgrade: h2c` headers, which HTTP servers treat as a protocol upgrade
    // request rather than a normal POST with a body.
    private val client = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()

    fun run(suiteName: String) {
        val session = createSession(suiteName)
        val steps = session.getAsJsonArray("steps")
        for (element in steps) {
            perform(session.get("sessionId").asString, element.asJsonObject)
        }
        val report = completeSession(session.get("sessionId").asString)
        check(report.get("pass").asBoolean) {
            "suite $suiteName failed:\n${report.get("violations")}"
        }
        println("suite $suiteName passed (${steps.size()} steps)")
    }

    private fun createSession(suiteName: String): JsonObject {
        val body = JsonObject().apply { addProperty("suite", suiteName) }
        val response = send("POST", "/__harness/sessions", body.toString())
        check(response.statusCode() == 200) {
            "failed to create session: ${response.statusCode()} ${response.body()} (sent: $suiteName)"
        }
        return JsonParser.parseString(response.body()).asJsonObject
    }

    private fun perform(sessionId: String, step: JsonObject) {
        val request = step.getAsJsonObject("request")
        val method = request.get("method").asString
        val path = request.get("path").asString
        val headers = mutableMapOf<String, String>()
        request.getAsJsonObject("headers")?.entrySet()?.forEach { (name, value) ->
            headers[name] = value.asString
        }
        request.getAsJsonArray("requireHeaders")?.forEach { header ->
            headers.putIfAbsent(header.asString, "conformance-${header.asString}")
        }

        val expected = step.getAsJsonArray("responses")?.firstOrNull()?.asJsonObject
        val expectedStatus = expected?.get("status")?.asInt ?: 200
        val expectedBody = expected?.get("body")

        val body: String? = request.get("body")?.let {
            headers["content-type"] = "application/json"
            it.toString()
        }

        val response = send(method, path, body, headers, sessionId)
        check(response.statusCode() == expectedStatus) {
            "step ${step.get("id").asString}: expected status $expectedStatus, got ${response.statusCode()}"
        }
        if (expectedBody != null && expectedBody.isJsonObject || expectedBody != null && expectedBody.isJsonArray) {
            val actual = JsonParser.parseString(response.body())
            check(jsonMatches(expectedBody, actual)) {
                "step ${step.get("id").asString}: body mismatch\nexpected: $expectedBody\nactual: $actual"
            }
        }
    }

    private fun completeSession(sessionId: String): JsonObject {
        val response = send("POST", "/__harness/sessions/$sessionId/complete", "{}")
        check(response.statusCode() == 200) { "failed to complete session: $response" }
        return JsonParser.parseString(response.body()).asJsonObject
    }

    private fun send(
        method: String,
        path: String,
        body: String?,
        headers: Map<String, String> = emptyMap(),
        sessionId: String? = null,
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder()
            .uri(URI.create("$baseUrl$path"))
            .header("content-type", "application/json")
        if (sessionId != null) {
            builder.header("x-harness-session", sessionId)
        }
        for ((name, value) in headers) {
            builder.header(name, value)
        }
        builder.method(
            method,
            java.net.http.HttpRequest.BodyPublishers.ofString(body ?: ""),
        )
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    companion object {
        /** Structural JSON equality with a tiny float tolerance so JS/Swift/Kotlin number round-trips stay comparable. */
        fun jsonMatches(expected: JsonElement, actual: JsonElement): Boolean = when {
            expected.isJsonNull -> actual.isJsonNull
            expected.isJsonPrimitive && actual.isJsonPrimitive -> {
                val e = expected.asJsonPrimitive
                val a = actual.asJsonPrimitive
                if (e.isNumber && a.isNumber) {
                    Math.abs(e.asDouble - a.asDouble) <= 1e-9 * maxOf(1.0, Math.abs(e.asDouble))
                } else {
                    e == a
                }
            }
            expected.isJsonArray && actual.isJsonArray -> {
                val e = expected.asJsonArray
                val a = actual.asJsonArray
                e.size() == a.size() && (0 until e.size()).all { jsonMatches(e[it], a[it]) }
            }
            expected.isJsonObject && actual.isJsonObject -> {
                val e = expected.asJsonObject
                val a = actual.asJsonObject
                e.entrySet().all { (key, value) -> a.has(key) && jsonMatches(value, a.get(key)) } &&
                    e.size() == a.size()
            }
            else -> false
        }
    }
}
