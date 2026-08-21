import Testing

/// Parent of every suite driving ``StubURLProtocol``.
///
/// The stub keeps its scripted responses and recorded requests in static storage, so the suites
/// nested in here have to run one at a time.
@Suite("Stubbed network", .serialized)
struct StubbedNetworkSuite {}
