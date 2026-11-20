package com.voidhash.sdk.flows

import com.voidhash.sdk.network.OutboundGate
import com.voidhash.sdk.network.SingleFlight
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.Call
import java.io.File
import java.io.IOException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import java.util.zip.CRC32

/** An image larger than this is refused rather than held in memory or stored. */
internal const val MAX_FLOW_IMAGE_BYTES = 10 * 1024 * 1024

/** What the stored images may take on disk together; the least recently used beyond it are deleted. */
internal const val MAX_FLOW_IMAGE_STORE_BYTES = 64L * 1024 * 1024

/** How many of a package's listed images are fetched ahead of its presentation. */
private const val MAX_PREFETCHED_IMAGES = 64

/** How many images are fetched ahead at a time. */
private const val PREFETCH_CONCURRENCY = 4

/** How long a file being written may lie around before it counts as abandoned. */
private const val ABANDONED_PARTIAL_AGE_MS = 10 * 60_000L

/** `VHIM`, the first four bytes of a stored image. */
private const val IMAGE_FILE_MAGIC = 0x4D494856

/** Magic, payload length and payload CRC-32. */
private const val IMAGE_FILE_HEADER_BYTES = 12

/**
 * Keeps the images flows show on disk, so a flow whose package is cached still shows its
 * backgrounds, product art and icons while the host serving them cannot be reached.
 *
 * Images are public content of a paywall, the same for every person and project of the app, so
 * the store is keyed by the image's URL alone and nothing that resets an identity touches it. An
 * image is read from the store first and downloaded, then stored, only when it is not there.
 * Each file carries its length and a checksum: one that was cut short or damaged is deleted and
 * counts as not stored. Only `http` and `https` URLs are loaded, and no image larger than
 * [MAX_FLOW_IMAGE_BYTES].
 *
 * Only what starts like an image the renderer decodes ([isDecodableImage]) is handed out or
 * stored, whether it was just downloaded or is on disk already. A successful response that is no
 * image counts as a failed download, so one bad answer cannot stand in for an image until the
 * store evicts it; and an image the renderer then cannot use after all is removed ([discard]).
 *
 * The store holds at most [maxBytes]; beyond that the images used longest ago are deleted.
 * Everything in it can be downloaded again, so it lives in a cache directory.
 *
 * Fetching a package's images ahead ([prefetch]) is a courtesy that must cost the user nothing
 * they did not ask for: it runs once per package and process, never on a metered connection, and
 * stops once it has written half of what the store holds, so no pass can push out everything the
 * packages before it stored. An image a flow displays is always loaded, whatever the connection.
 *
 * @param directory where the images are stored. Resolved on first use, so building the store
 *   touches no storage.
 * @param download fetches the bytes at a URL, throwing when it cannot.
 * @param isMetered whether the connection in use is billed by volume, such as cellular data.
 */
internal class FlowImageStore(
    directory: () -> File,
    private val download: suspend (String) -> ByteArray,
    private val ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val maxBytes: Long = MAX_FLOW_IMAGE_STORE_BYTES,
    private val now: () -> Long = { System.currentTimeMillis() },
    private val onWarning: (String) -> Unit = {},
    private val isMetered: () -> Boolean = { false },
) {
    private val directory by lazy(directory)

    /** One read or download per image at a time, shared by whoever asks for it meanwhile. */
    private val loads = SingleFlight()

    /** Serializes what changes the directory, so two writers never prune at once. */
    private val writes = Any()

    /** The packages whose images were fetched ahead in this process. */
    private val prefetched: MutableSet<String> = Collections.newSetFromMap(ConcurrentHashMap())

    /**
     * The image at [url]: from the store, otherwise downloaded and stored for the next time.
     * Throws when the URL is not `http` or `https`, the image is too large, what was downloaded
     * is not an image, or it is neither stored nor can be downloaded.
     */
    suspend fun load(url: String): ByteArray {
        requireHttp(url)
        return withContext(ioDispatcher) {
            loads.run(url) { read(url) ?: fetch(url).image }
        }
    }

    /** A downloaded image, and how many bytes storing it took; none when it was not stored. */
    private class Fetched(val image: ByteArray, val storedBytes: Long)

    private suspend fun fetch(url: String): Fetched {
        val image = download(url)
        if (image.size > MAX_FLOW_IMAGE_BYTES) throw IOException("image too large")
        // Refused like a failed download, and above all never stored: kept, it would be read
        // from here before the network for good, and stay the freshest file for being read.
        if (!isDecodableImage(image)) throw IOException("the response is not a PNG, JPEG, GIF or WebP image")
        return Fetched(image, write(url, image))
    }

    /**
     * Fetches the images the package [packageKey] lists, [urls], that are not stored yet: a few
     * at a time, at most [MAX_PREFETCHED_IMAGES] of them, and no more than half of what the store
     * holds. One that is stored counts as used now, so the pass keeps it. One that cannot be
     * fetched is a warning: it is fetched again when a flow shows it.
     *
     * Runs once per package and process, and not at all on a metered connection, where it is
     * left for a later load of the package. [urls] is read only when the pass runs.
     */
    suspend fun prefetch(packageKey: String, urls: () -> List<String>) {
        if (packageKey in prefetched || isMetered() || !prefetched.add(packageKey)) return
        val wanted = urls().distinct().take(MAX_PREFETCHED_IMAGES)
        if (wanted.isEmpty()) return
        val permits = Semaphore(PREFETCH_CONCURRENCY)
        val budget = maxBytes / 2
        val written = AtomicLong(0)
        withContext(ioDispatcher) {
            coroutineScope {
                for (url in wanted) {
                    launch {
                        permits.withPermit {
                            try {
                                requireHttp(url)
                                val stored = imageFile(url)
                                when {
                                    // Still wanted: not the first to go when the store fills up.
                                    stored.isFile -> stored.setLastModified(now())
                                    written.get() < budget ->
                                        written.addAndGet(loads.run(url) { read(url)?.let { 0L } ?: fetch(url).storedBytes })
                                }
                            } catch (error: CancellationException) {
                                throw error
                            } catch (error: Exception) {
                                onWarning("Failed to fetch a paywall image ahead of its presentation: ${error.message}")
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Removes the stored image of [url], which the renderer was given and could not use: a file
     * that starts like an image and is not one it decodes. The next presentation then fetches the
     * image again instead of reading the same bytes for good.
     */
    suspend fun discard(url: String) {
        if (runCatching { requireHttp(url) }.isFailure) return
        withContext(ioDispatcher) { synchronized(writes) { imageFile(url).delete() } }
    }

    private fun requireHttp(url: String) {
        val scheme = url.substringBefore("://", missingDelimiterValue = "").lowercase()
        if (scheme != "https" && scheme != "http") throw IOException("unsupported image URL scheme")
    }

    /** The stored image of [url], or `null` when there is none or it does not verify. */
    private fun read(url: String): ByteArray? {
        val file = imageFile(url)
        if (!file.isFile) return null
        val stored = try {
            file.readBytes()
        } catch (error: IOException) {
            onWarning("Failed to read a stored paywall image: ${error.message}")
            return null
        }
        // A file written whole can still hold what is no image: an earlier release stored
        // whatever a successful response carried.
        val image = decode(stored)?.takeIf(::isDecodableImage)
        if (image == null) {
            onWarning("Discarding a stored paywall image that is incomplete, damaged or not an image")
            file.delete()
            return null
        }
        // Marks the image as recently used for pruning.
        file.setLastModified(now())
        return image
    }

    /** Stores [image] for [url]; returns the bytes it takes on disk, `0` when it was not stored. */
    private fun write(url: String, image: ByteArray): Long {
        // One the store could never hold is shown and not kept.
        if (image.size + IMAGE_FILE_HEADER_BYTES > maxBytes) return 0L
        try {
            synchronized(writes) {
                if (!directory.isDirectory && !directory.mkdirs()) {
                    throw IOException("could not create ${directory.name}")
                }
                val target = imageFile(url)
                // Written aside and renamed, so a reader never sees a partial image.
                val partial = File.createTempFile("${target.nameWithoutExtension}-", PARTIAL_SUFFIX, directory)
                try {
                    partial.outputStream().use { output ->
                        output.write(header(image))
                        output.write(image)
                    }
                    if (!partial.renameTo(target)) throw IOException("could not store the image")
                    target.setLastModified(now())
                } finally {
                    partial.delete()
                }
                prune()
            }
            return image.size.toLong() + IMAGE_FILE_HEADER_BYTES
        } catch (error: IOException) {
            // The image is in memory and shown; only the copy for the next time is lost.
            onWarning("Failed to store a paywall image: ${error.message}")
            return 0L
        }
    }

    /** Deletes the images used longest ago until the store fits [maxBytes], and abandoned partial files. */
    private fun prune() {
        val files = directory.listFiles() ?: return
        val abandonedBefore = now() - ABANDONED_PARTIAL_AGE_MS
        files.filter { it.name.endsWith(PARTIAL_SUFFIX) && it.lastModified() < abandonedBefore }.forEach(File::delete)
        var total = 0L
        for (file in files.filter { it.name.endsWith(IMAGE_SUFFIX) }.sortedByDescending(File::lastModified)) {
            total += file.length()
            if (total > maxBytes) file.delete()
        }
    }

    private fun header(image: ByteArray): ByteArray =
        ByteBuffer.allocate(IMAGE_FILE_HEADER_BYTES).order(ByteOrder.LITTLE_ENDIAN)
            .putInt(IMAGE_FILE_MAGIC)
            .putInt(image.size)
            .putInt(CRC32().apply { update(image) }.value.toInt())
            .array()

    /** The image inside a stored file; `null` unless its length and checksum match. */
    private fun decode(stored: ByteArray): ByteArray? {
        if (stored.size < IMAGE_FILE_HEADER_BYTES) return null
        val header = ByteBuffer.wrap(stored, 0, IMAGE_FILE_HEADER_BYTES).order(ByteOrder.LITTLE_ENDIAN)
        if (header.int != IMAGE_FILE_MAGIC) return null
        if (header.int != stored.size - IMAGE_FILE_HEADER_BYTES) return null
        val image = stored.copyOfRange(IMAGE_FILE_HEADER_BYTES, stored.size)
        return image.takeIf { CRC32().apply { update(it) }.value.toInt() == header.int }
    }

    private fun imageFile(url: String): File {
        val key = MessageDigest.getInstance("SHA-256").digest(url.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return File(directory, key + IMAGE_SUFFIX)
    }

    private companion object {
        const val IMAGE_SUFFIX = ".vhimg"
        const val PARTIAL_SUFFIX = ".partial"
    }
}

private val PNG_SIGNATURE = byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
private val JPEG_SIGNATURE = byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte())
private val GIF_SIGNATURES = listOf("GIF87a", "GIF89a").map { it.toByteArray(Charsets.US_ASCII) }
private val RIFF_SIGNATURE = "RIFF".toByteArray(Charsets.US_ASCII)
private val WEBP_SIGNATURE = "WEBP".toByteArray(Charsets.US_ASCII)

/** Where a RIFF file names its kind: after `RIFF` and its four-byte length. */
private const val RIFF_KIND_OFFSET = 8

/**
 * Whether [bytes] start like an image of a format the flow renderer decodes: PNG, JPEG, GIF or
 * WebP. Anything else answered where an image was asked for — a proxy's block page, a firewall's
 * challenge, an origin's error served with a 200 — is not an image, however successful its
 * response was. A file that starts right can still be one the renderer cannot decode; it then
 * says so, and the image is discarded (see [FlowImageStore.discard]).
 */
internal fun isDecodableImage(bytes: ByteArray): Boolean =
    bytes.startsWith(PNG_SIGNATURE) ||
        bytes.startsWith(JPEG_SIGNATURE) ||
        GIF_SIGNATURES.any { bytes.startsWith(it) } ||
        bytes.startsWith(RIFF_SIGNATURE) && bytes.startsWith(WEBP_SIGNATURE, RIFF_KIND_OFFSET)

private fun ByteArray.startsWith(prefix: ByteArray, offset: Int = 0): Boolean =
    size >= offset + prefix.size && prefix.indices.all { this[offset + it] == prefix[it] }

/** How long one image download may take in total. */
internal const val FLOW_IMAGE_DOWNLOAD_TIMEOUT_MS = 20_000L

/**
 * Downloads the image at [url] through the SDK's HTTP client, refusing anything but a successful
 * response of at most [MAX_FLOW_IMAGE_BYTES].
 *
 * Like a package download it passes through [gate] under a breaker of its own per image host, so
 * while that host is failing a flow's images fail at once instead of each waiting out a timeout.
 */
internal fun downloadFlowImage(httpClient: Call.Factory, url: String, gate: OutboundGate? = null): ByteArray =
    downloadFlowAsset(
        httpClient, url, gate,
        breaker = "images",
        operation = "paywall.image",
        what = "image",
        maxBytes = MAX_FLOW_IMAGE_BYTES,
        timeoutMs = FLOW_IMAGE_DOWNLOAD_TIMEOUT_MS,
    )
