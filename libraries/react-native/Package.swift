// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "VoidhashPurchaseCoordinators",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "VoidhashPurchaseCoordinators", targets: ["VoidhashPurchaseCoordinators"])
    ],
    dependencies: [
        .package(path: "../ios")
    ],
    targets: [
        .target(
            name: "VoidhashPurchaseCoordinators",
            dependencies: [
                .product(name: "VoidhashCore", package: "ios")
            ],
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
            ],
            sources: ["VoidhashCoreExports.swift"]
        ),
        .testTarget(
            name: "VoidhashPurchaseCoordinatorTests",
            dependencies: [
                "VoidhashPurchaseCoordinators",
                .product(name: "VoidhashCore", package: "ios"),
            ],
            path: "ios-tests"
        ),
    ]
)
