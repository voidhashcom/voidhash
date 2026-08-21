import Foundation
import Testing

@testable import VoidhashCore

@Suite("Paywall presenter core")
struct PaywallPresenterCoreTests {
    @Test("a blank or malformed html url does not resolve")
    func rejectsUnusableHtmlUrls() {
        #expect(PaywallHtmlUrl.parse("https://cdn.example.com/paywall.html") != nil)
        #expect(PaywallHtmlUrl.parse("") == nil)
        #expect(PaywallHtmlUrl.parse("   ") == nil)
        #expect(PaywallHtmlUrl.parse("https://cdn exa mple.com/paywall.html") == nil)
    }

    @Test("load failures describe themselves with a stable code")
    func loadFailureDescriptions() {
        let invalid = PaywallLoadFailure.invalidUrl(locationSlug: "onboarding", htmlUrl: "")
        #expect(invalid.description.hasPrefix("PAYWALL_INVALID_URL: "))
        #expect(invalid.description.contains("onboarding"))

        let navigation = PaywallLoadFailure.navigationFailed(
            locationSlug: "onboarding", message: "offline")
        #expect(navigation.description.hasPrefix("PAYWALL_LOAD_FAILED: "))
        #expect(navigation.description.contains("offline"))
    }

    #if canImport(UIKit)
        @MainActor
        @Test("an unusable html url is reported instead of silently loading nothing")
        func reportsInvalidHtmlUrlOnPreload() async throws {
            let failures = RecordedLoadFailures()
            let presenter = PaywallPresenterCore(onLoadFailed: { failures.record($0) })

            try await presenter.preload(locationSlug: "onboarding", htmlUrl: "   ")

            #expect(
                failures.values == [.invalidUrl(locationSlug: "onboarding", htmlUrl: "   ")])
            presenter.release(locationSlug: "onboarding")
        }
    #endif
}

/// Collects the failures a presenter reported.
final class RecordedLoadFailures: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [PaywallLoadFailure] = []

    var values: [PaywallLoadFailure] {
        return lock.withLock { storage }
    }

    func record(_ failure: PaywallLoadFailure) {
        lock.withLock { storage.append(failure) }
    }
}
