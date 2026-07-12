package com.margelo.nitro.voidhash

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PurchaseOperationCoordinatorTest {
    @Test
    fun `success completes the pending purchase exactly once`() {
        val coordinator = PurchaseOperationCoordinator<String>()
        val results = mutableListOf<Result<Array<String>>>()
        coordinator.begin(results::add)

        assertTrue(coordinator.succeed(arrayOf("purchase")))
        assertFalse(coordinator.succeed(arrayOf("duplicate")))
        assertEquals(listOf("purchase"), results.single().getOrThrow().toList())
        assertFalse(coordinator.hasPendingOperation())
    }

    @Test
    fun `provider failure clears the operation so purchase can retry`() {
        val coordinator = PurchaseOperationCoordinator<String>()
        val failures = mutableListOf<String>()
        coordinator.begin { result -> failures += result.exceptionOrNull()?.message.orEmpty() }

        assertTrue(coordinator.fail(IllegalStateException("provider failed")))
        coordinator.begin { result -> failures += result.getOrThrow().single() }
        assertTrue(coordinator.succeed(arrayOf("retry succeeded")))
        assertEquals(listOf("provider failed", "retry succeeded"), failures)
    }

    @Test
    fun `a second purchase is rejected while the first is pending`() {
        val coordinator = PurchaseOperationCoordinator<String>()
        coordinator.begin {}

        val error = assertFailsWith<IllegalStateException> { coordinator.begin {} }
        assertTrue(error.message.orEmpty().startsWith("PURCHASE_IN_PROGRESS"))
    }

    @Test
    fun `stale cancellation cannot clear a newer purchase`() {
        val coordinator = PurchaseOperationCoordinator<String>()
        val first = coordinator.begin {}
        coordinator.cancel(first)
        val second = coordinator.begin {}

        coordinator.cancel(first)
        assertTrue(coordinator.hasPendingOperation())
        coordinator.cancel(second)
        assertFalse(coordinator.hasPendingOperation())
    }

    @Test
    fun `an unrelated listener callback does not complete the pending purchase`() {
        val coordinator = PurchaseOperationCoordinator<String>()
        val results = mutableListOf<String>()
        coordinator.begin(
            accepts = { purchases -> "expected" in purchases },
            complete = { result -> results += result.getOrThrow().single() },
        )

        assertFalse(coordinator.succeed(arrayOf("unrelated")))
        assertTrue(coordinator.hasPendingOperation())
        assertTrue(results.isEmpty())

        assertTrue(coordinator.succeed(arrayOf("expected")))
        assertEquals(listOf("expected"), results)
        assertFalse(coordinator.hasPendingOperation())
    }
}
