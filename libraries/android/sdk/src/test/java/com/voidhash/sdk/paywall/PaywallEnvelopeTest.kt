package com.voidhash.sdk.paywall

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

private fun parseFailureCode(raw: String): String =
    assertFailsWith<PaywallEnvelopeParseException> { PaywallEnvelope.parse(raw) }.code

class PaywallEnvelopeTest {
    @Test
    fun `parses a well-formed envelope`() {
        val envelope = PaywallEnvelope.parse(
            """{"version":1,"type":"purchase","requestId":"req-1","payload":{"productId":"pro"}}""",
        )

        assertEquals("purchase", envelope.type)
        assertEquals("req-1", envelope.requestId)
        assertEquals("pro", envelope.payload.getString("productId"))
    }

    @Test
    fun `an absent request id is null`() {
        val envelope = PaywallEnvelope.parse("""{"version":1,"type":"ready"}""")

        assertNull(envelope.requestId)
        assertEquals(0, envelope.payload.length())
    }

    @Test
    fun `malformed json is rejected as INVALID_JSON`() {
        assertEquals("INVALID_JSON", parseFailureCode("{"))
        assertEquals("INVALID_JSON", parseFailureCode("""{"version":1,"""))
        assertEquals("INVALID_JSON", parseFailureCode("""{"version":1,"type":"ready"} trailing"""))
    }

    @Test
    fun `a non-object envelope is rejected as INVALID_ENVELOPE`() {
        assertEquals("INVALID_ENVELOPE", parseFailureCode("5"))
        assertEquals("INVALID_ENVELOPE", parseFailureCode("""["ready"]"""))
    }

    @Test
    fun `the version must be the integer 1`() {
        assertEquals("UNSUPPORTED_VERSION", parseFailureCode("""{"version":2,"type":"ready"}"""))
        assertEquals("UNSUPPORTED_VERSION", parseFailureCode("""{"version":"1","type":"ready"}"""))
        assertEquals("UNSUPPORTED_VERSION", parseFailureCode("""{"type":"ready"}"""))
    }

    @Test
    fun `unknown types are rejected as UNSUPPORTED_TYPE`() {
        assertEquals("UNSUPPORTED_TYPE", parseFailureCode("""{"version":1,"type":"nope"}"""))
        assertEquals("UNSUPPORTED_TYPE", parseFailureCode("""{"version":1,"type":7}"""))
        assertEquals("UNSUPPORTED_TYPE", parseFailureCode("""{"version":1}"""))
    }

    @Test
    fun `a present request id must be a non-empty string`() {
        assertEquals(
            "INVALID_ENVELOPE",
            parseFailureCode("""{"version":1,"type":"ready","requestId":""}"""),
        )
        assertEquals(
            "INVALID_ENVELOPE",
            parseFailureCode("""{"version":1,"type":"ready","requestId":null}"""),
        )
        assertEquals(
            "INVALID_ENVELOPE",
            parseFailureCode("""{"version":1,"type":"ready","requestId":42}"""),
        )
    }

    @Test
    fun `payload-bearing types require a payload`() {
        assertEquals("INVALID_PAYLOAD", parseFailureCode("""{"version":1,"type":"purchase"}"""))
        assertEquals("INVALID_PAYLOAD", parseFailureCode("""{"version":1,"type":"openExternal"}"""))
        assertEquals("INVALID_PAYLOAD", parseFailureCode("""{"version":1,"type":"event"}"""))
        assertEquals("INVALID_PAYLOAD", parseFailureCode("""{"version":1,"type":"log"}"""))
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"purchase","payload":"pro"}"""),
        )
    }

    @Test
    fun `purchase requires a non-empty product id`() {
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"purchase","payload":{"productId":""}}"""),
        )
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"purchase","payload":{}}"""),
        )
    }

    @Test
    fun `openExternal requires a url`() {
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"openExternal","payload":{}}"""),
        )
    }

    @Test
    fun `event requires a name and object properties`() {
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"event","payload":{"properties":{}}}"""),
        )
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"event","payload":{"name":"x","properties":7}}"""),
        )

        val envelope = PaywallEnvelope.parse("""{"version":1,"type":"event","payload":{"name":"x"}}""")
        assertEquals("x", envelope.payload.getString("name"))
    }

    @Test
    fun `log requires a known level and a message`() {
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"log","payload":{"level":"trace","message":"m"}}"""),
        )
        assertEquals(
            "INVALID_PAYLOAD",
            parseFailureCode("""{"version":1,"type":"log","payload":{"level":"warn"}}"""),
        )

        val envelope = PaywallEnvelope.parse(
            """{"version":1,"type":"log","payload":{"level":"debug","message":"m"}}""",
        )
        assertEquals("debug", envelope.payload.getString("level"))
    }

    @Test
    fun `payload-free types tolerate a missing payload`() {
        assertEquals("ready", PaywallEnvelope.parse("""{"version":1,"type":"ready"}""").type)
        assertEquals("close", PaywallEnvelope.parse("""{"version":1,"type":"close"}""").type)
        assertEquals(
            "restore",
            PaywallEnvelope.parse("""{"version":1,"type":"restore","payload":null}""").type,
        )
    }
}
