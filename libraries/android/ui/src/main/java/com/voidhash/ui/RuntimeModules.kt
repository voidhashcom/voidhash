package com.voidhash.ui

import com.voidhash.sdk.api.RuntimeModuleReference
import android.content.pm.ApplicationInfo
import com.voidhash.sdk.flows.isDebuggableApp
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.Executors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Gets the flow runtime module a release needs, in module mode ([FlowViewRenderer.runtimeMode]).
 *
 * The views core chooses: a cached module that runs the release, else the one the release names
 * once downloaded, else the module the SDK bundles when it runs the release, else nothing after a
 * short wait. It verifies every module by hash and by the signature the release names, once, as
 * it stores it in `cacheDir/voidhash/runtime-modules`; a module refused for its signature never
 * runs, and the release then shows on the linked runtime if that reads it. This object only
 * fetches what the core asks for. A runtime
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

    @Volatile
    private var developmentKeysTrusted = false

    /** Whether the app of [info] is a debuggable build, the only kind that trusts the development key. */
    internal fun isDebuggable(info: ApplicationInfo): Boolean = (info.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0

    /**
     * Has the core trust the development root when [debuggable]: only a debuggable build of the
     * app is (read from the app's flags where the renderer holds a context, else as the SDK read
     * them at configuration), so a release build runs modules signed for release alone. Returns
     * whether the core trusts it.
     */
    internal fun trustDevelopmentKeys(debuggable: Boolean = isDebuggableApp()): Boolean {
        if (!debuggable) return developmentKeysTrusted
        if (!developmentKeysTrusted) {
            ViewsNative.nativeRuntimeTrustDevelopmentRoot()
            developmentKeysTrusted = true
        }
        return true
    }

    /**
     * Waits until a module that runs the release is ready to draw it with; the core bounds the
     * wait (3 seconds). [cacheDirectory] is the app's cache directory; the first call fixes it for
     * the process.
     *
     * @throws IllegalStateException when no module that runs the release is available.
     */
    suspend fun prepare(cacheDirectory: File, runtime: RuntimeModuleReference) = withContext(Dispatchers.Default) {
        configure(cacheDirectory)
        while (true) {
            // Compiling a module the first time takes tens of milliseconds: never on the main thread.
            val status = ViewsNative.nativeRuntimePrepare(runtime.version, runtime.sha256, runtime.url, runtime.signature.orEmpty())
            // Downloads the choice started for a later presentation are fetched too.
            fetchDownloads()
            when {
                status == "ready" -> return@withContext
                status == "waiting" -> delay(POLL_MS)
                else -> throw IllegalStateException(status.removePrefix("unavailable: "))
            }
        }
    }

    private fun configure(cacheDirectory: File) {
        if (configured) return
        synchronized(this) {
            if (configured) return
            ViewsNative.nativeRuntimeSetCacheDirectory(File(cacheDirectory, "voidhash/runtime-modules").path)
            configured = true
        }
    }

    private fun fetchDownloads() {
        while (true) {
            val request = ViewsNative.nativeRuntimeTakeDownload() ?: return
            val sha256 = request.substringBefore(' ')
            val url = request.substringAfter(' ')
            downloads.execute {
                try {
                    ViewsNative.nativeRuntimeDownloadFinished(sha256, download(url))
                } catch (error: Exception) {
                    ViewsNative.nativeRuntimeDownloadFailed(sha256, error.message ?: error.toString())
                }
            }
        }
    }

    /**
     * The bytes at [url], at most [MAX_MODULE_BYTES] of them, over `https` apart from a local
     * development server ([openFlowDownload]). The core checks them against the hash.
     */
    internal fun download(url: String): ByteArray {
        val connection = openFlowDownload(url, "runtime module", TIMEOUT_MS, TIMEOUT_MS)
        try {
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
