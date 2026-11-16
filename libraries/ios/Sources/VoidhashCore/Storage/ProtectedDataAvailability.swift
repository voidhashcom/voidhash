import Foundation

#if canImport(UIKit)
    import UIKit
#endif

/// Whether the SDK's persisted state can be read.
///
/// Until the first unlock after a reboot, files protected until first user authentication cannot
/// be read, and `UserDefaults` answers `nil` for every key instead of failing. An app launched in
/// the background in that window (a VoIP push, a location or Bluetooth relaunch, prewarming)
/// would otherwise take its unreadable identity for a fresh install. In an app whose data
/// protection is Complete the defaults answer the same way whenever the device is locked. Callers
/// check before loading persisted state and write nothing while it is unavailable.
public protocol ProtectedDataAvailability: Sendable {
    /// Whether persisted state is known to be readable right now. Answers at once and without
    /// the main actor, so `false` also stands for "cannot tell yet":
    /// ``waitUntilAvailable()`` finds out.
    func isAvailable() async -> Bool
    /// Returns once persisted state can be read, immediately when it already can, or early when
    /// the calling task is cancelled.
    func waitUntilAvailable() async
}

/// ``ProtectedDataAvailability`` of the running process.
///
/// Persisted state counts as readable when both stores the SDK keeps it in can be read: its files,
/// through a probe file protected until first user authentication, and `UserDefaults`, through a
/// marker written there. The application's flag alone is too strict: it turns false whenever the
/// device locks, while state protected until first authentication stays readable after the first
/// unlock. The probe alone is too lax: in an app whose data protection is Complete, the defaults
/// answer `nil` for every key whenever the device is locked, while the probe still reads.
///
/// A readable probe without a marker means either defaults that cannot be read or defaults that
/// are empty (the host cleared them, or an earlier release of the SDK wrote no marker). State an
/// earlier release stored there proves them readable. Otherwise a second probe file, under
/// complete protection, tells the two apart: it can be created and read exactly while the device
/// is unlocked, which is when the defaults read too. So when it reads, or can be written and
/// then reads, the defaults are empty and the marker is written again. The same settles the
/// first launch of an install, where there is no probe yet: the device is unlocked, so there is
/// state to read, only none stored, and the probe and the marker are written. A write while the
/// device is locked fails and is tried again at the next check.
///
/// A probe that exists and cannot be read settles it the other way: the device is locked, and
/// the state is not readable.
///
/// What is left is a device on which the second probe is missing and cannot be created, which
/// is a locked one. Only the application's flag tells whether its defaults read, and that flag
/// is only read on the main actor, which a host may be blocking while it waits on the SDK. So
/// ``isAvailable()`` never asks: it answers "not readable yet", and ``waitUntilAvailable()``
/// asks the application off its own task and takes the answer when it arrives. A Mac never
/// keeps a running app's files from it and cannot create the second probe either, so there the
/// same state counts as readable.
///
/// A process that found its defaults unreadable may keep seeing them empty after the unlock,
/// from the system's cache of them. Before it concludes that they hold nothing, it has them
/// read again from disk.
///
/// App extensions, which have no application, take a readable or missing probe as readable
/// state, as they always did, and write neither probe.
///
/// A wait ends on `protectedDataDidBecomeAvailableNotification`, and re-checks every
/// ``pollIntervalSeconds`` for processes that never receive the notification.
public final class SystemProtectedDataAvailability: ProtectedDataAvailability {
    /// Interval between re-checks while waiting for availability.
    public static let pollIntervalSeconds: UInt64 = 15

    /// `Application Support/voidhash/protected-data-probe`, next to the SDK's queue files.
    public static let defaultProbeUrl: URL? = FileManager.default.urls(
        for: .applicationSupportDirectory, in: .userDomainMask
    ).first?.appendingPathComponent("voidhash/protected-data-probe")

    private enum ProbeState {
        case missing
        case readable
        case unreadable
    }

    /// `UserDefaults` key written once the defaults were known to be readable. Outside the
    /// per-key namespaces of ``CacheNamespace`` and of the pre-namespace layout, so neither the
    /// cache nor its migration ever lists it.
    public static let defaultsMarkerKey = "vh:protected-data-probe"

    private let probeUrl: URL?
    private let unlockedProbeUrl: URL?
    private let unlockedProbeProtection: Data.WritingOptions
    // `UserDefaults` is thread-safe but not annotated `Sendable`.
    private nonisolated(unsafe) let defaults: UserDefaults?
    private let applicationProtectedData: (@Sendable () async -> Bool?)?
    private let hasDataProtection: Bool
    /// Whether this process has found its state unreadable, or could not tell, at least once.
    private let foundUnreadable = AtomicBool(false)

    private enum Readability {
        case readable
        /// A probe exists and cannot be read: the device is locked.
        case locked
        /// Nothing on disk tells; the application's flag would.
        case unknown
    }

    /// - Parameters:
    ///   - probeUrl: The probe file, protected until first user authentication. The probe under
    ///     complete protection is kept next to it, as `<name>-unlocked`.
    ///   - defaults: The defaults the SDK keeps its state in; `nil` trusts the probe alone.
    public convenience init(
        probeUrl: URL? = SystemProtectedDataAvailability.defaultProbeUrl,
        defaults: UserDefaults? = .standard
    ) {
        var applicationProtectedData: (@Sendable () async -> Bool?)?
        #if canImport(UIKit)
            if !ExtensionSafeApplication.isAppExtension {
                applicationProtectedData = {
                    await MainActor.run {
                        ExtensionSafeApplication.shared?.isProtectedDataAvailable
                    }
                }
            }
        #endif
        #if targetEnvironment(macCatalyst)
            let hasDataProtection = false
        #else
            let hasDataProtection = !ProcessInfo.processInfo.isiOSAppOnMac
        #endif
        self.init(
            probeUrl: probeUrl,
            unlockedProbeUrl: probeUrl.map {
                $0.deletingLastPathComponent()
                    .appendingPathComponent($0.lastPathComponent + "-unlocked")
            },
            defaults: defaults,
            hasDataProtection: hasDataProtection,
            applicationProtectedData: applicationProtectedData)
    }

    /// - Parameters:
    ///   - unlockedProbeUrl: The probe file under complete protection; `nil` keeps none, which
    ///     leaves defaults that answer nothing to the application.
    ///   - unlockedProbeProtection: The protection that probe is written with. Tests on a host
    ///     that refuses to create a file under complete protection pass none.
    ///   - hasDataProtection: Whether the platform locks an app's files away with the device;
    ///     `false` on a Mac, where a second probe that cannot be created says nothing.
    ///   - applicationProtectedData: Reads the application's `isProtectedDataAvailable`, which
    ///     answers `nil` when it finds no application. `nil` in a process that has none to ask,
    ///     an app extension.
    init(
        probeUrl: URL?, unlockedProbeUrl: URL?,
        unlockedProbeProtection: Data.WritingOptions = .completeFileProtection,
        defaults: UserDefaults?,
        hasDataProtection: Bool = true,
        applicationProtectedData: (@Sendable () async -> Bool?)?
    ) {
        self.hasDataProtection = hasDataProtection
        self.probeUrl = probeUrl
        self.unlockedProbeUrl = unlockedProbeUrl
        self.unlockedProbeProtection = unlockedProbeProtection
        self.defaults = defaults
        self.applicationProtectedData = applicationProtectedData
    }

    // Never asks the application, whose flag is only read on the main actor: a host that blocks
    // the main thread while it waits on the SDK must get an answer, whatever state the device is
    // in. What the files do not tell is "not readable yet", and the wait finds out.
    public func isAvailable() async -> Bool {
        guard readability() == .readable else {
            foundUnreadable.value = true
            return false
        }
        return true
    }

    public func waitUntilAvailable() async {
        let (wakeUps, continuation) = AsyncStream<Void>.makeStream(
            bufferingPolicy: .bufferingNewest(1))
        #if canImport(UIKit)
            let observer = NotificationCenter.default.addObserver(
                forName: UIApplication.protectedDataDidBecomeAvailableNotification, object: nil,
                queue: nil
            ) { _ in continuation.yield() }
        #endif
        let ticker = Task {
            while !Task.isCancelled {
                try? await Task.sleep(
                    nanoseconds: SystemProtectedDataAvailability.pollIntervalSeconds
                        * 1_000_000_000)
                continuation.yield()
            }
        }
        defer {
            #if canImport(UIKit)
                NotificationCenter.default.removeObserver(observer)
            #endif
            ticker.cancel()
            continuation.finish()
        }

        let application = ApplicationAnswer()
        var wakeUp = wakeUps.makeAsyncIterator()
        while !Task.isCancelled {
            switch readability() {
            case .readable:
                return
            case .locked:
                break
            case .unknown:
                switch application.take() {
                case .available:
                    markReadable()
                    return
                case .noApplication:
                    // Nothing to ask after all: as in an extension, a probe that is not locked
                    // is readable state.
                    return
                case .unavailable:
                    break
                case nil:
                    // Asked on a task of its own, which a blocked main thread holds up instead
                    // of this wait: the answer arrives as a wake-up, and so does a cancellation.
                    if let applicationProtectedData {
                        application.ask(applicationProtectedData) { continuation.yield() }
                    }
                }
            }
            foundUnreadable.value = true
            guard await wakeUp.next() != nil else {
                return
            }
        }
    }

    /// What the probes and the defaults tell about the state, without the application.
    private func readability() -> Readability {
        let probe = probeState(probeUrl)
        if probe == .readable, defaultsAreReadable() {
            writeUnlockedProbeIfMissing()
            return .readable
        }
        if probe == .unreadable {
            return .locked
        }
        guard applicationProtectedData != nil else {
            return .readable
        }
        // Nothing proves the state readable yet: a first launch, or defaults that answer
        // nothing. On an unlocked device both mean there is nothing stored, not nothing to read.
        writeUnlockedProbeIfMissing()
        switch probeState(unlockedProbeUrl) {
        case .readable:
            // Defaults this process once found locked can still answer from the cache of that
            // time. Read again from disk, they show the marker when there is state after all.
            if foundUnreadable.value, let defaults {
                defaults.synchronize()
                if defaultsAreReadable() {
                    writeProbeIfMissing()
                    return .readable
                }
            }
            markReadable()
            return .readable
        case .unreadable:
            return .locked
        case .missing:
            guard hasDataProtection else {
                markReadable()
                return .readable
            }
            return .unknown
        }
    }

    /// Records that the state reads: the first probe, and the marker in defaults that hold
    /// nothing of the SDK's.
    private func markReadable() {
        writeProbeIfMissing()
        writeUnlockedProbeIfMissing()
        defaults?.set("1", forKey: SystemProtectedDataAvailability.defaultsMarkerKey)
    }

    // Metadata stays readable while contents are protected, so an existing file that cannot be
    // read is the locked case rather than a missing one.
    private func probeState(_ url: URL?) -> ProbeState {
        guard let url, FileManager.default.fileExists(atPath: url.path) else {
            return .missing
        }
        return (try? Data(contentsOf: url)) == nil ? .unreadable : .readable
    }

    /// Whether the defaults hold the marker, or state of an earlier release that wrote none: a
    /// store that answers for one key is not locked.
    private func defaultsAreReadable() -> Bool {
        guard let defaults else {
            return true
        }
        if defaults.object(forKey: SystemProtectedDataAvailability.defaultsMarkerKey) != nil {
            return true
        }
        let holdsSdkState = defaults.dictionaryRepresentation().keys.contains {
            $0.hasPrefix("vh:") || $0.hasPrefix(CacheMigration.legacyKeyPrefix)
        }
        if holdsSdkState {
            defaults.set("1", forKey: SystemProtectedDataAvailability.defaultsMarkerKey)
        }
        return holdsSdkState
    }

    private func writeProbeIfMissing() {
        guard let probeUrl, !FileManager.default.fileExists(atPath: probeUrl.path) else {
            return
        }
        try? FileManager.default.createDirectory(
            at: probeUrl.deletingLastPathComponent(), withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        try? Data("1".utf8).write(
            to: probeUrl, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    // Who writes the file says nothing; that it reads is the evidence. While the device is locked
    // a file under complete protection cannot be created, and the next call tries again. Where
    // the platform refuses such a file altogether, the application keeps deciding.
    private func writeUnlockedProbeIfMissing() {
        guard let unlockedProbeUrl,
            !FileManager.default.fileExists(atPath: unlockedProbeUrl.path)
        else {
            return
        }
        try? FileManager.default.createDirectory(
            at: unlockedProbeUrl.deletingLastPathComponent(), withIntermediateDirectories: true,
            attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        try? Data("1".utf8).write(
            to: unlockedProbeUrl, options: unlockedProbeProtection.union(.atomic))
    }
}

/// The application's answer to whether protected data is available, asked for on a task of its
/// own and collected by the wait that asked.
private final class ApplicationAnswer: @unchecked Sendable {
    enum Answer {
        case available
        case unavailable
        case noApplication
    }

    private let lock = NSLock()
    private var isAsking = false
    private var answer: Answer?

    /// The answer that arrived since the last call, once.
    func take() -> Answer? {
        return lock.withLock {
            defer { answer = nil }
            return answer
        }
    }

    /// Asks `application`, unless an earlier question is still open, and calls `wake` when the
    /// answer is in.
    func ask(
        _ application: @escaping @Sendable () async -> Bool?,
        then wake: @escaping @Sendable () -> Void
    ) {
        let starts = lock.withLock { () -> Bool in
            guard !isAsking else {
                return false
            }
            isAsking = true
            return true
        }
        guard starts else {
            return
        }
        Task {
            let available = await application()
            lock.withLock {
                answer = available.map { $0 ? .available : .unavailable } ?? .noApplication
                isAsking = false
            }
            wake()
        }
    }
}
