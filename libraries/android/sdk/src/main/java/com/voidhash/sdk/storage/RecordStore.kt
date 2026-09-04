package com.voidhash.sdk.storage

import com.voidhash.sdk.diagnostics.DiagnosticEmitter
import com.voidhash.sdk.diagnostics.VoidhashDiagnosticKind
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile

/** Result of loading a record store, distinguishing an empty store from a failed read. */
data class RecordStoreLoad(
    val records: List<String>,
    val readFailed: Boolean = false,
)

/**
 * An append-only, line-delimited record store.
 *
 * `SharedPreferences` rewrites its whole file on every commit, which makes it the wrong
 * home for a thousand-entry queue that grows one event at a time. Queues therefore live in
 * their own NDJSON file: appends cost one write of the new lines, and the file is only
 * rewritten when the queue is compacted after a flush.
 *
 * Implementations are safe to call from several threads.
 */
interface RecordStore {
    /** Reads every stored record, oldest first. Unreadable lines are skipped. */
    fun readAll(): List<String>

    /** Loads every record while preserving whether storage could be read at all. */
    fun load(): RecordStoreLoad = RecordStoreLoad(readAll())

    /** Appends [records] to the end of the store, returning whether they reached storage. */
    fun append(records: List<String>): Boolean

    /** Rewrites the store to exactly [records], returning whether the rewrite succeeded. */
    fun replaceAll(records: List<String>): Boolean
}

/** In-memory [RecordStore] for tests and for clients configured with `enabled = false`. */
class InMemoryRecordStore(initial: List<String> = emptyList()) : RecordStore {
    private val records = ArrayList(initial)

    override fun readAll(): List<String> = synchronized(records) { records.toList() }

    override fun load(): RecordStoreLoad = RecordStoreLoad(readAll())

    override fun append(records: List<String>): Boolean {
        if (records.isEmpty()) return true
        synchronized(this.records) { this.records.addAll(records) }
        return true
    }

    override fun replaceAll(records: List<String>): Boolean {
        synchronized(this.records) {
            this.records.clear()
            this.records.addAll(records)
        }
        return true
    }
}

/**
 * [RecordStore] persisting one record per line in [file].
 *
 * A record containing a newline would break the format, so newlines are escaped on write
 * and restored on read. IO failures are reported through [onError] and never thrown: a
 * queue that cannot reach the disk still works in memory for the rest of the process.
 */
class FileRecordStore(
    private val file: File,
    private val diagnostics: DiagnosticEmitter = DiagnosticEmitter(),
    private val onError: (String, Throwable) -> Unit = { _, _ -> },
) : RecordStore {
    private fun report(context: String, error: Throwable) {
        diagnostics.emit(
            VoidhashDiagnosticKind.CACHE,
            code = "QUEUE_IO_FAILED",
            operation = "storage.$context",
            retryable = true,
            message = "Failed to $context: ${error.message}",
        )
        onError(context, error)
    }

    private val lock = Any()

    override fun readAll(): List<String> = load().records

    override fun load(): RecordStoreLoad = synchronized(lock) {
        if (!file.exists()) return RecordStoreLoad(emptyList())
        try {
            repairPartialTail()
            RecordStoreLoad(file.readLines().filter { it.isNotBlank() }.map(::decode))
        } catch (error: Throwable) {
            report("read ${file.name}", error)
            RecordStoreLoad(emptyList(), readFailed = true)
        }
    }

    override fun append(records: List<String>): Boolean {
        if (records.isEmpty()) return true
        return synchronized(lock) {
            try {
                file.parentFile?.mkdirs()
                repairPartialTail()
                file.appendText(records.joinToString(separator = "", transform = ::encode))
                true
            } catch (error: Throwable) {
                report("append to ${file.name}", error)
                false
            }
        }
    }

    override fun replaceAll(records: List<String>): Boolean {
        return synchronized(lock) {
            try {
                file.parentFile?.mkdirs()
                if (records.isEmpty()) {
                    file.writeText("")
                } else {
                    // Written through a temporary file so a crash mid-rewrite cannot leave a
                    // half-compacted queue behind.
                    val temporary = File(file.parentFile, "${file.name}.tmp")
                    FileOutputStream(temporary).use { output ->
                        output.write(
                            records.joinToString(separator = "", transform = ::encode)
                                .toByteArray(Charsets.UTF_8),
                        )
                        // Without this the rename can land before the bytes do, and a power
                        // loss leaves a correctly named, empty queue behind.
                        output.fd.sync()
                    }
                    if (!temporary.renameTo(file)) {
                        file.writeText(temporary.readText())
                        temporary.delete()
                    }
                }
                true
            } catch (error: Throwable) {
                report("rewrite ${file.name}", error)
                false
            }
        }
    }

    private fun encode(record: String): String = record
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        // `readLines` splits on a bare carriage return too, so it has to be escaped as well.
        .replace("\r", "\\r") + "\n"

    /** Removes bytes left by an append that died before writing its final newline. */
    private fun repairPartialTail() {
        if (!file.exists() || file.length() == 0L) return
        RandomAccessFile(file, "rw").use { handle ->
            handle.seek(handle.length() - 1)
            if (handle.read() == '\n'.code) return

            var offset = handle.length() - 1
            while (offset >= 0) {
                handle.seek(offset)
                if (handle.read() == '\n'.code) break
                offset -= 1
            }
            handle.setLength(offset + 1)
            handle.fd.sync()
        }
    }

    /**
     * Reverses [encode] in one pass.
     *
     * Two sequential replacements would be wrong: unescaping `\n` first turns the second
     * half of an escaped backslash-then-n into a real newline.
     */
    private fun decode(line: String): String {
        val decoded = StringBuilder(line.length)
        var index = 0
        while (index < line.length) {
            val character = line[index]
            if (character == '\\' && index + 1 < line.length) {
                when (line[index + 1]) {
                    'n' -> { decoded.append('\n'); index += 2; continue }
                    'r' -> { decoded.append('\r'); index += 2; continue }
                    '\\' -> { decoded.append('\\'); index += 2; continue }
                }
            }
            decoded.append(character)
            index += 1
        }
        return decoded.toString()
    }
}
