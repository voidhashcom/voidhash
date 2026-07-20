package com.margelo.nitro.voidhash.measurement

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import java.io.File
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.RobolectricTestRunner
import com.android.installreferrer.api.InstallReferrerClient
import org.json.JSONArray
import org.json.JSONObject
import kotlin.coroutines.Continuation
import kotlin.coroutines.EmptyCoroutineContext
import kotlin.coroutines.startCoroutine

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MeasurementStoreTest {
    private lateinit var context: Context
    private lateinit var store: MeasurementStore

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        File(context.noBackupFilesDir, "voidhash-measurement.sqlite").delete()
        store = MeasurementStore(context, cryptoFactory = { TestMeasurementCrypto() })
    }

    @Test
    fun identifierPolicyNeverReadsDeniedProviderAndVaultsAllowedValue() {
        var reads = 0
        val collector = AndroidIdentifierCollector(
            store,
            mapOf(IdentifierKind.ADVERTISING_ID to IdentifierProvider {
                reads += 1
                IdentifierProviderResult("gaid-secret")
            }),
        )
        assertEquals(
            InstallReferrerOutcome.PERMISSION_DENIED,
            collector.collect(
                IdentifierKind.ADVERTISING_ID,
                IdentifierCollectionPolicy(advertisingIdentifiers = false, vendorIdentifiers = true, collectionOptOut = false),
            ),
        )
        assertEquals(0, reads)
        assertEquals(
            InstallReferrerOutcome.COLLECTED,
            collector.collect(
                IdentifierKind.ADVERTISING_ID,
                IdentifierCollectionPolicy(advertisingIdentifiers = true, vendorIdentifiers = true, collectionOptOut = false),
            ),
        )
        assertEquals(1, reads)
        val record = store.peekEligible(20).last { it.recordType == "identifier.observed.v1" }
        assertFalse(record.publicPayload.contains("gaid-secret"))
        assertTrue(record.protectedPayloadRef != null)
        val envelope = JSONObject(record.publicPayload)
        assertEquals(record.recordId, envelope.getString("recordId"))
        assertEquals("android", envelope.getJSONObject("device").getString("platform"))
        assertEquals("gaid", envelope.getJSONObject("publicPayload").getString("kind"))
        assertEquals("gaid-secret", String(store.getProtectedEvidence(record.protectedPayloadRef!!)?.value ?: byteArrayOf()))
    }

    @Test
    fun optionalAndConfiguredReferrerProvidersExposeExplicitCapabilities() {
        val missing = runSuspend {
            OptionalDependencyInstallReferrerProvider(
                StoreKind.SAMSUNG_GALAXY_STORE,
                "com.voidhash.missing.SamsungReferrer",
            ) { error("must not execute") }.collect()
        }
        assertEquals(InstallReferrerOutcome.NOT_INSTALLED, missing.outcome)

        runSuspend {
            InstallReferrerCoordinator(
                store,
                ConfiguredInstallReferrerProvider(StoreKind.OUT_OF_STORE, "source=oem&campaign=preload"),
            ).collectOnce()
        }
        val record = store.peekEligible(20).last { it.recordType == "android.install_referrer.v1" }
        assertTrue(record.publicPayload.contains("out_of_store"))
        assertFalse(record.publicPayload.contains("source=oem"))
        val envelope = JSONObject(record.publicPayload)
        assertEquals("out_of_store", envelope.getJSONObject("publicPayload").getString("store"))
        assertEquals(record.sequence, envelope.getLong("installationSequence"))
        assertEquals(
            "source=oem&campaign=preload",
            String(store.getProtectedEvidence(record.protectedPayloadRef!!)?.value ?: byteArrayOf()),
        )
    }

    @Test
    fun deliveryRecursivelySplits413AndQuarantinesOnlyTheOversizedRecord() {
        listOf("accepted-1", "oversized", "accepted-2").forEach { id -> enqueueDeliveryFixture(id) }
        val transport = MeasurementHttpTransport { _, bytes ->
            val events = JSONObject(bytes.toString(Charsets.UTF_8)).getJSONArray("events")
            val ids = (0 until events.length()).map { events.getJSONObject(it).getString("uuid") }
            if (ids.size > 1 || ids == listOf("oversized")) {
                MeasurementHttpResult(413, "", null)
            } else {
                MeasurementHttpResult(
                    200,
                    JSONObject().put("accepted", JSONArray(ids)).put("rejected", JSONArray()).toString(),
                    null,
                )
            }
        }
        val result = MeasurementDelivery(store, "pk_test", "https://ingest.example", transport).flush()
        assertEquals(2, result.accepted)
        assertEquals(1, result.quarantined)
        assertEquals(0, result.scheduled)
        assertTrue(store.peekEligible(10).isEmpty())
    }

    @Test
    fun deliveryHonorsRetryAfterAndHandlesPartialAcknowledgements() {
        enqueueDeliveryFixture("retry")
        val retry = MeasurementDelivery(
            store,
            "pk_test",
            "https://ingest.example",
            MeasurementHttpTransport { _, _ -> MeasurementHttpResult(429, "", 120_000) },
        ).flush()
        assertEquals(1, retry.scheduled)
        assertEquals(0, retry.accepted)
        assertTrue(store.peekEligible(10).isEmpty())

        store.close()
        File(context.noBackupFilesDir, "voidhash-measurement.sqlite").delete()
        store = MeasurementStore(context, cryptoFactory = { TestMeasurementCrypto() })
        listOf("accepted", "rejected", "missing").forEach { id -> enqueueDeliveryFixture(id) }
        val response = JSONObject()
            .put("accepted", JSONArray().put("accepted"))
            .put(
                "rejected",
                JSONArray().put(JSONObject().put("recordId", "rejected").put("reason", "invalid_record")),
            )
            .toString()
        val partial = MeasurementDelivery(
            store,
            "pk_test",
            "https://ingest.example",
            MeasurementHttpTransport { _, _ -> MeasurementHttpResult(200, response, null) },
        ).flush()
        assertEquals(1, partial.accepted)
        assertEquals(1, partial.quarantined)
        assertEquals(1, partial.scheduled)
        assertTrue(store.peekEligible(10).isEmpty())
    }

    @Test
    fun deliverySchedulesMalformedSuccessResponsesInsteadOfThrowing() {
        enqueueDeliveryFixture("malformed-response")
        val result = MeasurementDelivery(
            store,
            "pk_test",
            "https://ingest.example",
            MeasurementHttpTransport { _, _ -> MeasurementHttpResult(202, "not-json", null) },
        ).flush()

        assertEquals(0, result.accepted)
        assertEquals(1, result.scheduled)
        assertEquals(0, result.quarantined)
        assertTrue(store.peekEligible(10).isEmpty())
    }

    private fun enqueueDeliveryFixture(id: String) {
        store.enqueue(
            id,
            "analytics.capture.v1",
            "2026-01-01T00:00:00.000Z",
            "normal",
            "javascript",
            "{\"installationId\":\"install-1\",\"identity\":{\"distinctId\":\"person-1\"},\"consent\":{\"revision\":1},\"publicPayload\":{}}",
            null,
        )
    }

    @After
    fun tearDown() {
        if (::store.isInitialized) store.close()
        File(context.noBackupFilesDir, "voidhash-measurement.sqlite").delete()
    }

    @Test
    fun `database uses no-backup storage and migrates all tables`() {
        assertTrue(store.databasePath().startsWith(context.noBackupFilesDir.absolutePath))
        val tables = android.database.sqlite.SQLiteDatabase.openDatabase(
            store.databasePath(),
            null,
            android.database.sqlite.SQLiteDatabase.OPEN_READONLY,
        ).use { database ->
            assertEquals(3, database.version)
            database.rawQuery("SELECT name FROM sqlite_master WHERE type = 'table'", null).use { cursor ->
                buildSet { while (cursor.moveToNext()) add(cursor.getString(0)) }
            }
        }
        assertTrue(setOf("installation", "session", "state_revision", "outbox", "protected_evidence", "dedupe", "inbox").all(tables::contains))
    }

    @Test
    fun `sequence allocation is unique under concurrency`() {
        val sequences = Collections.synchronizedSet(mutableSetOf<Long>())
        val executor = Executors.newFixedThreadPool(8)
        repeat(100) { index ->
            executor.submit {
                sequences += store.enqueue(
                    recordId = "record-$index",
                    recordType = "analytics.capture.v1",
                    occurredAt = "2026-01-01T00:00:00Z",
                    priority = "normal",
                    source = "javascript",
                    publicPayload = "{\"index\":$index}",
                    protectedPayloadRef = null,
                )
            }
        }
        executor.shutdown()
        assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS))
        assertEquals(100, sequences.size)
        assertEquals(100, store.peekEligible(200).size)
    }

    @Test
    fun `priority ordering ack dedupe and inbox are idempotent`() {
        store.enqueue("normal", "analytics.capture.v1", "2026-01-01T00:00:00Z", "normal", "javascript", "{}", null)
        store.enqueue("critical", "consent.changed.v1", "2026-01-01T00:00:01Z", "critical", "javascript", "{}", null)
        assertEquals(listOf("critical", "normal"), store.peekEligible(10).map { it.recordId })
        assertTrue(store.acknowledge("critical"))
        assertFalse(store.acknowledge("critical"))
        assertEquals(listOf("normal"), store.peekEligible(10).map { it.recordId })

        assertTrue(store.checkAndSetDedupe("transaction", "tx-1", Long.MAX_VALUE))
        assertFalse(store.checkAndSetDedupe("transaction", "tx-1", Long.MAX_VALUE))
        assertTrue(store.appendInbox("inbox-1", "link", "appLink", "cold", "2026-01-01T00:00:00Z", "blob-1"))
        assertFalse(store.appendInbox("inbox-1", "link", "appLink", "cold", "2026-01-01T00:00:00Z", "blob-1"))
        assertEquals(listOf("inbox-1"), store.peekInbox(10).map { it.id })
        assertTrue(store.acknowledgeInbox("inbox-1"))
        assertFalse(store.acknowledgeInbox("inbox-1"))
    }

    @Test
    fun `protected deletion persists its durable marker`() {
        assertTrue(store.deleteProtectedData("delete-1"))
        val marker = android.database.sqlite.SQLiteDatabase.openDatabase(
            store.databasePath(),
            null,
            android.database.sqlite.SQLiteDatabase.OPEN_READONLY,
        ).use { database ->
            database.rawQuery(
                "SELECT payload FROM state_revision WHERE kind = 'deletion'",
                null,
            ).use { cursor ->
                assertTrue(cursor.moveToFirst())
                cursor.getString(0)
            }
        }
        assertEquals("delete-1", marker)
    }

    @Test
    fun `signed configuration rejects downgrade and survives restart`() {
        val payload = "{\"keyId\":\"rotation-2\"}".toByteArray()
        assertTrue(store.persistMeasurementConfiguration(4, payload))
        assertFalse(store.persistMeasurementConfiguration(3, "{}".toByteArray()))
        store.close()
        store = MeasurementStore(context)
        assertEquals(4L, store.measurementConfigurationState().version)
        assertTrue(payload.contentEquals(store.measurementConfigurationState().payload))
    }

    @Test
    fun `remote storage bounds apply to an existing store`() {
        store.applyStorageLimits(2, 1_000_000, 1_000_000)
        repeat(3) { index ->
            store.enqueue(
                "analytics-$index", "analytics.capture.v1", "2026-01-01T00:00:00Z",
                "low", "javascript", "{}", null,
            )
        }
        assertEquals(listOf("analytics-1", "analytics-2"), store.peekEligible(10).map { it.recordId })
    }

    @Test
    fun `play referrer response codes map to explicit provider outcomes`() {
        val cases = mapOf(
            InstallReferrerClient.InstallReferrerResponse.OK to InstallReferrerOutcome.COLLECTED,
            InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED to InstallReferrerOutcome.UNSUPPORTED,
            InstallReferrerClient.InstallReferrerResponse.PERMISSION_ERROR to InstallReferrerOutcome.PERMISSION_DENIED,
            InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE to InstallReferrerOutcome.NOT_INSTALLED,
            InstallReferrerClient.InstallReferrerResponse.SERVICE_DISCONNECTED to InstallReferrerOutcome.AVAILABLE,
        )
        cases.forEach { (code, expected) ->
            assertEquals(expected, classifyPlayInstallReferrerResponse(code))
        }
    }

    @Test
    fun `opaque push registration persists and clears`() {
        val payload = "{\"pushDeviceTokenId\":\"push_tok_1\"}".toByteArray()
        assertTrue(store.persistPushRegistration(payload))
        assertTrue(payload.contentEquals(store.pushRegistrationState().payload))
        assertTrue(store.clearPushRegistration())
        assertEquals(null, store.pushRegistrationState().payload)
        assertFalse(store.clearPushRegistration())
    }

    @Test
    fun `native links are encrypted ordered and duplicate callbacks are suppressed`() {
        val now = System.currentTimeMillis()
        val first = VoidhashLinkCollector.capture(
            store,
            "https://links.example/one?secret=value",
            "appLink",
            "cold",
            now,
        )
        val duplicate = VoidhashLinkCollector.capture(
            store,
            "https://links.example/one?secret=value",
            "universalLink",
            "cold",
            now + 1,
        )
        val second = VoidhashLinkCollector.capture(
            store,
            "voidhash://open/two",
            "customScheme",
            "foreground",
            now + 2,
        )

        assertTrue(first)
        assertFalse(duplicate)
        assertTrue(second)
        val entries = store.peekInbox(10)
        assertEquals(listOf("appLink", "customScheme"), entries.map { it.source })
        assertEquals("https://links.example/one?secret=value", String(store.getProtectedEvidence(entries[0].protectedPayloadRef)!!.value))
        val bytes = File(store.databasePath()).readBytes().toString(Charsets.ISO_8859_1)
        assertFalse(bytes.contains("secret=value"))
    }
}

private fun <T> runSuspend(block: suspend () -> T): T {
    var outcome: Result<T>? = null
    block.startCoroutine(object : Continuation<T> {
        override val context = EmptyCoroutineContext
        override fun resumeWith(result: Result<T>) { outcome = result }
    })
    return checkNotNull(outcome).getOrThrow()
}

private class TestMeasurementCrypto : MeasurementCrypto {
    override var currentVersion = 1
    private val keys = mutableMapOf<Int, SecretKey>()

    override fun encrypt(value: ByteArray, version: Int): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(version))
        return cipher.iv + cipher.doFinal(value)
    }

    override fun decrypt(value: ByteArray, version: Int): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(version), GCMParameterSpec(128, value.copyOfRange(0, 12)))
        return cipher.doFinal(value.copyOfRange(12, value.size))
    }

    private fun key(version: Int): SecretKey = keys.getOrPut(version) {
        KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
    }
}
