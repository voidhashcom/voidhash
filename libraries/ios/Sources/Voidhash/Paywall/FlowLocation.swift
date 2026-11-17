import Foundation

#if canImport(UIKit)
    import UIKit
#endif

// The typed layer over `presentFlow(location:revision:input:actions:)`. Code generated for a
// location declares its input, output, outcome and action types with these conversions, and a
// `FlowLocation` naming the slug and the interface revision it was generated from.

/// The inputs an app passes to the flow at a location.
public protocol FlowInput: Sendable {
    /// The inputs by name, as the flow receives them.
    var flowValues: [String: FlowValue] { get }
}

/// The outputs an app reads back from the flow at a location.
public protocol FlowOutput: Sendable {
    /// Reads the outputs a flow reported. An output that is missing or of another type takes
    /// its declared default.
    init(flowValues: [String: FlowValue])
}

/// The ways the flow at a location can end.
public protocol FlowOutcome: Sendable {
    /// Reads an outcome by name. A name the type does not know, which a flow newer than the
    /// app can end with, must still convert, for example into an `unknown(String)` case.
    init(flowOutcome: String)
}

/// The app actions the flow at a location can call.
public protocol FlowActions: Sendable {
    /// The handlers by action name.
    var flowHandlers: [String: FlowActionHandler] { get }
}

/// The input of a location that takes none.
public struct NoFlowInput: FlowInput {
    public init() {}

    public var flowValues: [String: FlowValue] {
        return [:]
    }
}

/// The output of a location that reports none.
public struct NoFlowOutput: FlowOutput, Equatable {
    public init() {}

    public init(flowValues: [String: FlowValue]) {}
}

/// The actions of a location whose flows call none.
public struct NoFlowActions: FlowActions {
    public init() {}

    public var flowHandlers: [String: FlowActionHandler] {
        return [:]
    }
}

/// A location in the app where a flow is shown, with the types of what the app and the flow
/// exchange there.
public struct FlowLocation<
    Input: FlowInput, Output: FlowOutput, Outcome: FlowOutcome, Actions: FlowActions
>: Sendable {
    /// The location's slug.
    public let slug: String
    /// The revision of the location's interface these types were generated from.
    public let revision: Int

    public init(slug: String, revision: Int) {
        self.slug = slug
        self.revision = revision
    }
}

/// How a flow presented at a ``FlowLocation`` ended, in the location's own types.
public struct TypedFlowResult<Output: FlowOutput, Outcome: FlowOutcome>: Sendable {
    public let outcome: Outcome
    public let output: Output
    /// The product bought, when a purchase ended the flow.
    public let productId: String?

    public init(outcome: Outcome, output: Output, productId: String?) {
        self.outcome = outcome
        self.output = output
        self.productId = productId
    }
}

extension TypedFlowResult: Equatable where Output: Equatable, Outcome: Equatable {}

extension VoidhashClient {
    /// Presents the flow assigned to `location` with typed inputs and action handlers, and
    /// returns how it ended in the location's types.
    ///
    /// Behaves as ``presentFlow(location:revision:input:actions:)`` does, called with the
    /// location's slug and revision.
    ///
    /// - Throws: ``FlowError`` when the flow could not be presented.
    public func presentFlow<
        Input: FlowInput, Output: FlowOutput, Outcome: FlowOutcome, Actions: FlowActions
    >(
        _ location: FlowLocation<Input, Output, Outcome, Actions>, input: Input, actions: Actions
    ) async throws -> TypedFlowResult<Output, Outcome> {
        let result = try await presentFlow(
            location: location.slug, revision: location.revision, input: input.flowValues,
            actions: actions.flowHandlers)
        return TypedFlowResult(
            outcome: Outcome(flowOutcome: result.outcome),
            output: Output(flowValues: result.output), productId: result.productId)
    }

    #if canImport(UIKit)
        /// Presents the flow assigned to `location` from `viewController`, or from the top view
        /// controller of the key window when it is `nil`, with typed inputs and action handlers.
        ///
        /// - Throws: ``FlowError`` when the flow could not be presented.
        public func presentFlow<
            Input: FlowInput, Output: FlowOutput, Outcome: FlowOutcome, Actions: FlowActions
        >(
            _ location: FlowLocation<Input, Output, Outcome, Actions>, input: Input,
            actions: Actions, from viewController: UIViewController?
        ) async throws -> TypedFlowResult<Output, Outcome> {
            let result = try await presentFlow(
                location: location.slug, revision: location.revision, input: input.flowValues,
                actions: actions.flowHandlers, from: viewController)
            return TypedFlowResult(
                outcome: Outcome(flowOutcome: result.outcome),
                output: Output(flowValues: result.output), productId: result.productId)
        }
    #endif
}
