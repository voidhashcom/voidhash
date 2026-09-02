import Foundation
import VoidhashCore

/// Integration that produced a screen view.
public enum ScreenSource: String, Sendable {
    case uikit
    case swiftui
    case manual
}

/// A screen the user arrived on, as reported by an integration or ``VoidhashClient/screen(_:properties:)``.
public struct ScreenView: Sendable, Equatable {
    /// Token identifying this screen instance; two views with the same identity are one screen.
    public var identity: String
    /// Stable, low-cardinality name (class name, route name).
    public var name: String
    /// Concrete location; equals `name` when there is nothing more specific.
    public var path: String
    /// Human title when the platform exposes one.
    public var title: String?
    /// Screen params, only captured with ``ScreenTrackingOptions/includeParams``.
    public var params: [String: JSONValue]
    /// Integration that produced the view.
    public var source: ScreenSource

    public init(
        identity: String,
        name: String,
        path: String? = nil,
        title: String? = nil,
        params: [String: JSONValue] = [:],
        source: ScreenSource
    ) {
        self.identity = identity
        self.name = name
        self.path = path ?? name
        self.title = title
        self.params = params
        self.source = source
    }
}

/// Configuration of the built-in `$screen` event.
public struct ScreenTrackingOptions: Sendable {
    /// Swizzles `UIViewController.viewDidAppear(_:)` to capture screens without app code.
    public var automatic: Bool
    /// Adds `$screen_params` to every `$screen` event. Off by default because params routinely
    /// carry ids and tokens.
    public var includeParams: Bool
    /// Rewrites or drops a screen before it is captured. Return `nil` to skip it.
    public var mapScreen: (@Sendable (ScreenView) -> ScreenView?)?

    public init(
        automatic: Bool = true,
        includeParams: Bool = false,
        mapScreen: (@Sendable (ScreenView) -> ScreenView?)? = nil
    ) {
        self.automatic = automatic
        self.includeParams = includeParams
        self.mapScreen = mapScreen
    }
}

/// The `$screen` state machine: dedupes on identity, remembers the previous screen and turns a
/// ``ScreenView`` into the event's properties.
///
/// Pure so the UIKit, SwiftUI and manual integrations stay thin and the logic is testable
/// without a view hierarchy.
struct ScreenTracker: Sendable {
    /// Upper bound of `$screen_name` and `$screen_path`.
    static let maxNameLength = 200
    /// Upper bound of `$screen_params` keys.
    static let maxParamCount = 20

    struct Current: Sendable, Equatable {
        let identity: String
        let name: String
        let path: String
        let arrivedAt: Double
    }

    let options: ScreenTrackingOptions
    private(set) var current: Current?
    /// Set once a SwiftUI screen fired, so hosting controllers stop counting as screens.
    private(set) var hasSwiftUIScreen = false

    init(options: ScreenTrackingOptions = ScreenTrackingOptions()) {
        self.options = options
    }

    /// Feeds a view through `mapScreen` and the identity dedupe; returns the `$screen`
    /// properties when an event should be captured.
    mutating func transition(_ view: ScreenView, now: Double) -> [String: JSONValue]? {
        let mapped = options.mapScreen.map { $0(view) } ?? view
        guard let view = mapped else {
            return nil
        }
        if current?.identity == view.identity {
            return nil
        }
        if view.source == .swiftui {
            hasSwiftUIScreen = true
        }

        let name = ScreenTracker.truncate(view.name)
        let path = ScreenTracker.truncate(view.path)
        var properties: [String: JSONValue] = [
            ScreenProperties.name: .string(name),
            ScreenProperties.path: .string(path),
            ScreenProperties.source: .string(view.source.rawValue),
            ScreenProperties.previousName: current.map { .string($0.name) } ?? .null,
            ScreenProperties.previousPath: current.map { .string($0.path) } ?? .null,
            ScreenProperties.previousDurationMs: current.map {
                .number(max(now - $0.arrivedAt, 0).rounded(.down))
            } ?? .null,
        ]
        if let title = view.title, !title.isEmpty {
            properties[ScreenProperties.title] = .string(title)
        }
        if options.includeParams, !view.params.isEmpty {
            properties[ScreenProperties.params] = .object(ScreenTracker.coerceParams(view.params))
        }

        current = Current(identity: view.identity, name: name, path: path, arrivedAt: now)
        return properties
    }

    static func truncate(_ value: String) -> String {
        guard value.count > maxNameLength else {
            return value
        }
        return String(value.prefix(maxNameLength))
    }

    /// String-coerces every param and keeps the first `maxParamCount` keys in sorted order,
    /// so the cut is deterministic.
    static func coerceParams(_ params: [String: JSONValue]) -> [String: JSONValue] {
        var result: [String: JSONValue] = [:]
        for key in params.keys.sorted().prefix(maxParamCount) {
            result[key] = .string(stringValue(params[key] ?? .null))
        }
        return result
    }

    private static func stringValue(_ value: JSONValue) -> String {
        switch value {
        case .string(let string):
            return string
        case .number(let number):
            return number == number.rounded() && abs(number) < 1e15
                ? String(Int64(number)) : String(number)
        case .bool(let bool):
            return bool ? "true" : "false"
        case .null:
            return ""
        case .array, .object:
            guard let data = try? JSONEncoder().encode(value),
                let json = String(data: data, encoding: .utf8)
            else {
                return ""
            }
            return json
        }
    }
}
