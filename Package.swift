// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "TokenBar",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .executable(name: "TokenBar", targets: ["TokenBar"]),
        .library(name: "TokenBarCore", targets: ["TokenBarCore"]),
    ],
    targets: [
        .target(
            name: "TokenBarCore",
            path: "Sources/TokenBarCore",
            linkerSettings: [
                .linkedLibrary("sqlite3"),
            ]),
        .executableTarget(
            name: "TokenBar",
            dependencies: ["TokenBarCore"],
            path: "Sources/TokenBar",
            resources: [
                .process("Resources"),
            ]),
        .testTarget(
            name: "TokenBarCoreTests",
            dependencies: ["TokenBarCore"],
            path: "Tests/TokenBarCoreTests",
            linkerSettings: [
                .linkedLibrary("sqlite3"),
            ]),
    ])
