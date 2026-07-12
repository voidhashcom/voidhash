// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "VoidhashPurchaseCoordinators",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "VoidhashPurchaseCoordinators", targets: ["VoidhashPurchaseCoordinators"])
    ],
    targets: [
        .target(
            name: "VoidhashPurchaseCoordinators",
            path: "ios",
            exclude: [
                "HybridPaywallPresenter.swift",
                "HybridPaywallWebView.swift",
                "HybridPurchasedItem.swift",
                "HybridStorekit.swift",
                "HybridStorekitProduct.swift",
                "HybridStorekitProductOffer.swift",
                "HybridStorekitProductSubscription.swift",
                "HybridStorekitProductSubscriptionPeriod.swift",
                "HybridStorekitTransaction.swift",
                "HybridVoidhash.swift",
                "ProductStore.swift",
            ],
            sources: ["TransactionRetentionStore.swift"]
        ),
        .testTarget(
            name: "VoidhashPurchaseCoordinatorTests",
            dependencies: ["VoidhashPurchaseCoordinators"],
            path: "ios-tests"
        ),
    ]
)
