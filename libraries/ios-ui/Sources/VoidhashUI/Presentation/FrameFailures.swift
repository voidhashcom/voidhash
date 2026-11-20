/// Tells a flow whose frames keep failing from one that lost a single frame.
///
/// One failed frame can be transient: the next one draws again. A flow whose frames keep
/// failing shows nothing new and takes no input, its own close control included, so it has to be
/// taken down for the user.
package struct FrameFailures {
    /// Failed frames in a row after which the flow counts as failed.
    package static let limit = 3

    private var inARow = 0

    package init() {}

    /// Whether the flow counts as failed.
    package var reachedLimit: Bool {
        return inARow >= FrameFailures.limit
    }

    /// Records a failed frame; `true` for the frame that makes the flow count as failed.
    package mutating func frameFailed() -> Bool {
        inARow += 1
        return inARow == FrameFailures.limit
    }

    /// Records a frame that was drawn, which starts the count again.
    package mutating func frameSucceeded() {
        inARow = 0
    }
}
