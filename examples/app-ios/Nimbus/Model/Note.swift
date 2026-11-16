import Foundation

/// A note. In-memory on purpose: this is an SDK example, not a persistence tutorial.
struct Note: Identifiable, Equatable {
    let id = UUID()
    var title: String
    var createdAt = Date()
}

/// The three tabs, so the model can move the user between them.
enum AppTab: Hashable {
    case notes
    case upgrade
    case account
}
