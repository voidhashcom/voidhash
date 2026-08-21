import Foundation

#if canImport(os)
    import os
#endif

/// Sink for SDK diagnostics that would otherwise be swallowed.
///
/// The React Native SDK surfaces these through `console.warn` in every environment; the Swift SDK
/// routes them through one injectable handler so hosts can forward them to their own logger and
/// tests can assert on them. Handlers are called from arbitrary tasks and must be thread safe.
public typealias VoidhashWarningHandler = @Sendable (String) -> Void

/// Ready-made ``VoidhashWarningHandler`` implementations.
public enum VoidhashWarnings {
    /// Writes to the unified log — or to stdout where `os` is unavailable — prefixed `[voidhash]`.
    public static let standard: VoidhashWarningHandler = { message in
        #if canImport(os)
            logger.warning("[voidhash] \(message, privacy: .public)")
        #else
            print("[voidhash] \(message)")
        #endif
    }

    /// Drops every message.
    public static let ignore: VoidhashWarningHandler = { _ in }

    #if canImport(os)
        private static let logger = Logger(subsystem: "com.voidhash.sdk", category: "voidhash")
    #endif
}
