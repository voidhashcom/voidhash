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
                "HybridMeasurement.swift",
                "HybridNotifications.swift",
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
            sources: [
                "TransactionRetentionStore.swift",
                "measurement/ConversionValueEngine.swift",
                "measurement/AppleIdentifierPolicy.swift",
                "measurement/AppleSystemIdentifiers.swift",
                "measurement/MeasurementStore.swift",
                "measurement/MeasurementDelivery.swift",
                "measurement/LinkCollector.swift",
                "measurement/PushCollector.swift",
            ],
            linkerSettings: [
                .linkedLibrary("sqlite3"),
                .linkedFramework("Security"),
                .linkedFramework("CryptoKit"),
            ]
        ),
        .testTarget(
            name: "VoidhashPurchaseCoordinatorTests",
            dependencies: ["VoidhashPurchaseCoordinators"],
            path: "ios-tests"
        ),
    ]
)
