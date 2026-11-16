package com.margelo.nitro.voidhash.client

import android.content.Context
import android.content.SharedPreferences
import com.voidhash.sdk.analytics.AnalyticsEvent
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_RESTORE
import com.voidhash.sdk.api.SYNC_TRANSACTION_INTENT_SYNC
import com.voidhash.sdk.api.SyncTransactionRequest
import com.voidhash.sdk.cache.cacheKeyPrefix
import com.voidhash.sdk.cache.fnv1aHex
import com.voidhash.sdk.cache.unnormalizedCacheKeyPrefix
import com.voidhash.sdk.storage.FileRecordStore
import com.voidhash.sdk.transactions.AcceptedReceipt
import com.voidhash.sdk.transactions.OutboxRecord
import com.voidhash.sdk.transactions.PersonWrite
import com.voidhash.sdk.transactions.PersonWriteKind
import com.voidhash.sdk.transactions.mergePersonWrites
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/** The preferences file both the TypeScript core and the SDK keep their cache in. */
private const val PREFERENCES_NAME = "com.voidhash.sdk.cache"

/** Key, outside every namespace, under which a store records that it was imported. */
private const val DONE_PREFIX = "voidhash-react-native-import:v1:"

/** Lifetime of the owner of a receipt still to be delivered, as the SDK writes it: 30 days. */
private const val RESTORED_OWNER_TTL_MS = 1000L * 60 * 60 * 24 * 30

/**
 * Moves what the React Native TypeScript core stored into the formats the SDK reads, once per
 * storage namespace, before the SDK loads any of it.
 *
 * Both write the same preferences file under the same namespace prefix and the same envelope
 * `{value, createdAt, staleAt, expiresAt}`, so most entries are already the SDK's: the identity,
 * the consent, the session, the last-seen release, person snapshots, the schema, paywall
 * resolutions, known placements, flow state, processed-transaction and SDK-started-purchase markers,
 * and the owner keys `restored-transaction-identity:` and `transaction-identity:`, which the SDK
 * reads as they are. What differs is converted:
 *
 * - **Queues** (`rn-*` files): analytics events, person writes, receipts and accepted receipts become
 *   the SDK's records, appended to its files without duplicating one that is there already. A
 *   receipt the SDK cannot send (an App Store or development receipt) is the only one left out.
 * - **Ledger `account:` claims** become `transaction-identity:<account token>` entries, which is how
 *   the SDK finds the owner of a purchase it started.
 * - **Ledger entries Voidhash never accepted** (an owner without an accepted order, or a revoked
 *   one) become `restored-transaction-identity:<receipt>` entries, not accepted receipts, so the
 *   purchase is still reported, for its owner.
 * - **A "no person" snapshot** (`null`) becomes the SDK's `{"none": true}` marker.
 * - **Flag evaluations** move from `feature-flags:<id>:<sig>` to the SDK's `flags:<id>:<sig>` keys.
 * - **Store products** and a legacy per-version schema are dropped.
 *
 * The TypeScript core named its namespace after the key and base URL exactly as configured, the
 * SDK after the trimmed key and normalized URL. Where the two differ, everything under the former is
 * first moved under the latter, so nothing is left where neither reads it.
 *
 * Each store is done on its own, in the order the facade's data depends on: person writes, receipts
 * and the ledger, analytics, then the caches. A store is written to the SDK first, its source is
 * removed only once that write succeeded, and then it is marked done; one that fails stays in place
 * for the next start, and one with nothing to import is not marked, so what turns up later is still
 * imported. Imported events keep the properties they were captured with: the SDK merges its
 * standard properties at capture only, never at send. Does file and preference IO: call it off the
 * main thread.
 */
internal class LegacyStorageImporter(
    private val context: Context,
    publishableKey: String,
    baseUrl: String,
) {
    private val namespace = cacheKeyPrefix(publishableKey.trim(), baseUrl)

    /** The TypeScript core's namespace: the key and base URL as configured. */
    private val legacyNamespace = unnormalizedCacheKeyPrefix(publishableKey, baseUrl)
        ?: cacheKeyPrefix(publishableKey, baseUrl)
    private val preferences: SharedPreferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val directory = File(context.filesDir, "voidhash")
    private val filePrefix = filePrefix(namespace)

    /** What a store's import found. */
    private enum class Outcome { IMPORTED, NOTHING, FAILED }

    /** The RN queue file of each store that has one. */
    private val legacyQueues = mapOf(
        "person-writes" to "rn-person-writes",
        "transactions" to "rn-transaction-outbox",
        "receipt-ledger" to "rn-receipt-ledger",
        "analytics" to "rn-analytics-queue",
    )

    /**
     * Imports every store not imported yet; never throws. Once a start left nothing to import, this
     * namespace is marked complete and later starts read nothing at all.
     */
    fun import() {
        val complete = DONE_PREFIX + namespace + "complete"
        if (preferences.getBoolean(complete, false)) return
        // Entries left under the legacy prefix are read by no step, so nothing is marked done until
        // a later start has moved them.
        val adopted = legacyNamespace == namespace || runCatching { adoptLegacyNamespace() }.getOrDefault(false)
        markDone = adopted
        val outcomes = listOf(
            step("person-writes") { importPersonWrites() },
            step("transactions") { importTransactions() },
            step("receipt-ledger") { importLedger() },
            step("analytics") { importAnalytics() },
            step("caches") { importCaches() },
        )
        if (adopted && Outcome.FAILED !in outcomes && legacyQueues.values.none { queueRemains(it) }) {
            preferences.edit().putBoolean(complete, true).commit()
        }
    }

    /**
     * Runs [import] unless [store] was imported before. Marks it done once it imported something and
     * no RN file of it is left, under either namespace.
     */
    /** Whether [step] may mark a store done this start; see [import]. */
    private var markDone = true

    private fun step(store: String, import: () -> Outcome): Outcome {
        val marker = DONE_PREFIX + namespace + store
        if (preferences.getBoolean(marker, false)) return Outcome.IMPORTED
        val outcome = try {
            import()
        } catch (error: Exception) {
            Outcome.FAILED
        }
        val remains = legacyQueues[store]?.let(::queueRemains) == true
        if (markDone && outcome == Outcome.IMPORTED && !remains) preferences.edit().putBoolean(marker, true).commit()
        return if (remains) Outcome.FAILED else outcome
    }

    /** Whether the RN queue file [name] is still there, under the SDK's namespace or the legacy one. */
    private fun queueRemains(name: String) =
        legacyFile(name).exists() || File(directory, "${filePrefix(legacyNamespace)}$name.ndjson").exists()

    /**
     * Moves the entries and files of [legacyNamespace] under [namespace], keeping what the SDK
     * already has there. An RN queue both namespaces hold is merged into the SDK namespace's, which
     * its store's import deduplicates; any other file the SDK already has stays where it is.
     * Returns whether the preferences moved; a file that did not is retried by its store's step.
     */
    private fun adoptLegacyNamespace(): Boolean {
        val editor = preferences.edit()
        val adopted = mutableListOf<String>()
        val stored = preferences.all
        for ((physical, value) in stored) {
            if (!physical.startsWith(legacyNamespace) || value !is String) continue
            val key = physical.removePrefix(legacyNamespace)
            editor.remove(physical)
            if (key == "cache-keys" || stored.containsKey(namespace + key)) continue
            editor.putString(namespace + key, value)
            adopted += key
        }
        var moved = true
        if (adopted.isNotEmpty() || stored.keys.any { it.startsWith(legacyNamespace) }) {
            moved = editor.commit()
            if (moved) updateIndex(added = adopted, removed = emptyList())
        }
        val legacyFiles = filePrefix(legacyNamespace)
        directory.listFiles()?.forEach { file ->
            if (!file.name.startsWith(legacyFiles)) return@forEach
            val name = file.name.removePrefix(legacyFiles)
            val target = File(directory, filePrefix + name)
            when {
                !target.exists() -> file.renameTo(target)
                name.removeSuffix(".ndjson") in legacyQueues.values -> {
                    val loaded = FileRecordStore(file).load()
                    if (!loaded.readFailed && (loaded.records.isEmpty() || FileRecordStore(target).append(loaded.records))) {
                        file.delete()
                    }
                }
            }
        }
        return moved
    }

    private fun store(name: String) = FileRecordStore(File(directory, "$filePrefix$name.ndjson"))

    private fun legacyFile(name: String) = File(directory, "$filePrefix$name.ndjson")

    /** Reads the RN file [name]; `null` when it cannot be read, so the store is retried. */
    private fun legacyRecords(name: String): List<JSONObject>? {
        if (!legacyFile(name).exists()) return emptyList()
        val loaded = store(name).load()
        if (loaded.readFailed) return null
        return loaded.records.mapNotNull { runCatching { JSONObject(it) }.getOrNull() }
    }

    /**
     * Appends [records] to the SDK file [name] (or, with [replace], rewrites it with them) and writes [entries] (unprefixed key to envelope
     * value) in one preferences commit, then removes the RN key [legacyKey] and file [legacy].
     */
    private fun commit(
        name: String,
        records: List<String>,
        legacy: String,
        legacyKey: String? = null,
        entries: List<Pair<String, JSONObject>> = emptyList(),
        replace: Boolean = false,
    ): Outcome {
        val written = when {
            replace -> store(name).replaceAll(records)
            records.isNotEmpty() -> store(name).append(records)
            else -> true
        }
        if (!written) return Outcome.FAILED
        if (entries.isNotEmpty() || legacyKey != null) {
            val editor = preferences.edit()
            for ((key, envelope) in entries) editor.putString(namespace + key, envelope.toString())
            legacyKey?.let { editor.remove(namespace + it) }
            if (!editor.commit()) return Outcome.FAILED
            updateIndex(added = entries.map { it.first }, removed = listOfNotNull(legacyKey))
        }
        legacyFile(legacy).delete()
        return Outcome.IMPORTED
    }

    // ---- Person writes ----

    private fun importPersonWrites(): Outcome {
        if (!legacyFile("rn-person-writes").exists()) return Outcome.NOTHING
        val legacy = legacyRecords("rn-person-writes") ?: return Outcome.FAILED
        if (legacy.isEmpty()) return commit("person-writes", emptyList(), "rn-person-writes")
        val existing = store("person-writes").load()
        if (existing.readFailed) return Outcome.FAILED
        val native = existing.records.mapNotNull(PersonWrite::fromRecord)
        // Kept as they are: a later release may read what this one cannot.
        val undecoded = existing.records.filter { PersonWrite.fromRecord(it) == null }
        // Queue order is the file's: identifies, then the traits behind them, as they were queued.
        val writes = legacy.mapNotNull { record ->
            val target = record.optString("distinctId").takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            val email = record.stringOrNull("email")
            val name = record.stringOrNull("name")
            val attempts = record.optInt("attempts")
            val availableAt = record.optLong("availableAt")
            when (record.optString("kind")) {
                "identify" -> {
                    // `carriesSnapshot` is left behind: a carried snapshot stays stale, so a read revalidates it.
                    val alias = record.optString("alias").takeIf { it.isNotEmpty() } ?: return@mapNotNull null
                    PersonWrite(PersonWriteKind.IDENTIFY, alias, target, email, name, emptyMap(), attempts, availableAt)
                }
                "traits" -> {
                    val traits = record.optJSONObject("traits") ?: JSONObject()
                    PersonWrite(
                        PersonWriteKind.TRAITS,
                        target,
                        null,
                        email,
                        name,
                        traits.keys().asSequence().associateWith { traits.opt(it).takeUnless { v -> v === JSONObject.NULL } },
                        attempts,
                        availableAt,
                    )
                }
                else -> null
            }
        }
        // Everything legacy is older than what the SDK queued since: one write per key, a legacy
        // one merged into the SDK's as the older, and the legacy-only ones first, so an identify
        // the TypeScript core queued is sent before the SDK's writes for the user it creates. A
        // legacy write about a person the SDK has queued an identify onto goes right after that
        // identify instead, which creates the person it describes.
        val legacyByKey = collapse(writes)
        val nativeByKey = collapse(native)
        val nativeQueue = nativeByKey.map { (key, write) -> legacyByKey[key]?.let { mergePersonWrites(it, write) } ?: write }
        val legacyOnly = legacyByKey.filterKeys { it !in nativeByKey }.values
        val behindIdentify = legacyOnly.groupBy { write ->
            nativeQueue.indexOfFirst { it.kind == PersonWriteKind.IDENTIFY && it.target == write.target }
        }
        val queue = behindIdentify[-1].orEmpty() + nativeQueue.flatMapIndexed { index, write ->
            listOf(write) + behindIdentify[index].orEmpty()
        }
        val firstRevision = native.maxOfOrNull { it.revision } ?: 0L
        val records = queue.mapIndexed { index, write -> write.copy(revision = firstRevision + index + 1).toRecord() }
        return commit("person-writes", records + undecoded, "rn-person-writes", replace = true)
    }

    /** [writes] in queue order with one per key, a later one merged into the earlier's place as the newer. */
    private fun collapse(writes: List<PersonWrite>): LinkedHashMap<String, PersonWrite> {
        val byKey = LinkedHashMap<String, PersonWrite>()
        for (write in writes) byKey[write.key] = byKey[write.key]?.let { mergePersonWrites(it, write) } ?: write
        return byKey
    }

    // ---- Receipts ----

    private fun importTransactions(): Outcome {
        val hasKey = preferences.contains(namespace + "transactions:outbox")
        if (!legacyFile("rn-transaction-outbox").exists() && !hasKey) return Outcome.NOTHING
        val fromFile = legacyRecords("rn-transaction-outbox") ?: return Outcome.FAILED
        val fromKey = envelopeValue("transactions:outbox") as? JSONArray
        val legacy = fromFile + (0 until (fromKey?.length() ?: 0)).mapNotNull { fromKey?.optJSONObject(it) }
        val existing = store("transactions").readAll().mapNotNull(OutboxRecord::fromRecord).mapTo(HashSet()) { it.key }
        val slugs = schemaSlugs()
        val records = legacy.mapNotNull { record -> outboxRecord(record, slugs) }
            .distinctBy { it.key }
            .filter { it.key !in existing }
        // Host reports stay the host's to finish, as `reportTransaction` marks them.
        val markers = legacy.mapNotNull { record ->
            val transaction = record.optJSONObject("transaction") ?: return@mapNotNull null
            if (!transaction.optBoolean("externallyManaged")) return@mapNotNull null
            val key = record.optString("key").takeIf { it.startsWith("android:") } ?: return@mapNotNull null
            "processed-transaction:$key" to envelope(
                JSONObject().put("backendAccepted", false).put("storeFinalized", false).put("externallyManaged", true),
                ttlMs = 30 * 60_000L,
            )
        }
        return commit(
            "transactions",
            records.map { it.toRecord() },
            "rn-transaction-outbox",
            legacyKey = "transactions:outbox".takeIf { hasKey },
            entries = markers,
        )
    }

    /** The SDK's receipt for one RN outbox entry; `null` for one it cannot send (App Store, development). */
    private fun outboxRecord(record: JSONObject, slugs: Map<String, String>): OutboxRecord? {
        val key = record.optString("key")
        if (!key.startsWith("android:")) return null
        val transaction = record.optJSONObject("transaction") ?: return null
        val token = transaction.stringOrNull("purchaseToken") ?: key.removePrefix("android:")
        val productId = transaction.optString("productId")
        val distinctId = record.optString("distinctId").takeIf { it.isNotEmpty() } ?: return null
        val restore = record.stringOrNull("restoreDistinctId")
        return OutboxRecord(
            key = key,
            distinctId = distinctId,
            request = SyncTransactionRequest(
                appAccountToken = transaction.stringOrNull("appAccountToken"),
                providerProductId = productId,
                productSlug = slugs[productId] ?: productId,
                purchaseDate = transaction.optDouble("purchaseDate", 0.0),
                purchaseToken = token,
                quantity = transaction.optInt("quantity", 1),
                receipt = null,
                transactionId = transaction.stringOrNull("transactionId") ?: token,
                intent = if (restore == distinctId) SYNC_TRANSACTION_INTENT_RESTORE else SYNC_TRANSACTION_INTENT_SYNC,
                isStartedBySdk = envelopeValue("sdk-started-purchase:$key") == true,
            ),
            attempts = record.optInt("attempts"),
            availableAt = record.optLong("availableAt"),
            restoreDistinctId = restore,
        )
    }

    private fun importLedger(): Outcome {
        if (!legacyFile("rn-receipt-ledger").exists()) return Outcome.NOTHING
        val legacy = legacyRecords("rn-receipt-ledger") ?: return Outcome.FAILED
        val existing = store("accepted-receipts").readAll().mapNotNull(AcceptedReceipt::fromRecord).mapTo(HashSet()) { it.key }
        val receipts = mutableListOf<AcceptedReceipt>()
        val owners = mutableListOf<Pair<String, JSONObject>>()
        for (entry in legacy) {
            val key = entry.optString("key")
            val owner = entry.optString("owner").takeIf { it.isNotEmpty() } ?: continue
            val acceptedId = entry.stringOrNull("acceptedId")
            val restoredOwnerKey = "restored-transaction-identity:$key"
            when {
                key.startsWith("account:") ->
                    // The SDK finds the owner of a purchase it started by its account token here.
                    owners += "transaction-identity:${key.removePrefix("account:").lowercase()}" to envelope(owner)
                !key.startsWith("android:") || key in existing -> Unit
                acceptedId != null && !entry.optBoolean("revoked") ->
                    receipts += AcceptedReceipt(
                        key = key,
                        transactionId = acceptedId,
                        distinctId = owner,
                        acceptedAt = entry.optLong("acceptedAt", entry.optLong("recordedAt", System.currentTimeMillis())),
                    )
                // Only an owner (claimed for a restore not delivered yet, or carried over from an
                // earlier release), or a revocation: Voidhash has not accepted the purchase as it is
                // now. An acceptance would keep scans and host reports from sending it, so the owner
                // goes where the SDK keeps the owner of a receipt still to be delivered.
                !preferences.contains(namespace + restoredOwnerKey) ->
                    owners += restoredOwnerKey to envelope(owner, ttlMs = RESTORED_OWNER_TTL_MS)
            }
        }
        return commit("accepted-receipts", receipts.distinctBy { it.key }.map { it.toRecord() }, "rn-receipt-ledger", entries = owners)
    }

    // ---- Analytics ----

    private fun importAnalytics(): Outcome {
        val hasKey = preferences.contains(namespace + "analytics:queue")
        if (!legacyFile("rn-analytics-queue").exists() && !hasKey) return Outcome.NOTHING
        val fromFile = legacyRecords("rn-analytics-queue") ?: return Outcome.FAILED
        val fromKey = envelopeValue("analytics:queue") as? JSONArray
        val legacy = fromFile + (0 until (fromKey?.length() ?: 0)).mapNotNull { fromKey?.optJSONObject(it) }
        val existing = store("analytics").readAll().mapNotNull(AnalyticsEvent::fromRecord).mapTo(HashSet()) { it.uuid }
        val events = legacy.mapNotNull { record ->
            val name = record.optString("eventName").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val distinctId = record.optString("distinctId").takeIf { it.isNotBlank() } ?: return@mapNotNull null
            val properties = record.optJSONObject("properties") ?: JSONObject()
            AnalyticsEvent(
                uuid = record.optString("id").takeIf { it.isNotEmpty() } ?: return@mapNotNull null,
                name = name,
                distinctId = distinctId,
                sessionId = record.optString("sessionId"),
                timestamp = parseIso(record.optString("eventTimestamp")) ?: return@mapNotNull null,
                // Already stamped with the standard properties at capture; sent as they are.
                properties = properties.keys().asSequence().associateWith { properties.opt(it).takeUnless { v -> v === JSONObject.NULL } },
                attempts = record.optInt("attempts"),
                availableAt = record.optLong("availableAt"),
            )
        }.distinctBy { it.uuid }.filter { it.uuid !in existing }
        // The queue keeps the newest it can hold; the SDK trims the rest as it loads.
        return commit("analytics", events.mapNotNull { it.toRecord() }, "rn-analytics-queue", "analytics:queue".takeIf { hasKey })
    }

    // ---- Caches ----

    private fun importCaches(): Outcome {
        val removed = mutableListOf<String>()
        val added = mutableListOf<String>()
        var converted = false
        val editor = preferences.edit()
        for ((physical, stored) in preferences.all) {
            if (!physical.startsWith(namespace) || stored !is String) continue
            val key = physical.removePrefix(namespace)
            when {
                key == "native-products" || key.startsWith("native-products:") -> removed += key
                key.startsWith("schema:") && key != "schema:current" -> removed += key
                key.startsWith("person:") -> {
                    val envelope = runCatching { JSONObject(stored) }.getOrNull() ?: continue
                    if (envelope.has("value") && envelope.isNull("value")) {
                        editor.putString(physical, envelope.put("value", JSONObject().put("none", true)).toString())
                        converted = true
                    }
                }
                key.startsWith("feature-flags:") -> {
                    removed += key
                    val converted = flagsEntry(key, stored) ?: continue
                    editor.putString(namespace + converted.first, converted.second)
                    added += converted.first
                }
            }
        }
        if (removed.isEmpty() && !converted) return Outcome.NOTHING
        for (key in removed) editor.remove(namespace + key)
        if (!editor.commit()) return Outcome.FAILED
        updateIndex(added = added, removed = removed)
        return Outcome.IMPORTED
    }

    /** The SDK key and envelope for a `feature-flags:<id>:<sig>` entry; `null` when it does not parse. */
    private fun flagsEntry(key: String, stored: String): Pair<String, String>? {
        val rest = key.removePrefix("feature-flags:")
        // The colon before the signature: `<id>:all`, or `<id>:["a","b"]`.
        val signatureStart = if (rest.endsWith(":all")) rest.length - 4 else rest.indexOf(":[")
        if (signatureStart <= 0) return null
        val distinctId = rest.substring(0, signatureStart)
        val signature = rest.substring(signatureStart + 1)
        val keys = if (signature == "all") emptyList() else {
            val array = runCatching { JSONArray(signature) }.getOrNull() ?: return null
            (0 until array.length()).map { array.optString(it) }
        }
        // The SDK's flagsCacheKey: every flag, or the hash of the sorted, length-prefixed keys.
        val scope = if (keys.isEmpty()) "all" else fnv1aHex(keys.sorted().joinToString("") { "${it.toByteArray(Charsets.UTF_8).size}:$it" })
        val envelope = runCatching { JSONObject(stored) }.getOrNull() ?: return null
        val flags = envelope.optJSONObject("value")?.optJSONArray("flags") ?: return null
        return "flags:$distinctId:$scope" to envelope.put("value", flags).toString()
    }

    // ---- Helpers ----

    private fun envelopeValue(key: String): Any? {
        val stored = preferences.getString(namespace + key, null) ?: return null
        return runCatching { JSONObject(stored).opt("value") }.getOrNull()
    }

    /** The SDK's cache envelope for [value], written now. */
    private fun envelope(value: Any, ttlMs: Long? = null): JSONObject {
        val now = System.currentTimeMillis()
        return JSONObject()
            .put("value", value)
            .put("createdAt", now)
            .put("staleAt", JSONObject.NULL)
            .put("expiresAt", ttlMs?.let { now + it } ?: JSONObject.NULL)
    }

    /** Keeps the SDK's key index (`cache-keys`, the unprefixed keys) in step. */
    private fun updateIndex(added: List<String>, removed: List<String>) {
        if (added.isEmpty() && removed.isEmpty()) return
        val physical = namespace + "cache-keys"
        val stored = preferences.getString(physical, null)?.let { runCatching { JSONArray(it) }.getOrNull() }
        val keys = linkedSetOf<String>()
        for (index in 0 until (stored?.length() ?: 0)) stored?.optString(index)?.takeIf { it.isNotEmpty() }?.let(keys::add)
        keys.removeAll(removed.toSet())
        keys.addAll(added)
        preferences.edit().putString(physical, JSONArray(keys.toList()).toString()).commit()
    }

    private fun filePrefix(namespace: String) = namespace.trim(':').replace(':', '-') + "-"

    /** Product id to slug, from the schema cached under `schema:current`. */
    private fun schemaSlugs(): Map<String, String> {
        val schema = (envelopeValue("schema:current") as? JSONObject)?.optJSONObject("schema") ?: return emptyMap()
        val products = schema.optJSONObject("products") ?: return emptyMap()
        return products.keys().asSequence().mapNotNull { slug ->
            val productId = products.optJSONObject(slug)?.optJSONObject("configuration")?.optJSONObject("providers")
                ?.optJSONObject("googlePlay")?.optString("productId")?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
            productId to slug
        }.toMap()
    }

    private fun JSONObject.stringOrNull(key: String): String? =
        if (!has(key) || isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

    /** An ISO-8601 instant as JavaScript's `toISOString` writes it, in epoch millis. */
    private fun parseIso(value: String): Long? {
        for (pattern in listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")) {
            val format = SimpleDateFormat(pattern, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
            runCatching { format.parse(value)?.time }.getOrNull()?.let { return it }
        }
        return null
    }
}
