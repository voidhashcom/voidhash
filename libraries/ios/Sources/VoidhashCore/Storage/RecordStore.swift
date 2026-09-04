import Foundation

/// What ``RecordStore/load()`` found.
public struct RecordStoreLoad: Sendable {
    /// The complete records, oldest first.
    public let lines: [String]
    /// A trailing partial record dropped because the process died mid-append.
    public let droppedPartialRecord: Bool
    /// The store exists but could not be read, so `lines` says nothing about what is on disk.
    ///
    /// A caller must not rewrite or clear the store off a failed load: doing so would delete
    /// records it never saw. Appending is still safe.
    public let readFailed: Bool

    public init(lines: [String], droppedPartialRecord: Bool = false, readFailed: Bool = false) {
        self.lines = lines
        self.droppedPartialRecord = droppedPartialRecord
        self.readFailed = readFailed
    }
}

/// Append-only persistence for a queue of newline-delimited JSON records.
///
/// `UserDefaults` rewrites its whole backing file on every commit, which is the wrong shape for a
/// queue receiving an event at a time. The analytics queue and the transaction outbox use this
/// instead: appends are cheap, and the file is rewritten only when records are acknowledged.
public protocol RecordStore: Sendable {
    /// Returns every complete record, oldest first, and whether a partial one was discarded.
    func load() async -> RecordStoreLoad
    /// Appends `lines` to the end of the store, durably. Returns whether the write succeeded.
    @discardableResult
    func append(_ lines: [String]) async -> Bool
    /// Atomically replaces the entire contents with `lines`.
    func replace(with lines: [String]) async
    /// Removes the store.
    func clear() async
}

/// ``RecordStore`` backed by a file in the app's Application Support directory.
///
/// All file IO runs on a private serial queue rather than on the cooperative pool: a queue write
/// is blocking, and blocking a cooperative thread starves unrelated SDK work.
public final class FileRecordStore: RecordStore, @unchecked Sendable {
    private let url: URL
    private let diagnostics: DiagnosticEmitter
    private let queue: DispatchQueue

    /// - Parameters:
    ///   - url: File the records are written to. The parent directory is created on demand.
    ///   - diagnostics: Receives `QUEUE_READ_FAILED` when a store cannot be read or was truncated.
    public init(url: URL, diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)) {
        self.url = url
        self.diagnostics = diagnostics
        queue = DispatchQueue(label: "com.voidhash.sdk.record-store.\(url.lastPathComponent)")
    }

    /// Store for `name` under `Application Support/voidhash/<namespace>/`.
    ///
    /// Returns `nil` when no such directory can be resolved, letting the caller fall back to a
    /// cache-adapter backed store rather than silently losing durability.
    public static func applicationSupport(
        namespace: String,
        name: String,
        diagnostics: DiagnosticEmitter = DiagnosticEmitter(nil)
    ) -> FileRecordStore? {
        guard
            let base = FileManager.default.urls(
                for: .applicationSupportDirectory, in: .userDomainMask
            ).first
        else {
            return nil
        }
        // The directory is created by the first write, off the caller's thread: this runs on the
        // client's init path, which may be the main thread.
        let directory = base.appendingPathComponent("voidhash/\(namespace)", isDirectory: true)
        return FileRecordStore(
            url: directory.appendingPathComponent("\(name).ndjson"), diagnostics: diagnostics)
    }

    public func load() async -> RecordStoreLoad {
        return await run {
            guard FileManager.default.fileExists(atPath: self.url.path) else {
                // No file is the ordinary empty case, not a failure.
                return RecordStoreLoad(lines: [])
            }
            let data: Data
            do {
                data = try Data(contentsOf: self.url)
            } catch {
                self.diagnostics.emit(
                    .cache, code: "QUEUE_READ_FAILED", operation: "queue.load",
                    message:
                        "Could not read \(self.url.lastPathComponent): \(error.localizedDescription)"
                )
                return RecordStoreLoad(lines: [], readFailed: true)
            }

            let text = String(decoding: data, as: UTF8.self)
            var lines = text.split(separator: "\n", omittingEmptySubsequences: true).map(
                String.init)

            // A file that does not end in a newline was cut short mid-append: the last record is
            // incomplete and would decode into garbage, so it is dropped and reported.
            let droppedPartial = !data.isEmpty && data.last != 0x0A
            if droppedPartial {
                if !lines.isEmpty {
                    lines.removeLast()
                }
                _ = self.repairPartialTail(data)
            }
            return RecordStoreLoad(lines: lines, droppedPartialRecord: droppedPartial)
        }
    }

    @discardableResult
    public func append(_ lines: [String]) async -> Bool {
        guard !lines.isEmpty else {
            return true
        }
        let payload = Data((lines.joined(separator: "\n") + "\n").utf8)
        return await run {
            guard self.repairPartialTailIfNeeded() else {
                return false
            }
            guard let handle = try? FileHandle(forWritingTo: self.url) else {
                return self.writeWholeFile(payload)
            }
            defer { try? handle.close() }
            do {
                try handle.seekToEnd()
                try handle.write(contentsOf: payload)
                // Without the sync the records live in the page cache; a kill loses exactly the
                // events the persistent queue exists to protect.
                try handle.synchronize()
                return true
            } catch {
                self.diagnostics.emit(
                    .cache, code: "QUEUE_WRITE_FAILED", operation: "queue.append",
                    message:
                        "Could not append to \(self.url.lastPathComponent): \(error.localizedDescription)"
                )
                return false
            }
        }
    }

    public func replace(with lines: [String]) async {
        await run {
            guard !lines.isEmpty else {
                try? FileManager.default.removeItem(at: self.url)
                return
            }
            // `.atomic` writes a temporary file and renames it, so a crash mid-compaction leaves
            // the previous complete queue rather than a half-written one.
            self.writeWholeFile(Data((lines.joined(separator: "\n") + "\n").utf8))
        }
    }

    public func clear() async {
        await run {
            try? FileManager.default.removeItem(at: self.url)
        }
    }

    @discardableResult
    private func writeWholeFile(_ payload: Data) -> Bool {
        do {
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try payload.write(to: url, options: .atomic)
            return true
        } catch {
            diagnostics.emit(
                .cache, code: "QUEUE_WRITE_FAILED", operation: "queue.write",
                message: "Could not write \(url.lastPathComponent): \(error.localizedDescription)")
            return false
        }
    }

    // Only the last byte is inspected: reading the whole queue back on every coalesced append
    // would make each write cost as much as a full compaction. The file is read in full only
    // when that byte proves the tail is torn.
    private func repairPartialTailIfNeeded() -> Bool {
        guard FileManager.default.fileExists(atPath: url.path) else {
            return true
        }
        do {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let size = try handle.seekToEnd()
            guard size > 0 else {
                return true
            }
            try handle.seek(toOffset: size - 1)
            guard let last = try handle.read(upToCount: 1)?.first, last != 0x0A else {
                return true
            }
            try handle.seek(toOffset: 0)
            let data = try handle.readToEnd() ?? Data()
            return repairPartialTail(data)
        } catch {
            diagnostics.emit(
                .cache, code: "QUEUE_READ_FAILED", operation: "queue.repair",
                message: "Could not inspect \(url.lastPathComponent): \(error.localizedDescription)"
            )
            return false
        }
    }

    private func repairPartialTail(_ data: Data) -> Bool {
        guard !data.isEmpty, data.last != 0x0A else {
            return true
        }
        diagnostics.emit(
            .cache, code: "QUEUE_RECORD_TRUNCATED", operation: "queue.load",
            message: "Discarded a partially written record at the end of \(url.lastPathComponent)"
        )
        let complete = data.lastIndex(of: 0x0A).map { Data(data.prefix(through: $0)) } ?? Data()
        return writeWholeFile(complete)
    }

    private func run<Value: Sendable>(_ work: @escaping @Sendable () -> Value) async -> Value {
        return await withCheckedContinuation { continuation in
            queue.async {
                continuation.resume(returning: work())
            }
        }
    }
}

/// ``RecordStore`` backed by a ``CacheAdapter`` entry holding the whole NDJSON blob.
///
/// Used where no writable file system directory is available and by tests that want a queue that
/// survives a client instance without touching disk.
public actor CacheAdapterRecordStore: RecordStore {
    private let adapter: any CacheAdapter
    private let key: String
    // The adapter read suspends the actor, so two appends racing through `load` would each
    // extend the same snapshot and the second write would drop the first's lines. The lines are
    // read once and every mutation happens on the in-memory copy before its write is issued.
    private var lines: [String]?
    private var loadTask: Task<[String], Never>?

    public init(adapter: any CacheAdapter, key: String) {
        self.adapter = adapter
        self.key = key
    }

    public func load() async -> RecordStoreLoad {
        return RecordStoreLoad(lines: await currentLines())
    }

    @discardableResult
    public func append(_ newLines: [String]) async -> Bool {
        guard !newLines.isEmpty else {
            return true
        }
        let merged = await currentLines() + newLines
        lines = merged
        await adapter.set(key, value: merged.joined(separator: "\n"))
        return true
    }

    public func replace(with newLines: [String]) async {
        lines = newLines
        guard !newLines.isEmpty else {
            await adapter.delete(key)
            return
        }
        await adapter.set(key, value: newLines.joined(separator: "\n"))
    }

    public func clear() async {
        lines = []
        await adapter.delete(key)
    }

    private func currentLines() async -> [String] {
        if let lines {
            return lines
        }
        let task =
            loadTask
            ?? Task { [adapter, key] in
                guard let raw = await adapter.get(key) else {
                    return [String]()
                }
                return raw.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
            }
        loadTask = task
        let loaded = await task.value
        // Whichever awaiter resumes first seeds the in-memory copy; the others find it set.
        if lines == nil {
            lines = loaded
        }
        loadTask = nil
        return lines ?? loaded
    }
}

/// ``RecordStore`` that keeps everything in memory.
public actor InMemoryRecordStore: RecordStore {
    private var lines: [String] = []

    public init() {}

    public func load() async -> RecordStoreLoad {
        return RecordStoreLoad(lines: lines)
    }

    @discardableResult
    public func append(_ newLines: [String]) async -> Bool {
        lines.append(contentsOf: newLines)
        return true
    }

    public func replace(with newLines: [String]) async {
        lines = newLines
    }

    public func clear() async {
        lines = []
    }
}
