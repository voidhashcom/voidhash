package com.voidhash.sdk.paywall

import com.voidhash.sdk.api.FlowPackageReference
import com.voidhash.sdk.cache.CacheManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import okhttp3.Call
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Packages kept on disk; the least recently used beyond this are deleted. */
private const val MAX_CACHED_PACKAGES = 8

/** A package larger than this is refused rather than held in memory. */
internal const val MAX_FLOW_PACKAGE_BYTES = 16 * 1024 * 1024

/**
 * Downloads flow packages and keeps them on disk, content-addressed by their SHA-256.
 *
 * Every package is verified against the hash its release names, on download and again when it
 * is read back, so a truncated or tampered file is never handed to a renderer. The last package
 * that loaded for a location is remembered, so a location whose newest package cannot be
 * downloaded — the device is offline, the host is unreachable — shows the previous one instead.
 *
 * @param directory where packages are stored; a cache directory, since everything in it can be
 *   downloaded again.
 * @param download fetches the bytes at a URL, throwing when it cannot.
 */
internal class FlowPackageStore(
    private val directory: File,
    private val cacheManager: CacheManager,
    private val download: suspend (String) -> ByteArray,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val onWarning: (String) -> Unit = {},
    /**
     * Told of every package [load] hands out, by its hash, on [ioDispatcher]: what the package
     * needs besides itself, its images, is fetched from here. Must not block.
     */
    private val onLoaded: (sha256: String, bytes: ByteArray) -> Unit = { _, _ -> },
) {
    /**
     * The verified bytes of [reference], downloading them unless they are cached. Falls back to
     * the last package loaded for [locationSlug] when [reference] is unavailable; `null` when
     * there is none either.
     */
    suspend fun load(locationSlug: String, reference: FlowPackageReference): ByteArray? =
        withContext(ioDispatcher) {
            val current = try {
                readVerified(reference.sha256) ?: fetch(reference)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                onWarning("Failed to load the paywall package for \"$locationSlug\": ${error.message}")
                null
            }
            if (current != null) {
                rememberLocation(locationSlug, reference.sha256)
                onLoaded(reference.sha256, current)
                return@withContext current
            }

            val previous = rememberedSha256(locationSlug)?.takeIf { it != reference.sha256 }
                ?: return@withContext null
            readVerified(previous)?.also {
                onWarning("Showing the previously loaded paywall package for \"$locationSlug\"")
                onLoaded(previous, it)
            }
        }

    private suspend fun fetch(reference: FlowPackageReference): ByteArray {
        val bytes = download(reference.url)
        val actual = sha256Hex(bytes)
        if (actual != reference.sha256) {
            throw IOException("package hash mismatch: expected ${reference.sha256}, got $actual")
        }
        write(reference.sha256, bytes)
        return bytes
    }

    /** The cached package [sha256] names, or `null` when it is missing or does not verify. */
    private fun readVerified(sha256: String): ByteArray? {
        val file = packageFile(sha256)
        if (!file.isFile) return null
        val bytes = try {
            file.readBytes()
        } catch (error: IOException) {
            onWarning("Failed to read a cached paywall package: ${error.message}")
            return null
        }
        if (sha256Hex(bytes) != sha256) {
            onWarning("Discarding a cached paywall package that does not match its hash")
            file.delete()
            return null
        }
        // Marks the package as recently used for pruning.
        file.setLastModified(System.currentTimeMillis())
        return bytes
    }

    private fun write(sha256: String, bytes: ByteArray) {
        try {
            if (!directory.isDirectory && !directory.mkdirs()) {
                throw IOException("could not create ${directory.name}")
            }
            // Written aside and renamed, so a reader never sees a partial package.
            val partial = File.createTempFile("$sha256-", ".partial", directory)
            try {
                partial.writeBytes(bytes)
                if (!partial.renameTo(packageFile(sha256))) throw IOException("could not store the package")
            } finally {
                partial.delete()
            }
            prune()
        } catch (error: IOException) {
            // The bytes are verified and in memory; only the offline fallback is lost.
            onWarning("Failed to cache a paywall package: ${error.message}")
        }
    }

    private fun prune() {
        val packages = directory.listFiles { file -> file.name.endsWith(PACKAGE_SUFFIX) } ?: return
        packages.sortedByDescending(File::lastModified)
            .drop(MAX_CACHED_PACKAGES)
            .forEach(File::delete)
    }

    private fun rememberLocation(locationSlug: String, sha256: String) {
        val key = locationKey(locationSlug)
        if (rememberedSha256(locationSlug) == sha256) return
        cacheManager.set(key, JSONObject().put("sha256", sha256))
    }

    private fun rememberedSha256(locationSlug: String): String? =
        cacheManager.getObject(locationKey(locationSlug))?.value?.optString("sha256")?.takeIf { it.length == 64 }

    private fun packageFile(sha256: String) = File(directory, sha256 + PACKAGE_SUFFIX)

    private fun locationKey(locationSlug: String) = "paywall-package:$locationSlug"

    companion object {
        private const val PACKAGE_SUFFIX = ".vhfp"

        /** Lowercase hex SHA-256 of [bytes]. */
        fun sha256Hex(bytes: ByteArray): String =
            MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    }
}

/**
 * How long one package download may take in total. Longer than an API call, because a package is
 * up to [MAX_FLOW_PACKAGE_BYTES] of content, but bounded, so a presentation waiting on it ends.
 */
internal const val FLOW_PACKAGE_DOWNLOAD_TIMEOUT_MS = 20_000L

/**
 * Downloads [url] through the SDK's HTTP client, refusing anything but a successful response of
 * at most [MAX_FLOW_PACKAGE_BYTES].
 *
 * The download passes through [gate] under a breaker of its own per package host, so while that
 * host is failing a presentation falls back to the last package at once instead of waiting out
 * another download.
 */
internal fun downloadFlowPackage(httpClient: Call.Factory, url: String, gate: OutboundGate? = null): ByteArray =
    downloadFlowAsset(
        httpClient, url, gate,
        breaker = "packages",
        operation = "paywall.package",
        what = "package",
        maxBytes = MAX_FLOW_PACKAGE_BYTES,
        timeoutMs = FLOW_PACKAGE_DOWNLOAD_TIMEOUT_MS,
    )

/**
 * Downloads one file a flow needs, its package or an image: a successful response of at most
 * [maxBytes], within [timeoutMs], under the breaker `<breaker>:<host>` of [gate].
 */
internal fun downloadFlowAsset(
    httpClient: Call.Factory,
    url: String,
    gate: OutboundGate?,
    breaker: String,
    operation: String,
    what: String,
    maxBytes: Int,
    timeoutMs: Long,
): ByteArray {
    val request = Request.Builder().url(url).get().build()
    val host = "$breaker:${request.url.host}"
    // A download carries no publishable key, so a rejected key does not hold it back; only the
    // host's own breaker does.
    val permit = gate?.let { it.breaker.acquire(host) ?: throw VoidhashCircuitOpenException(host) }
    // Cleared for a failure that is about the file rather than its host.
    var hostFailed = true
    try {
        val call = httpClient.newCall(request)
        call.timeout().timeout(timeoutMs, TimeUnit.MILLISECONDS)
        return try {
            call.execute().use { response ->
                if (!response.isSuccessful) {
                    // A 4xx is about this file, not the host, so only a server failure or a
                    // timeout counts against it; rate limiting is a host that is up.
                    val code = response.code
                    hostFailed = code >= 500 || code == 408
                    throw IOException("HTTP $code")
                }
                val body = response.body ?: throw IOException("empty response")
                val declared = body.contentLength()
                if (declared > maxBytes) {
                    hostFailed = false
                    throw IOException("$what too large")
                }
                body.source().use { source ->
                    if (source.request(maxBytes.toLong() + 1)) {
                        hostFailed = false
                        throw IOException("$what too large")
                    }
                    source.buffer.readByteArray()
                }.also { gate?.breaker?.recordSuccess(permit, operation) }
            }
        } catch (error: IOException) {
            if (hostFailed) gate?.recordHostFailure(permit, operation)
            throw error
        }
    } finally {
        // Hands back a permit nothing above settled; settling twice is a no-op.
        gate?.breaker?.release(permit)
    }
}
