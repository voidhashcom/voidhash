import Foundation
import SwiftUI
import Voidhash
import VoidhashCore

/// Owns the Voidhash client and everything the three screens render.
///
/// Every SDK call in Nimbus goes through this type, so the screens stay declarative and the
/// integration is readable in one file.
@MainActor
final class AppModel: ObservableObject {
    /// What the root view renders: the SDK's first round-trip either works or it does not.
    enum Phase: Equatable {
        case loading
        case ready
        case failed(String)
    }

    /// A one-line message shown above the tab bar.
    struct Notice: Identifiable, Equatable {
        enum Kind {
            case info
            case success
            case failure
        }

        let id = UUID()
        let kind: Kind
        let text: String
    }

    @Published private(set) var phase: Phase = .loading
    @Published private(set) var notes: [Note] = []
    @Published private(set) var notesCreated = 0
    @Published private(set) var person: SdkPerson?
    @Published private(set) var products: [VoidhashProduct] = []
    @Published private(set) var featureFlag: SdkFeatureFlagResult?
    @Published private(set) var distinctId = ""
    @Published private(set) var isWorking = false
    @Published private(set) var notice: Notice?
    @Published var selectedTab: AppTab = .notes

    private let client: VoidhashClient
    /// The strong reference the SDK deliberately does not keep. Released once the paywall
    /// reports that it was dismissed.
    private var paywallDelegate: PaywallEventRelay?

    init(publishableKey: String) {
        var options = VoidhashOptions()
        #if DEBUG
            options.debug = true
            // Development mode is honored in debug builds only. Purchases run against a mock
            // store and are recorded under the development environment, so a bare simulator
            // with no App Store Connect setup can complete one.
            options.dev = true
        #endif
        client = Voidhash.configure(publishableKey: publishableKey, options: options)
    }

    // MARK: - Derived state

    /// Whether the person holds an active `pro` grant. The only gate in the app.
    var isPro: Bool {
        guard let person else {
            return false
        }
        return person.entitlements.grants.contains {
            $0.perkId == Nimbus.perkSlug && $0.status == "active"
        }
    }

    /// Notes a free account may still create; `nil` for Pro, which is unlimited.
    var notesRemaining: Int? {
        isPro ? nil : max(0, Nimbus.freeNoteLimit - notes.count)
    }

    var planName: String {
        isPro ? "pro" : "free"
    }

    var isSignedIn: Bool {
        person?.email != nil || person?.name != nil
    }

    // MARK: - Loading

    /// Fetches everything the app needs, in parallel. A failure here is the whole app's
    /// failure — the root view renders it with a retry button.
    func load() async {
        phase = .loading
        notice = nil
        do {
            async let products = client.getProducts()
            async let person = client.getCurrentPerson()
            async let flags = client.getFeatureFlags([Nimbus.featureFlagKey])

            self.products = try await products
            self.person = try await person
            let resolvedFlags = try await flags
            featureFlag = resolvedFlags.first { $0.key == Nimbus.featureFlagKey }
            distinctId = await client.getDistinctId()
            phase = .ready
        } catch {
            phase = .failed(Self.describe(error))
        }
    }

    /// Re-reads the person snapshot, bypassing the cache. Called after anything that can
    /// change entitlements.
    func refreshPerson() async {
        do {
            person = try await client.getCurrentPerson(forceFetch: true)
            distinctId = await client.getDistinctId()
        } catch {
            notice = Notice(kind: .failure, text: Self.describe(error))
        }
    }

    /// Re-evaluates `nimbus-new-onboarding` for the current identity.
    func refreshFeatureFlag() async {
        do {
            let flags = try await client.getFeatureFlags([Nimbus.featureFlagKey])
            featureFlag = flags.first { $0.key == Nimbus.featureFlagKey }
        } catch {
            notice = Notice(kind: .failure, text: Self.describe(error))
        }
    }

    // MARK: - Notes

    /// Creates a note, or presents the paywall when a free account is at its limit.
    func createNote() async {
        guard isPro || notes.count < Nimbus.freeNoteLimit else {
            await presentUpgrade(reason: "note_limit")
            return
        }

        notesCreated += 1
        notes.append(Note(title: "Note \(notesCreated)"))
        await client.capture(
            "note_created",
            properties: [
                "note_count": .number(Double(notes.count)),
                "plan": .string(planName),
            ]
        )
        await syncPersonAttributes()
    }

    func deleteNote(_ note: Note) {
        notes.removeAll { $0.id == note.id }
    }

    /// Export is the Pro-only action. Free accounts get the `onboarding` paywall instead.
    func exportNotes() async {
        await client.capture(
            "export_requested",
            properties: [
                "note_count": .number(Double(notes.count)),
                "plan": .string(planName),
            ]
        )

        guard isPro else {
            await presentUpgrade(reason: "export")
            return
        }
        notice = Notice(kind: .success, text: "Exported \(notes.count) notes.")
    }

    // MARK: - Paywall

    /// Presents the paywall assigned to `onboarding`, falling back to the Upgrade tab when
    /// there is nothing to present.
    ///
    /// A brand new project has no published paywall, so `.notAssigned` is the *normal* first
    /// answer, not an error. Treating it as one is the most common way to ship an integration
    /// that looks broken on day one.
    func presentUpgrade(reason: String) async {
        await client.capture(
            "paywall_viewed",
            properties: [
                "location": .string(Nimbus.paywallLocation),
                "reason": .string(reason),
            ]
        )

        let relay = PaywallEventRelay { [weak self] event in
            Task { @MainActor in self?.handlePaywallEvent(event) }
        }
        paywallDelegate = relay

        do {
            let result = try await client.presentPaywall(
                location: Nimbus.paywallLocation, delegate: relay)
            switch result {
            case .shown:
                break
            case .notAssigned:
                fallBackToUpgradeTab(
                    "No paywall is published for “\(Nimbus.paywallLocation)” yet. "
                        + "Showing the app's own upgrade screen."
                )
            case .failed:
                fallBackToUpgradeTab(
                    "The paywall could not be presented. Showing the app's own upgrade screen.")
            }
        } catch {
            fallBackToUpgradeTab(Self.describe(error))
        }
    }

    private func fallBackToUpgradeTab(_ message: String) {
        paywallDelegate = nil
        notice = Notice(kind: .info, text: message)
        selectedTab = .upgrade
    }

    private func handlePaywallEvent(_ event: PaywallEventRelay.Event) {
        switch event {
        case .purchased(let productId):
            notice = Notice(kind: .success, text: "Purchased \(productId).")
            Task { await refreshPerson() }
        case .restored:
            notice = Notice(kind: .success, text: "Purchases restored.")
            Task { await refreshPerson() }
        case .failed(let message):
            notice = Notice(kind: .failure, text: message)
        case .dismissed:
            // The paywall is gone, so nothing can call the delegate any more.
            paywallDelegate = nil
            Task { await refreshPerson() }
        }
    }

    // MARK: - Purchases

    func purchase(_ product: VoidhashProduct) async {
        await client.capture(
            "checkout_started",
            properties: [
                "product_slug": .string(product.slug),
                "price": .number(product.price),
                "currency": .string(product.currency),
            ]
        )

        await run {
            try await self.client.purchase(product: product)
            await self.refreshPerson()
            return Notice(kind: .success, text: "\(product.name) is yours.")
        }
    }

    func restorePurchases() async {
        await run {
            try await self.client.restorePurchases()
            await self.refreshPerson()
            return Notice(
                kind: self.isPro ? .success : .info,
                text: self.isPro
                    ? "Pro restored." : "Nothing to restore for this Apple ID."
            )
        }
    }

    func redeemOfferCode() async {
        await run {
            try await self.client.presentCodeRedemptionSheet()
            return nil
        }
    }

    func manageSubscriptions() async {
        await run {
            try await self.client.showManageSubscriptions()
            return nil
        }
    }

    // MARK: - Identity

    func signIn(externalUserId: String, email: String, name: String) async {
        let userId = externalUserId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !userId.isEmpty else {
            notice = Notice(kind: .failure, text: "A user id is required to sign in.")
            return
        }

        await run {
            self.person = try await self.client.identify(
                externalUserId: userId,
                email: email.isEmpty ? nil : email,
                name: name.isEmpty ? nil : name
            )
            self.distinctId = await self.client.getDistinctId()
            await self.syncPersonAttributes()
            await self.refreshFeatureFlag()
            return Notice(kind: .success, text: "Signed in as \(userId).")
        }
    }

    /// Writes the two attributes every Nimbus example sets: `plan` and `notes_created`.
    func syncPersonAttributes() async {
        do {
            person = try await client.setPersonAttributes([
                "plan": .string(planName),
                "notes_created": .number(Double(notesCreated)),
            ])
        } catch {
            notice = Notice(kind: .failure, text: Self.describe(error))
        }
    }

    /// Signs out: flush what is queued, then drop the identity and every cached response.
    func signOut() async {
        await client.flush()
        await client.reset()
        person = nil
        notes.removeAll()
        notesCreated = 0
        distinctId = await client.getDistinctId()
        await refreshFeatureFlag()
        notice = Notice(kind: .info, text: "Signed out. A fresh anonymous id is in use.")
    }

    func flushAnalytics() async {
        await client.flush()
    }

    func dismissNotice() {
        notice = nil
    }

    // MARK: - Plumbing

    /// Runs an SDK call with the busy flag set, mapping failures onto a notice.
    ///
    /// `USER_CANCELLED` is not a failure: the customer closed a sheet, and telling them
    /// something went wrong is worse than saying nothing.
    private func run(_ operation: () async throws -> Notice?) async {
        isWorking = true
        defer { isWorking = false }

        do {
            if let notice = try await operation() {
                self.notice = notice
            }
        } catch let error as VoidhashStoreError {
            switch error.code {
            case "USER_CANCELLED":
                break
            case "PURCHASE_PENDING":
                notice = Notice(
                    kind: .info,
                    text: "The purchase is waiting for approval. It unlocks once it clears."
                )
            default:
                notice = Notice(kind: .failure, text: error.message)
            }
        } catch {
            notice = Notice(kind: .failure, text: Self.describe(error))
        }
    }

    /// Unwraps the error types the SDK raises into something worth showing a person.
    nonisolated static func describe(_ error: any Error) -> String {
        switch error {
        case let error as VoidhashStoreError:
            return error.message
        case let error as VoidhashApiError:
            return error.message
        case let error as FailedToFetchSchemaError:
            // The schema failure is a wrapper; the reason — a rejected key, no network —
            // is the error underneath it.
            return describe(error.underlying)
        default:
            return error.localizedDescription
        }
    }
}
