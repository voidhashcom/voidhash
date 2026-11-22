package com.voidhash.sdk.flows

import com.voidhash.sdk.api.FlowPackageReference
import com.voidhash.sdk.cache.CacheManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.VoidhashCircuitOpenException
import okhttp3.Call
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/** Packages kept on disk; the least recently used beyond this are deleted. */
private const val MAX_CACHED_PACKAGES = 8

/** A package larger than this is refused rather than held in memory. */
internal const val MAX_FLOW_PACKAGE_BYTES = 16 * 1024 * 1024

/** How many withdrawn packages the store refuses on its own, newest first. */
private const val MAX_WITHDRAWN_PACKAGES = 100

/** Cache key of the packages withdrawn as bad, newest first. */
private const val WITHDRAWN_PACKAGES_CACHE_KEY = "paywall-packages:withdrawn"

/** Why no flow package could be loaded. */
internal enum class FlowPackageFailure {
    /** It could not be downloaded, and nothing to fall back to was on the device. */
    DOWNLOAD,

    /** The downloaded bytes did not hash to the package's SHA-256. */
    INTEGRITY,

    /** It was withdrawn as bad, and nothing to fall back to was on the device. */
    WITHDRAWN,
}

/** What [FlowPackageStore.load] came to. */
internal sealed class FlowPackageLoad {
    /** The verified bytes of a package; [fromCache] when they were already on the device, a fallback included. */
    class Loaded(val bytes: ByteArray, val fromCache: Boolean) : FlowPackageLoad()

    /** No verified package could be had; [failure] says why the one asked for could not. */
    class Failed(val failure: FlowPackageFailure) : FlowPackageLoad()
}

/** Downloaded bytes that do not hash to the package's SHA-256. */
private class PackageIntegrityException(message: String) : IOException(message)

/**
 * Downloads flow packages and keeps them on disk, content-addressed by their SHA-256.
 *
 * Every package is verified against the hash its release names, on download and again when it
 * is read back, so a truncated or tampered file is never handed to a renderer. The last package
 * that loaded for a location is remembered, so a location whose newest package cannot be
 * downloaded — the device is offline, the host is unreachable — shows the previous one instead.
 *
 * Never a withdrawn one, though. A resolve answer lists the packages withdrawn as bad at its
 * location ([answered]): the location forgets one it last showed, whose file is deleted unless
 * another location still shows it, and the store keeps the most recent [MAX_WITHDRAWN_PACKAGES]
 * hashes, which it refuses to hand out, as a fallback or as the package an answer names, since
 * an answer cached under another key may still name one. An answer serving a hash again takes it
 * off that list: a withdrawal can be reversed.
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
     * Guards the withdrawn list with what locations remember: a package [load] remembers is
     * checked against the list under it, and [answered] updates the list and forgets packages
     * under it, so a withdrawal arriving during a load never leaves the withdrawn package kept.
     */
    private val withdrawnLock = Any()

    /**
     * The verified bytes of [reference], downloading them unless they are cached. Falls back to
     * the last package loaded for [locationSlug] when [reference] is unavailable; fails when there
     * is none either. Neither may be a package [withdrawn], the list of the answer naming
     * [reference], or the store's own list names.
     */
    suspend fun load(
        locationSlug: String,
        reference: FlowPackageReference,
        withdrawn: Collection<String> = emptyList(),
    ): FlowPackageLoad = withContext(ioDispatcher) {
        val refused = withdrawnPackages() + withdrawn.map(String::lowercase)
        val failure = if (reference.sha256 in refused) {
            onWarning("The paywall package for \"$locationSlug\" was withdrawn and is not shown")
            FlowPackageFailure.WITHDRAWN
        } else {
            try {
                val cached = readVerified(reference.sha256)
                val bytes = cached ?: fetch(reference)
                // Withdrawn while it was read or downloaded: not kept, and not shown.
                val withdrawnMeanwhile = synchronized(withdrawnLock) {
                    (reference.sha256 in withdrawnPackages()).also { withdrawnNow ->
                        if (!withdrawnNow) rememberLocation(locationSlug, reference.sha256)
                    }
                }
                if (withdrawnMeanwhile) {
                    deleteUnlessShown(reference.sha256)
                    return@withContext FlowPackageLoad.Failed(FlowPackageFailure.WITHDRAWN)
                }
                onLoaded(reference.sha256, bytes)
                return@withContext FlowPackageLoad.Loaded(bytes, fromCache = cached != null)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                onWarning("Failed to load the paywall package for \"$locationSlug\": ${error.message}")
                if (error is PackageIntegrityException) FlowPackageFailure.INTEGRITY else FlowPackageFailure.DOWNLOAD
            }
        }

        val previous = rememberedSha256(locationSlug)
            ?.takeIf { it != reference.sha256 && it !in refused }
            ?: return@withContext FlowPackageLoad.Failed(failure)
        val fallback = readVerified(previous) ?: return@withContext FlowPackageLoad.Failed(failure)
        onWarning("Showing the previously loaded paywall package for \"$locationSlug\"")
        onLoaded(previous, fallback)
        FlowPackageLoad.Loaded(fallback, fromCache = true)
    }

    /**
     * Takes in what an answer for [locationSlug] says about packages: it serves [serving], and
     * [withdrawn] are withdrawn. The location forgets a package it last showed that is withdrawn,
     * and its file is deleted unless another location still shows it.
     */
    suspend fun answered(locationSlug: String, serving: String?, withdrawn: List<String>) {
        val listed = withdrawn.map(String::lowercase)
        val served = serving?.lowercase()
        // Most answers list nothing and serve a package that was never withdrawn.
        if (listed.isEmpty() && (served == null || served !in withdrawnPackages())) return
        withContext(ioDispatcher) {
            val forgotten = synchronized(withdrawnLock) {
                val known = withdrawnPackages()
                val updated = (listed + known).distinct().filter { it != served }.take(MAX_WITHDRAWN_PACKAGES)
                if (updated != known) cacheManager.set(WITHDRAWN_PACKAGES_CACHE_KEY, JSONArray(updated))
                rememberedSha256(locationSlug)?.takeIf { it in listed }?.also { cacheManager.delete(locationKey(locationSlug)) }
            }
            forgotten?.let(::deleteUnlessShown)
        }
    }

    /** Whether an answer listed [sha256] as withdrawn: no package it names is shown, not even one an app bundles. */
    fun isWithdrawn(sha256: String): Boolean = sha256.lowercase() in withdrawnPackages()

    /** Deletes the package [sha256] names unless a location still remembers it. */
    private fun deleteUnlessShown(sha256: String) {
        val stillShown = cacheManager.getCacheKeys()
            .filter { it.startsWith(LOCATION_KEY_PREFIX) }
            .any { key -> cacheManager.getObject(key)?.value?.optString("sha256") == sha256 }
        if (!stillShown) packageFile(sha256).delete()
    }

    /** The packages withdrawn as bad that this store knows of, newest first. */
    private fun withdrawnPackages(): List<String> {
        val stored = cacheManager.getArray(WITHDRAWN_PACKAGES_CACHE_KEY)?.value ?: return emptyList()
        return (0 until stored.length()).mapNotNull { stored.opt(it) as? String }
    }

    private suspend fun fetch(reference: FlowPackageReference): ByteArray {
        val bytes = download(reference.url)
        val actual = sha256Hex(bytes)
        if (actual != reference.sha256) {
            throw PackageIntegrityException("package hash mismatch: expected ${reference.sha256}, got $actual")
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

    private fun locationKey(locationSlug: String) = LOCATION_KEY_PREFIX + locationSlug

    companion object {
        private const val PACKAGE_SUFFIX = ".vhfp"
        private const val LOCATION_KEY_PREFIX = "paywall-package:"

        /** Lowercase hex SHA-256 of [bytes]. */
        fun sha256Hex(bytes: ByteArray): String = hex(MessageDigest.getInstance("SHA-256").digest(bytes))

        /** Lowercase hex of [digest]. */
        fun hex(digest: ByteArray): String = digest.joinToString("") { "%02x".format(it) }
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

/** Redirects a flow download follows before it gives up. */
private const val MAX_FLOW_REDIRECTS = 5

/**
 * Downloads one file a flow needs, its package or an image: a successful response of at most
 * [maxBytes], within [timeoutMs] in all, under the breaker `<breaker>:<host>` of [gate].
 *
 * Only from URLs [FlowUrlPolicy] permits, [pinned] for an image its package pins: the client
 * follows no redirect itself, and each one is checked before it is requested, so nothing connects
 * to a refused URL.
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
    pinned: Boolean = false,
): ByteArray {
    // Refused before any request, and not counted against the host: the URL is the problem.
    var current = FlowUrlPolicy.permitted(url, pinned) ?: throw IOException("$what URL refused: flows download only over https, from hosts on the internet")
    val client = (httpClient as? OkHttpClient)
        ?.takeIf { it.followRedirects || it.followSslRedirects }
        ?.newBuilder()?.followRedirects(false)?.followSslRedirects(false)?.build()
        ?: httpClient
    val host = "$breaker:${current.toHttpUrl().host}"
    // A download carries no publishable key, so a rejected key does not hold it back; only the
    // host's own breaker does.
    val permit = gate?.let { it.breaker.acquire(host) ?: throw VoidhashCircuitOpenException(host) }
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(timeoutMs)
    // Cleared for a failure that is about the file rather than its host.
    var hostFailed = true
    try {
        repeat(MAX_FLOW_REDIRECTS + 1) {
            val call = client.newCall(Request.Builder().url(current).get().build())
            val remainingMs = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime())
            if (remainingMs <= 0) throw IOException("$what download timed out")
            call.timeout().timeout(remainingMs, TimeUnit.MILLISECONDS)
            try {
                call.execute().use { response ->
                    // A client that follows redirects itself still never hands over what a refused URL served.
                    val answered = response.request.url.toString()
                    if (answered != current && FlowUrlPolicy.permittedRedirect(current, answered, pinned) == null) {
                        hostFailed = false
                        throw IOException("$what redirected to a refused URL")
                    }
                    if (response.isRedirect) {
                        val location = response.header("Location")
                        hostFailed = false
                        current = location?.let { FlowUrlPolicy.permittedRedirect(answered, it, pinned) }
                            ?: throw IOException("$what redirected to a refused URL")
                        hostFailed = true
                        return@repeat
                    }
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
                    return body.source().use { source ->
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
        }
        throw IOException("$what redirected more than $MAX_FLOW_REDIRECTS times")
    } finally {
        // Hands back a permit nothing above settled; settling twice is a no-op.
        gate?.breaker?.release(permit)
    }
}
