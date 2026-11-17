package com.voidhash.ui

import android.content.Context
import com.voidhash.sdk.api.RuntimeModuleReference
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Gets the flow runtime module a release needs, in module mode
 * ([VoidhashUiPaywallRenderer.runtimeMode]).
 *
 * The engine chooses: a cached module that runs the release, else the one the release names once
 * downloaded, else the module the SDK bundles when it runs the release, else nothing after a short
 * wait. It verifies every module by hash and keeps the downloaded ones in
 * `cacheDir/voidhash/runtime-modules`; this object only fetches what the engine asks for. A runtime
 * module is public code, the same for every project, so one cache serves them all. Nothing here
 * runs before a flow is presented.
 */
internal object RuntimeModules {
    private const val POLL_MS = 50L
    private const val MAX_MODULE_BYTES = 16 * 1024 * 1024
    private const val TIMEOUT_MS = 10_000

    /** Downloads run here, one at a time, beside the presentation that waits for them. */
    private val downloads = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "voidhash-runtime-modules").apply { isDaemon = true }
    }

    @Volatile
    private var configured = false

    /**
     * Waits until a module that runs the release is ready to draw it with; the engine bounds the
     * wait (3 seconds).
     *
     * @throws IllegalStateException when no module that runs the release is available.
     */
    suspend fun prepare(context: Context, runtime: RuntimeModuleReference) = withContext(Dispatchers.Default) {
        configure(context)
        while (true) {
            // Compiling a module the first time takes tens of milliseconds: never on the main thread.
            val status = VoidhashUiNative.nativeRuntimePrepare(runtime.version, runtime.sha256, runtime.url)
            // Downloads the choice started for a later presentation are fetched too.
            fetchDownloads()
            when {
                status == "ready" -> return@withContext
                status == "waiting" -> delay(POLL_MS)
                else -> throw IllegalStateException(status.removePrefix("unavailable: "))
            }
        }
    }

    private fun configure(context: Context) {
        if (configured) return
        synchronized(this) {
            if (configured) return
            val directory = File(context.cacheDir, "voidhash/runtime-modules")
            VoidhashUiNative.nativeRuntimeSetCacheDirectory(directory.path)
            configured = true
        }
    }

    private fun fetchDownloads() {
        while (true) {
            val request = VoidhashUiNative.nativeRuntimeTakeDownload() ?: return
            val sha256 = request.substringBefore(' ')
            val url = request.substringAfter(' ')
            downloads.execute {
                try {
                    VoidhashUiNative.nativeRuntimeDownloadFinished(sha256, download(url))
                } catch (error: Exception) {
                    VoidhashUiNative.nativeRuntimeDownloadFailed(sha256, error.message ?: error.toString())
                }
            }
        }
    }

    /** The bytes at [url], at most [MAX_MODULE_BYTES] of them. */
    private fun download(url: String): ByteArray {
        val connection = URL(url).openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = TIMEOUT_MS
            connection.readTimeout = TIMEOUT_MS
            val status = connection.responseCode
            check(status in 200..299) { "HTTP $status" }
            check(connection.contentLengthLong <= MAX_MODULE_BYTES) { "larger than $MAX_MODULE_BYTES bytes" }
            connection.inputStream.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(64 * 1024)
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    output.write(buffer, 0, read)
                    check(output.size() <= MAX_MODULE_BYTES) { "larger than $MAX_MODULE_BYTES bytes" }
                }
                return output.toByteArray()
            }
        } finally {
            connection.disconnect()
        }
    }
}
