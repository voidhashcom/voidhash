/// Re-exports the shared native core so the Swift package target of this library (used by the
/// `ios-tests` suite, which cannot link the Nitro-generated sources) resolves core types such as
/// `TransactionRetentionStore` through `VoidhashPurchaseCoordinators`.
@_exported import VoidhashCore
