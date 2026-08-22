import Foundation

/// The names Nimbus shares with every other Voidhash example and with the dashboard.
///
/// Changing one of these means changing it in Studio too — perks, products, locations and
/// flags are matched by slug.
enum Nimbus {
    /// Perk that unlocks unlimited notes and export.
    static let perkSlug = "pro"
    /// Location whose assigned paywall the Notes screen presents.
    static let paywallLocation = "onboarding"
    /// Flag read on the Account screen.
    static let featureFlagKey = "nimbus-new-onboarding"
    /// How many notes a free account keeps.
    static let freeNoteLimit = 3
}

/// Reads the publishable key that `Config/Nimbus.xcconfig` bakes into `Info.plist`.
enum NimbusConfiguration {
    /// The configured publishable key, or `nil` while the placeholder is still in place.
    static let publishableKey: String? = {
        let raw = Bundle.main.object(forInfoDictionaryKey: "VoidhashPublishableKey") as? String
        let key = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !key.isEmpty, key != "vh_pk_replace_me" else {
            return nil
        }
        return key
    }()
}
