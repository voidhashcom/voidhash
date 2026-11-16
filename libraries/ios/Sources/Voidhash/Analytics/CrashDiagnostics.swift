import Foundation

#if os(iOS) && canImport(MetricKit)
    import MetricKit
#endif

/// A crash the operating system recorded for this app.
///
/// Holds when it happened and the release it happened in, and nothing else: a report's stack,
/// thread and exception data can hold private data and is never read.
struct CrashDiagnostic: Sendable, Equatable {
    /// End of the report's time window, in epoch milliseconds.
    let occurredAt: Double
    /// The app version the report names.
    let appVersion: String
}

/// Handle returned by ``CrashDiagnosticObserving/subscribe(_:)``; cancelling stops the deliveries.
protocol CrashDiagnosticSubscription: Sendable {
    func cancel()
}

/// Source of the crash reports the operating system delivers, injectable so tests can drive it.
///
/// The operating system records crashes itself: nothing here installs a signal or exception
/// handler in the app, which would conflict with its crash reporters.
protocol CrashDiagnosticObserving: Sendable {
    func subscribe(_ handler: @escaping @Sendable ([CrashDiagnostic]) -> Void)
        -> any CrashDiagnosticSubscription
}

/// Observer that never reports anything: where the platform has no MetricKit crash reports.
struct NoopCrashDiagnosticObserver: CrashDiagnosticObserving {
    private struct Subscription: CrashDiagnosticSubscription {
        func cancel() {}
    }

    func subscribe(_ handler: @escaping @Sendable ([CrashDiagnostic]) -> Void)
        -> any CrashDiagnosticSubscription
    {
        return Subscription()
    }
}

#if os(iOS) && canImport(MetricKit)
    /// Reads crash reports from MetricKit, which delivers them at a later launch.
    struct MetricKitCrashDiagnosticObserver: CrashDiagnosticObserving {
        /// What MetricKit reports to.
        ///
        /// Reaching `MXMetricManager` is not free, so subscribing and cancelling happen on a queue
        /// of their own, in order, and never on the caller's thread.
        private final class Subscriber: NSObject, MXMetricManagerSubscriber,
            CrashDiagnosticSubscription, @unchecked Sendable
        {
            private static let queue = DispatchQueue(
                label: "com.voidhash.metrickit", qos: .utility)
            private let handler: @Sendable ([CrashDiagnostic]) -> Void

            init(handler: @escaping @Sendable ([CrashDiagnostic]) -> Void) {
                self.handler = handler
                super.init()
                Subscriber.queue.async { MXMetricManager.shared.add(self) }
            }

            func cancel() {
                Subscriber.queue.async { MXMetricManager.shared.remove(self) }
            }

            func didReceive(_ payloads: [MXDiagnosticPayload]) {
                let crashes = payloads.flatMap { payload in
                    (payload.crashDiagnostics ?? []).map { crash in
                        CrashDiagnostic(
                            occurredAt: payload.timeStampEnd.timeIntervalSince1970 * 1000,
                            appVersion: crash.applicationVersion)
                    }
                }
                if !crashes.isEmpty {
                    handler(crashes)
                }
            }
        }

        func subscribe(_ handler: @escaping @Sendable ([CrashDiagnostic]) -> Void)
            -> any CrashDiagnosticSubscription
        {
            return Subscriber(handler: handler)
        }
    }
#endif
