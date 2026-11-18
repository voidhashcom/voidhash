package com.voidhash.ui

import android.os.Handler
import android.os.Looper
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
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
internal object PaywallImageLoader {
    private val executor: ExecutorService by lazy {
        Executors.newFixedThreadPool(2) { task ->
            Thread(task, "voidhash-paywall-images").apply { isDaemon = true }
        }
    }
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }

    /** Downloads [url] and reports the outcome to [onResult] on the main thread. */
    fun fetch(url: String, onResult: (Result<ByteArray>) -> Unit) = background({ download(url) }, onResult)

    /** Runs [work] off the main thread, on the image threads, and reports its outcome to [onResult] on the main thread. */
    fun <T> background(work: () -> T, onResult: (Result<T>) -> Unit) {
        executor.execute {
            val result = runCatching(work)
            mainHandler.post { onResult(result) }
        }
    }

    private fun download(url: String): ByteArray {
        val parsed = URL(url)
        if (parsed.protocol != "https" && parsed.protocol != "http") {
            throw IOException("unsupported scheme ${parsed.protocol}")
        }
        val connection = parsed.openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
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
