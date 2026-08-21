// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "Voidhash",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "VoidhashCore", targets: ["VoidhashCore"]),
        .library(name: "Voidhash", targets: ["Voidhash"]),
    ],
    targets: [
        .target(name: "VoidhashCore"),
        .target(name: "Voidhash", dependencies: ["VoidhashCore"]),
        .testTarget(
            name: "VoidhashCoreTests",
            dependencies: ["VoidhashCore"]
        ),
        .testTarget(
            name: "VoidhashTests",
            dependencies: ["Voidhash"]
        ),
    ]
)
