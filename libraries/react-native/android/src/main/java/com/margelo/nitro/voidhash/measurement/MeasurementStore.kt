package com.margelo.nitro.voidhash.measurement

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import org.json.JSONObject

internal data class MeasurementStoreLimits(
    val maxOutboxRecords: Int = 10_000,
    val maxOutboxBytes: Long = 20L * 1024L * 1024L,
    val maxProtectedBytes: Long = 20L * 1024L * 1024L,
    val maxDedupeRecords: Int = 25_000,
    val maxInboxRecords: Int = 1_000,
)

internal data class StoredOutboxRecord(
    val recordId: String,
    val recordType: String,
    val sequence: Long,
    val priority: String,
    val publicPayload: String,
    val protectedPayloadRef: String?,
    val attemptCount: Int,
)

internal data class StoredProtectedEvidence(
    val blobId: String,
    val purpose: String,
    val consentRevision: Long,
    val retentionClass: String,
    val encryptionKeyVersion: Int,
    val deletionState: String,
    val value: ByteArray,
)

internal data class StoredProtectedUpload(
    val blobId: String,
    val purpose: String,
    val consentRevision: Long,
    val retentionClass: String,
    val encryptionKeyVersion: Int,
    val deletionState: String,
    val ciphertext: ByteArray?,
    val uploadState: String,
    val attemptCount: Int,
    val eligibleAtMs: Long,
)

internal data class StoredInboxEntry(
    val id: String,
    val kind: String,
    val source: String,
    val appState: String,
    val receivedAt: String,
    val protectedPayloadRef: String,
)

internal data class MeasurementStoreSnapshot(
    val installationId: String,
    val firstOpenedAt: String,
    val sequence: Long,
    val counts: Map<String, Int>,
    val oldestQueuedAtMs: Long?,
)

internal data class StoredMeasurementConfigurationState(
    val version: Long,
    val payload: ByteArray?,
)

internal class MeasurementStore(
    context: Context,
    limits: MeasurementStoreLimits = MeasurementStoreLimits(),
    cryptoFactory: () -> MeasurementCrypto = { MeasurementVaultCrypto() },
) {
    private val lock = Any()
    private val databaseFile = File(context.noBackupFilesDir, "voidhash-measurement.sqlite")
    private val crypto by lazy(cryptoFactory)
    private val database: SQLiteDatabase
    private var limits = limits

    init {
        databaseFile.parentFile?.mkdirs()
        database = SQLiteDatabase.openDatabase(
            databaseFile.absolutePath,
            null,
            SQLiteDatabase.CREATE_IF_NECESSARY or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING,
        )
        migrate()
        ensureInstallation()
    }

    fun databasePath(): String = databaseFile.absolutePath

    fun close() = synchronized(lock) { database.close() }

    fun snapshot(): MeasurementStoreSnapshot = synchronized(lock) {
        ensureInstallation()
        val installation = database.rawQuery(
            "SELECT installation_id, first_opened_at, sequence FROM installation WHERE singleton = 1",
            null,
        ).use { cursor ->
            check(cursor.moveToFirst())
            Triple(cursor.getString(0), cursor.getString(1), cursor.getLong(2))
        }
        val counts = mutableMapOf<String, Int>()
        database.rawQuery(
            "SELECT priority, COUNT(*) FROM outbox WHERE acknowledgement_state = 'pending' GROUP BY priority",
            null,
        ).use { cursor ->
            while (cursor.moveToNext()) counts[cursor.getString(0)] = cursor.getInt(1)
        }
        val oldest = database.rawQuery(
            "SELECT MIN(queued_at_ms) FROM outbox WHERE acknowledgement_state = 'pending'",
            null,
        ).use { cursor ->
            if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else null
        }
        MeasurementStoreSnapshot(installation.first, installation.second, installation.third, counts, oldest)
    }

    fun enqueue(
        recordId: String,
        recordType: String,
        occurredAt: String,
        priority: String,
        source: String,
        publicPayload: String,
        protectedPayloadRef: String?,
        queuedAtMs: Long = System.currentTimeMillis(),
    ): Long = synchronized(lock) {
        database.beginTransaction()
        try {
            ensureInstallation()
            existingSequence(recordId)?.let {
                database.setTransactionSuccessful()
                return@synchronized it
            }
            database.execSQL("UPDATE installation SET sequence = sequence + 1 WHERE singleton = 1")
            val installation = database.rawQuery(
                "SELECT installation_id, sequence FROM installation WHERE singleton = 1",
                null,
            ).use { cursor ->
                cursor.moveToFirst()
                cursor.getString(0) to cursor.getLong(1)
            }
            val sequence = installation.second
            val storedPayload = canonicalEnvelope(
                recordId = recordId,
                recordType = recordType,
                occurredAt = occurredAt,
                queuedAtMs = queuedAtMs,
                installationId = installation.first,
                sequence = sequence,
                source = source,
                publicPayload = publicPayload,
                protectedPayloadRef = protectedPayloadRef,
            )
            evictFor(storedPayload.toByteArray(Charsets.UTF_8).size.toLong())
            database.insertOrThrow(
                "outbox",
                null,
                ContentValues().apply {
                    put("record_id", recordId)
                    put("record_type", recordType)
                    put("installation_sequence", sequence)
                    put("occurred_at", occurredAt)
                    put("queued_at_ms", queuedAtMs)
                    put("priority", priority.lowercase(Locale.US))
                    put("source", source.lowercase(Locale.US))
                    put("public_payload", storedPayload)
                    put("public_payload_bytes", storedPayload.toByteArray(Charsets.UTF_8).size)
                    put("protected_payload_ref", protectedPayloadRef)
                    put("attempt_count", 0)
                    put("eligible_at_ms", queuedAtMs)
                    put("acknowledgement_state", "pending")
                },
            )
            database.setTransactionSuccessful()
            sequence
        } finally {
            database.endTransaction()
        }
    }

    fun peekEligible(limit: Int, nowMs: Long = System.currentTimeMillis()): List<StoredOutboxRecord> =
        synchronized(lock) {
            database.rawQuery(
                """
                SELECT record_id, record_type, installation_sequence, priority, public_payload,
                       protected_payload_ref, attempt_count
                FROM outbox
                WHERE acknowledgement_state = 'pending' AND eligible_at_ms <= ?
                ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                         installation_sequence ASC
                LIMIT ?
                """.trimIndent(),
                arrayOf(nowMs.toString(), limit.coerceAtLeast(0).toString()),
            ).use { cursor -> cursor.mapRows(::outboxRecord) }
        }

    fun acknowledge(recordId: String): Boolean = synchronized(lock) {
        database.update(
            "outbox",
            ContentValues().apply { put("acknowledgement_state", "acknowledged") },
            "record_id = ? AND acknowledgement_state != 'acknowledged'",
            arrayOf(recordId),
        ) > 0
    }

    fun quarantine(recordId: String, reason: String): Boolean = synchronized(lock) {
        database.beginTransaction()
        try {
            writeDiagnostic(recordId, "quarantined", reason)
            val changed = database.update(
                "outbox",
                ContentValues().apply { put("acknowledgement_state", "quarantined") },
                "record_id = ? AND acknowledgement_state = 'pending'",
                arrayOf(recordId),
            ) > 0
            database.setTransactionSuccessful()
            changed
        } finally {
            database.endTransaction()
        }
    }

    fun reject(recordId: String, reason: String): Boolean = synchronized(lock) {
        database.beginTransaction()
        try {
            writeDiagnostic(recordId, "rejected", reason)
            val changed = database.update(
                "outbox",
                ContentValues().apply { put("acknowledgement_state", "rejected") },
                "record_id = ? AND acknowledgement_state = 'pending'",
                arrayOf(recordId),
            ) > 0
            database.setTransactionSuccessful()
            changed
        } finally {
            database.endTransaction()
        }
    }

    fun scheduleRetry(recordId: String, eligibleAtMs: Long): Boolean = synchronized(lock) {
        database.execSQL(
            "UPDATE outbox SET attempt_count = attempt_count + 1, eligible_at_ms = ? WHERE record_id = ? AND acknowledgement_state = 'pending'",
            arrayOf<Any>(eligibleAtMs, recordId),
        )
        database.rawQuery("SELECT changes()", null).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) > 0 }
    }

    fun putProtectedEvidence(
        blobId: String = "blob_${UUID.randomUUID()}",
        purpose: String,
        consentRevision: Long,
        retentionClass: String,
        value: ByteArray,
        keyVersion: Int = crypto.currentVersion,
    ): String = synchronized(lock) {
        val encrypted = crypto.encrypt(value, keyVersion)
        evictProtectedFor(encrypted.size.toLong())
        database.insertWithOnConflict(
            "protected_evidence",
            null,
            ContentValues().apply {
                put("blob_id", blobId)
                put("purpose", purpose)
                put("consent_revision", consentRevision)
                put("retention_class", retentionClass)
                put("encryption_key_version", keyVersion)
                put("deletion_state", "active")
                put("ciphertext", encrypted)
                put("created_at_ms", System.currentTimeMillis())
            },
            SQLiteDatabase.CONFLICT_IGNORE,
        )
        blobId
    }

    fun getProtectedEvidence(blobId: String): StoredProtectedEvidence? = synchronized(lock) {
        database.rawQuery(
            "SELECT purpose, consent_revision, retention_class, encryption_key_version, deletion_state, ciphertext FROM protected_evidence WHERE blob_id = ?",
            arrayOf(blobId),
        ).use { cursor ->
            if (!cursor.moveToFirst()) return@synchronized null
            val keyVersion = cursor.getInt(3)
            StoredProtectedEvidence(
                blobId,
                cursor.getString(0),
                cursor.getLong(1),
                cursor.getString(2),
                keyVersion,
                cursor.getString(4),
                crypto.decrypt(cursor.getBlob(5), keyVersion),
            )
        }
    }

    fun deleteProtectedEvidence(blobId: String): Boolean = synchronized(lock) {
        database.update(
            "protected_evidence",
            ContentValues().apply {
                put("deletion_state", "deleted")
                putNull("ciphertext")
            },
            "blob_id = ? AND deletion_state != 'deleted'",
            arrayOf(blobId),
        ) > 0
    }

    fun deleteProtectedData(requestId: String): Boolean = synchronized(lock) {
        database.beginTransaction()
        try {
            database.update(
                "protected_evidence",
                ContentValues().apply {
                    put("deletion_state", "deleted")
                    putNull("ciphertext")
                    put("upload_state", "rejected")
                },
                "deletion_state != 'deleted'",
                null,
            )
            database.insertWithOnConflict(
                "state_revision",
                null,
                ContentValues().apply {
                    put("kind", "deletion")
                    put("revision", deletionRevision() + 1)
                    put("payload", requestId)
                },
                SQLiteDatabase.CONFLICT_REPLACE,
            )
            database.setTransactionSuccessful()
            true
        } finally {
            database.endTransaction()
        }
    }

    fun measurementConfigurationState(): StoredMeasurementConfigurationState = synchronized(lock) {
        database.rawQuery(
            "SELECT revision, payload FROM state_revision WHERE kind = 'measurement_configuration'",
            null,
        ).use { cursor ->
            if (!cursor.moveToFirst()) return@synchronized StoredMeasurementConfigurationState(0, null)
            StoredMeasurementConfigurationState(
                cursor.getLong(0),
                if (cursor.isNull(1)) null else cursor.getString(1).toByteArray(Charsets.UTF_8),
            )
        }
    }

    fun persistMeasurementConfiguration(version: Long, payload: ByteArray): Boolean = synchronized(lock) {
        database.beginTransaction()
        try {
            val current = database.rawQuery(
                "SELECT revision FROM state_revision WHERE kind = 'measurement_configuration'",
                null,
            ).use { cursor -> if (cursor.moveToFirst()) cursor.getLong(0) else 0 }
            if (version <= current) {
                database.setTransactionSuccessful()
                return@synchronized false
            }
            database.insertWithOnConflict(
                "state_revision",
                null,
                ContentValues().apply {
                    put("kind", "measurement_configuration")
                    put("revision", version)
                    put("payload", payload.toString(Charsets.UTF_8))
                },
                SQLiteDatabase.CONFLICT_REPLACE,
            )
            database.setTransactionSuccessful()
            true
        } finally {
            database.endTransaction()
        }
    }

    fun pushRegistrationState(): StoredMeasurementConfigurationState = synchronized(lock) {
        database.rawQuery(
            "SELECT revision, payload FROM state_revision WHERE kind = 'push_registration'",
            null,
        ).use { cursor ->
            if (!cursor.moveToFirst()) return@synchronized StoredMeasurementConfigurationState(0, null)
            StoredMeasurementConfigurationState(
                cursor.getLong(0),
                if (cursor.isNull(1)) null else cursor.getString(1).toByteArray(Charsets.UTF_8),
            )
        }
    }

    fun persistPushRegistration(payload: ByteArray): Boolean = synchronized(lock) {
        val revision = pushRegistrationState().version + 1
        database.insertWithOnConflict(
            "state_revision",
            null,
            ContentValues().apply {
                put("kind", "push_registration")
                put("revision", revision)
                put("payload", payload.toString(Charsets.UTF_8))
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        ) >= 0
    }

    fun clearPushRegistration(): Boolean = synchronized(lock) {
        database.delete("state_revision", "kind = 'push_registration'", null) > 0
    }

    fun testDeviceState(): Boolean = synchronized(lock) {
        database.rawQuery("SELECT payload FROM state_revision WHERE kind = 'test_device'", null).use { cursor ->
            cursor.moveToFirst() && !cursor.isNull(0) && cursor.getString(0) == "true"
        }
    }

    fun persistTestDeviceState(enabled: Boolean): Boolean = synchronized(lock) {
        database.insertWithOnConflict(
            "state_revision",
            null,
            ContentValues().apply {
                put("kind", "test_device")
                put("revision", 1)
                put("payload", enabled.toString())
            },
            SQLiteDatabase.CONFLICT_REPLACE,
        ) >= 0
    }

    fun applyStorageLimits(
        maxOutboxRecords: Int,
        maxOutboxBytes: Long,
        maxProtectedBytes: Long,
    ) = synchronized(lock) {
        require(maxOutboxRecords > 0 && maxOutboxBytes > 0 && maxProtectedBytes > 0) {
            "MEASUREMENT_INVALID_STORAGE_LIMITS"
        }
        limits = limits.copy(
            maxOutboxRecords = maxOutboxRecords,
            maxOutboxBytes = maxOutboxBytes,
            maxProtectedBytes = maxProtectedBytes,
        )
        evictFor(0)
    }

    private fun deletionRevision(): Int = database.rawQuery(
        "SELECT revision FROM state_revision WHERE kind = 'deletion'",
        null,
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getInt(0) else 0 }

    fun getProtectedUpload(blobId: String): StoredProtectedUpload? = synchronized(lock) {
        database.rawQuery(
            "SELECT purpose, consent_revision, retention_class, encryption_key_version, deletion_state, ciphertext, upload_state, upload_attempt_count, upload_eligible_at_ms FROM protected_evidence WHERE blob_id = ?",
            arrayOf(blobId),
        ).use { cursor ->
            if (!cursor.moveToFirst()) return@synchronized null
            StoredProtectedUpload(
                blobId,
                cursor.getString(0),
                cursor.getLong(1),
                cursor.getString(2),
                cursor.getInt(3),
                cursor.getString(4),
                if (cursor.isNull(5)) null else cursor.getBlob(5),
                cursor.getString(6),
                cursor.getInt(7),
                cursor.getLong(8),
            )
        }
    }

    fun acknowledgeProtectedUpload(blobId: String): Boolean = synchronized(lock) {
        database.update(
            "protected_evidence",
            ContentValues().apply { put("upload_state", "acknowledged") },
            "blob_id = ? AND upload_state != 'acknowledged'",
            arrayOf(blobId),
        ) > 0
    }

    fun scheduleProtectedUpload(blobId: String, eligibleAtMs: Long): Boolean = synchronized(lock) {
        database.execSQL(
            "UPDATE protected_evidence SET upload_attempt_count = upload_attempt_count + 1, upload_eligible_at_ms = ? WHERE blob_id = ? AND upload_state = 'pending'",
            arrayOf<Any>(eligibleAtMs, blobId),
        )
        database.rawQuery("SELECT changes()", null).use { cursor -> cursor.moveToFirst(); cursor.getInt(0) > 0 }
    }

    fun rejectProtectedUpload(blobId: String): Boolean = synchronized(lock) {
        database.update(
            "protected_evidence",
            ContentValues().apply { put("upload_state", "rejected") },
            "blob_id = ? AND upload_state = 'pending'",
            arrayOf(blobId),
        ) > 0
    }

    fun rotateProtectedEvidenceKey(newVersion: Int): Int = synchronized(lock) {
        require(newVersion > 0)
        val active = mutableListOf<Pair<String, ByteArray>>()
        database.rawQuery(
            "SELECT blob_id, encryption_key_version, ciphertext FROM protected_evidence WHERE deletion_state = 'active'",
            null,
        ).use { cursor ->
            while (cursor.moveToNext()) {
                active += cursor.getString(0) to crypto.decrypt(cursor.getBlob(2), cursor.getInt(1))
            }
        }
        database.beginTransaction()
        try {
            for ((blobId, plaintext) in active) {
                database.update(
                    "protected_evidence",
                    ContentValues().apply {
                        put("encryption_key_version", newVersion)
                        put("ciphertext", crypto.encrypt(plaintext, newVersion))
                    },
                    "blob_id = ?",
                    arrayOf(blobId),
                )
            }
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
        crypto.currentVersion = newVersion
        active.size
    }

    fun checkAndSetDedupe(namespace: String, key: String, expiresAtMs: Long): Boolean = synchronized(lock) {
        database.delete("dedupe", "expires_at_ms <= ?", arrayOf(System.currentTimeMillis().toString()))
        val inserted = database.insertWithOnConflict(
            "dedupe",
            null,
            ContentValues().apply {
                put("namespace", namespace)
                put("dedupe_key", key)
                put("created_at_ms", System.currentTimeMillis())
                put("expires_at_ms", expiresAtMs)
            },
            SQLiteDatabase.CONFLICT_IGNORE,
        ) != -1L
        trimTable("dedupe", limits.maxDedupeRecords, "created_at_ms")
        inserted
    }

    fun hasDedupe(namespace: String, key: String): Boolean = synchronized(lock) {
        database.delete("dedupe", "expires_at_ms <= ?", arrayOf(System.currentTimeMillis().toString()))
        database.rawQuery(
            "SELECT 1 FROM dedupe WHERE namespace = ? AND dedupe_key = ? LIMIT 1",
            arrayOf(namespace, key),
        ).use { it.moveToFirst() }
    }

    fun appendInbox(
        id: String,
        kind: String,
        source: String,
        appState: String,
        receivedAt: String,
        protectedPayloadRef: String,
    ): Boolean = synchronized(lock) {
        val inserted = database.insertWithOnConflict(
            "inbox",
            null,
            ContentValues().apply {
                put("entry_id", id)
                put("kind", kind)
                put("source", source)
                put("app_state", appState)
                put("received_at", receivedAt)
                put("protected_payload_ref", protectedPayloadRef)
                put("acknowledged", 0)
            },
            SQLiteDatabase.CONFLICT_IGNORE,
        ) != -1L
        trimTable("inbox", limits.maxInboxRecords, "rowid", "acknowledged = 1")
        inserted
    }

    fun peekInbox(limit: Int): List<StoredInboxEntry> = synchronized(lock) {
        database.rawQuery(
            "SELECT entry_id, kind, source, app_state, received_at, protected_payload_ref FROM inbox WHERE acknowledged = 0 ORDER BY rowid ASC LIMIT ?",
            arrayOf(limit.coerceAtLeast(0).toString()),
        ).use { cursor ->
            cursor.mapRows {
                StoredInboxEntry(
                    it.getString(0),
                    it.getString(1),
                    it.getString(2),
                    it.getString(3),
                    it.getString(4),
                    it.getString(5),
                )
            }
        }
    }

    fun acknowledgeInbox(id: String): Boolean = synchronized(lock) {
        database.update(
            "inbox",
            ContentValues().apply { put("acknowledged", 1) },
            "entry_id = ? AND acknowledged = 0",
            arrayOf(id),
        ) > 0
    }

    private fun migrate() = synchronized(lock) {
        val version = database.version
        if (version < 1) {
            database.beginTransaction()
            try {
                database.execSQL("CREATE TABLE IF NOT EXISTS installation (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), installation_id TEXT NOT NULL, first_opened_at TEXT NOT NULL, sequence INTEGER NOT NULL DEFAULT 0, first_release TEXT, last_release TEXT)")
                database.execSQL("CREATE TABLE IF NOT EXISTS session (singleton INTEGER PRIMARY KEY CHECK (singleton = 1), session_id TEXT, sequence INTEGER NOT NULL DEFAULT 0, started_at TEXT, last_foreground_monotonic_ms INTEGER, last_background_monotonic_ms INTEGER)")
                database.execSQL("CREATE TABLE IF NOT EXISTS state_revision (kind TEXT PRIMARY KEY, revision INTEGER NOT NULL, payload TEXT)")
                database.execSQL("CREATE TABLE IF NOT EXISTS outbox (record_id TEXT PRIMARY KEY, record_type TEXT NOT NULL, installation_sequence INTEGER NOT NULL, occurred_at TEXT NOT NULL, queued_at_ms INTEGER NOT NULL, priority TEXT NOT NULL, source TEXT NOT NULL, public_payload TEXT NOT NULL, public_payload_bytes INTEGER NOT NULL, protected_payload_ref TEXT, attempt_count INTEGER NOT NULL DEFAULT 0, eligible_at_ms INTEGER NOT NULL, acknowledgement_state TEXT NOT NULL DEFAULT 'pending')")
                database.execSQL("CREATE INDEX IF NOT EXISTS outbox_eligible_idx ON outbox (acknowledgement_state, priority, eligible_at_ms, installation_sequence)")
                database.execSQL("CREATE TABLE IF NOT EXISTS protected_evidence (blob_id TEXT PRIMARY KEY, purpose TEXT NOT NULL, consent_revision INTEGER NOT NULL, retention_class TEXT NOT NULL, encryption_key_version INTEGER NOT NULL, deletion_state TEXT NOT NULL, ciphertext BLOB, created_at_ms INTEGER NOT NULL)")
                database.execSQL("CREATE TABLE IF NOT EXISTS dedupe (namespace TEXT NOT NULL, dedupe_key TEXT NOT NULL, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL, PRIMARY KEY (namespace, dedupe_key))")
                database.version = 1
                database.setTransactionSuccessful()
            } finally {
                database.endTransaction()
            }
        }
        if (version < 2) {
            database.beginTransaction()
            try {
                database.execSQL("CREATE TABLE IF NOT EXISTS inbox (entry_id TEXT PRIMARY KEY, kind TEXT NOT NULL, source TEXT NOT NULL, app_state TEXT NOT NULL, received_at TEXT NOT NULL, protected_payload_ref TEXT NOT NULL, acknowledged INTEGER NOT NULL DEFAULT 0)")
                database.execSQL("CREATE TABLE IF NOT EXISTS delivery_diagnostic (diagnostic_id TEXT PRIMARY KEY, record_id TEXT NOT NULL, outcome TEXT NOT NULL, reason TEXT NOT NULL, occurred_at_ms INTEGER NOT NULL)")
                database.version = 2
                database.setTransactionSuccessful()
            } finally {
                database.endTransaction()
            }
        }
        if (version < 3) {
            database.beginTransaction()
            try {
                database.execSQL("ALTER TABLE protected_evidence ADD COLUMN upload_state TEXT NOT NULL DEFAULT 'pending'")
                database.execSQL("ALTER TABLE protected_evidence ADD COLUMN upload_attempt_count INTEGER NOT NULL DEFAULT 0")
                database.execSQL("ALTER TABLE protected_evidence ADD COLUMN upload_eligible_at_ms INTEGER NOT NULL DEFAULT 0")
                database.execSQL("CREATE INDEX IF NOT EXISTS protected_evidence_upload_idx ON protected_evidence (upload_state, upload_eligible_at_ms)")
                database.version = 3
                database.setTransactionSuccessful()
            } finally {
                database.endTransaction()
            }
        }
    }

    private fun ensureInstallation() {
        database.insertWithOnConflict(
            "installation",
            null,
            ContentValues().apply {
                put("singleton", 1)
                put("installation_id", "install_${UUID.randomUUID()}")
                put("first_opened_at", nowIso())
                put("sequence", 0)
            },
            SQLiteDatabase.CONFLICT_IGNORE,
        )
    }

    private fun existingSequence(recordId: String): Long? = database.rawQuery(
        "SELECT installation_sequence FROM outbox WHERE record_id = ?",
        arrayOf(recordId),
    ).use { cursor -> if (cursor.moveToFirst()) cursor.getLong(0) else null }

    private fun canonicalEnvelope(
        recordId: String,
        recordType: String,
        occurredAt: String,
        queuedAtMs: Long,
        installationId: String,
        sequence: Long,
        source: String,
        publicPayload: String,
        protectedPayloadRef: String?,
    ): String {
        val decoded = try {
            JSONObject(publicPayload)
        } catch (_: Exception) {
            JSONObject().put("value", publicPayload)
        }
        if (
            decoded.optInt("schemaVersion") == 1 &&
            decoded.optString("recordId").isNotBlank() &&
            decoded.optString("installationId").isNotBlank() &&
            decoded.has("publicPayload")
        ) return publicPayload

        return JSONObject().apply {
            put("schemaVersion", 1)
            put("recordId", recordId)
            put("type", recordType)
            put("occurredAt", occurredAt)
            put("queuedAt", isoTimestamp(queuedAtMs))
            put("installationId", installationId)
            put("installationSequence", sequence)
            put("identity", JSONObject().apply {
                put("distinctId", installationId)
                put("anonymousId", installationId)
                put("revision", 0)
            })
            put("consent", JSONObject().apply {
                put("revision", 0)
                put("decidedAt", occurredAt)
                put("source", "unknown")
            })
            put("app", JSONObject())
            put("device", JSONObject().put("platform", "android"))
            put("source", source.lowercase(Locale.US))
            put("publicPayload", decoded)
            protectedPayloadRef?.let { put("protectedPayloadRef", it) }
        }.toString()
    }

    private fun isoTimestamp(timestampMs: Long): String = SimpleDateFormat(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        Locale.US,
    ).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date(timestampMs))

    private fun evictFor(additionalBytes: Long) {
        while (pendingCount() >= limits.maxOutboxRecords || pendingBytes() + additionalBytes > limits.maxOutboxBytes) {
            val candidate = database.rawQuery(
                """
                SELECT record_id FROM outbox
                WHERE acknowledgement_state = 'pending'
                  AND priority IN ('low', 'normal')
                  AND record_type NOT LIKE 'installation.%'
                  AND record_type NOT LIKE 'consent.%'
                  AND record_type NOT LIKE 'link.%'
                  AND record_type NOT LIKE 'referrer.%'
                  AND record_type NOT LIKE 'purchase.%'
                ORDER BY CASE priority WHEN 'low' THEN 0 ELSE 1 END, installation_sequence ASC LIMIT 1
                """.trimIndent(),
                null,
            ).use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
                ?: throw SQLiteException("MEASUREMENT_OUTBOX_PROTECTED_BOUND")
            writeDiagnostic(candidate, "evicted", "storage_bound")
            database.delete("outbox", "record_id = ?", arrayOf(candidate))
        }
    }

    private fun evictProtectedFor(additionalBytes: Long) {
        val current = database.rawQuery(
            "SELECT COALESCE(SUM(LENGTH(ciphertext)), 0) FROM protected_evidence WHERE deletion_state = 'active'",
            null,
        ).use { cursor -> cursor.moveToFirst(); cursor.getLong(0) }
        if (current + additionalBytes > limits.maxProtectedBytes) {
            throw SQLiteException("MEASUREMENT_PROTECTED_VAULT_BOUND")
        }
    }

    private fun pendingCount(): Long = android.database.DatabaseUtils.queryNumEntries(
        database,
        "outbox",
        "acknowledgement_state = 'pending'",
    )

    private fun pendingBytes(): Long = database.rawQuery(
        "SELECT COALESCE(SUM(public_payload_bytes), 0) FROM outbox WHERE acknowledgement_state = 'pending'",
        null,
    ).use { cursor -> cursor.moveToFirst(); cursor.getLong(0) }

    private fun writeDiagnostic(recordId: String, outcome: String, reason: String) {
        database.insert(
            "delivery_diagnostic",
            null,
            ContentValues().apply {
                put("diagnostic_id", "diag_${UUID.randomUUID()}")
                put("record_id", recordId)
                put("outcome", outcome)
                put("reason", reason.take(128))
                put("occurred_at_ms", System.currentTimeMillis())
            },
        )
    }

    private fun trimTable(table: String, maximum: Int, orderBy: String, where: String? = null) {
        val count = android.database.DatabaseUtils.queryNumEntries(database, table, where)
        val excess = count - maximum
        if (excess <= 0) return
        database.execSQL(
            "DELETE FROM $table WHERE rowid IN (SELECT rowid FROM $table${where?.let { " WHERE $it" } ?: ""} ORDER BY $orderBy ASC LIMIT ?)",
            arrayOf(excess),
        )
    }

    private fun outboxRecord(cursor: Cursor) = StoredOutboxRecord(
        cursor.getString(0),
        cursor.getString(1),
        cursor.getLong(2),
        cursor.getString(3),
        cursor.getString(4),
        if (cursor.isNull(5)) null else cursor.getString(5),
        cursor.getInt(6),
    )

    private fun <T> Cursor.mapRows(transform: (Cursor) -> T): List<T> {
        val values = mutableListOf<T>()
        while (moveToNext()) values += transform(this)
        return values
    }

    private fun nowIso(): String {
        val formatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        formatter.timeZone = TimeZone.getTimeZone("UTC")
        return formatter.format(Date())
    }
}

internal interface MeasurementCrypto {
    var currentVersion: Int
    fun encrypt(value: ByteArray, version: Int): ByteArray
    fun decrypt(value: ByteArray, version: Int): ByteArray
}

private class MeasurementVaultCrypto : MeasurementCrypto {
    override var currentVersion: Int = 1
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    override fun encrypt(value: ByteArray, version: Int): ByteArray {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(version))
        return cipher.iv + cipher.doFinal(value)
    }

    override fun decrypt(value: ByteArray, version: Int): ByteArray {
        require(value.size > 12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(version), GCMParameterSpec(128, value.copyOfRange(0, 12)))
        return cipher.doFinal(value.copyOfRange(12, value.size))
    }

    private fun key(version: Int): SecretKey {
        val alias = "voidhash-measurement-vault-v$version"
        (keyStore.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            ).setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build(),
        )
        return generator.generateKey()
    }
}
