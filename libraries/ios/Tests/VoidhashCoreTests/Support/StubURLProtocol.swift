import Foundation

/// A recorded outbound request, with the body already read off the stream.
struct RecordedRequest: @unchecked Sendable {
    let request: URLRequest
    let body: Data?

    var method: String? { request.httpMethod }
    var path: String? { request.url?.path }
    var headers: [String: String] { request.allHTTPHeaderFields ?? [:] }

    /// Case-insensitive header lookup — URLRequest canonicalises header name casing.
    func header(_ name: String) -> String? {
        return headers.first { $0.key.caseInsensitiveCompare(name) == .orderedSame }?.value
    }

    func jsonBody() -> [String: Any]? {
        guard let body else {
            return nil
        }
        return try? JSONSerialization.jsonObject(with: body) as? [String: Any]
    }
}

/// Canned response for a stubbed request.
struct StubResponse: Sendable {
    let statusCode: Int
    let body: String

    init(statusCode: Int = 200, body: String = "{}") {
        self.statusCode = statusCode
        self.body = body
    }
}

/// `URLProtocol` stub letting tests assert request shapes and serve canned responses.
final class StubURLProtocol: URLProtocol {
    private static let lock = NSLock()
    private nonisolated(unsafe) static var responses: [StubResponse] = []
    private nonisolated(unsafe) static var recorded: [RecordedRequest] = []
    private nonisolated(unsafe) static var failure: (any Error)?

    /// Builds a session routed through this stub, serving `responses` in order.
    static func makeSession(responses: [StubResponse], failure: (any Error)? = nil) -> URLSession {
        lock.lock()
        self.responses = responses
        self.failure = failure
        recorded = []
        lock.unlock()

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    /// Requests observed since the last ``makeSession(responses:failure:)`` call.
    static func recordedRequests() -> [RecordedRequest] {
        lock.lock()
        defer { lock.unlock() }
        return recorded
    }

    override class func canInit(with request: URLRequest) -> Bool {
        return true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }

    override func startLoading() {
        StubURLProtocol.lock.lock()
        StubURLProtocol.recorded.append(
            RecordedRequest(request: request, body: StubURLProtocol.bodyData(of: request)))
        let failure = StubURLProtocol.failure
        let response =
            StubURLProtocol.responses.isEmpty
            ? StubResponse() : StubURLProtocol.responses.removeFirst()
        StubURLProtocol.lock.unlock()

        if let failure {
            client?.urlProtocol(self, didFailWithError: failure)
            return
        }

        let httpResponse = HTTPURLResponse(
            url: request.url!,
            statusCode: response.statusCode,
            httpVersion: "HTTP/1.1",
            headerFields: ["content-type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: httpResponse, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data(response.body.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    // URLSession moves `httpBody` onto `httpBodyStream` before handing the request to a
    // protocol, so the stream has to be drained to see what was sent.
    private static func bodyData(of request: URLRequest) -> Data? {
        if let body = request.httpBody {
            return body
        }
        guard let stream = request.httpBodyStream else {
            return nil
        }

        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 1024
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 {
                break
            }
            data.append(buffer, count: read)
        }
        return data
    }
}
