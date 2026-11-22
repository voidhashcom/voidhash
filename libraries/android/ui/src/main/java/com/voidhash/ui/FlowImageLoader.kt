package com.voidhash.ui

import android.os.Handler
import android.os.Looper
import com.voidhash.sdk.flows.FlowPackageImages
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.concurrent.CyclicBarrier
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/** An image larger than this is refused rather than held in memory. */
private const val MAX_IMAGE_BYTES = 10 * 1024 * 1024

private const val CONNECT_TIMEOUT_MS = 10_000
private const val READ_TIMEOUT_MS = 15_000

/**
 * Downloads the images a paywall asks for, off the main thread, for a view no SDK host loads
 * images for. A paywall the SDK presents gets its images through the host instead, which keeps
 * them on the device.
 */
internal object FlowImageLoader {
    private const val THREADS = 2

    private val executor: ExecutorService by lazy {
        Executors.newFixedThreadPool(THREADS) { task ->
            Thread(task, "voidhash-paywall-images").apply { isDaemon = true }
        }
    }
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    /**
     * Downloads [url] and reports the outcome to [onResult] on the main thread. An image its
     * flow's build pinned to [sha256] fails with `FlowImageMismatchException` unless its bytes
     * hash to it, checked off the main thread before anything decodes them; `null` is an image
     * the build did not pin, which cannot be verified.
     */
    fun fetch(url: String, sha256: String?, onResult: (Result<ByteArray>) -> Unit) =
        background({ download(url, pinned = sha256 != null).also { FlowPackageImages.verify(it, sha256) } }, onResult)

    /**
     * For tests: returns once everything handed to the image threads before it has run, its
     * report to the main thread posted.
     */
    internal fun drainForTests() {
        val barrier = CyclicBarrier(THREADS + 1)
        repeat(THREADS) { executor.execute { barrier.await() } }
        barrier.await()
    }

    /** Runs [work] off the main thread, on the image threads, and reports its outcome to [onResult] on the main thread. */
    fun <T> background(work: () -> T, onResult: (Result<T>) -> Unit) {
        executor.execute {
            val result = runCatching(work)
            mainHandler.post { onResult(result) }
        }
    }

    private fun download(url: String, pinned: Boolean): ByteArray {
        val connection = openFlowDownload(url, "image", CONNECT_TIMEOUT_MS, READ_TIMEOUT_MS, pinned)
        try {
            val status = connection.responseCode
            if (status !in 200..299) throw IOException("HTTP $status")
            if (connection.contentLength > MAX_IMAGE_BYTES) throw IOException("image too large")
            return connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(16 * 1024)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    output.write(buffer, 0, read)
                    if (output.size() > MAX_IMAGE_BYTES) throw IOException("image too large")
                }
                output.toByteArray()
            }
        } finally {
            connection.disconnect()
        }
    }
}
