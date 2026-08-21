import Foundation

/// Generic conformance runner shared by every suite: it fetches step
/// descriptors from the harness control plane, replays them verbatim over
/// URLSession, and asserts the final report passes. It never encodes fixture
/// data locally, so suites can evolve without touching this file.
public enum ConformanceRunner {
    struct StepDescriptor {
        let id: String
        let method: String
        let path: String
        let headers: [String: String]
        let requireHeaders: [String]
        let body: Any?
        let expectedStatus: Int
        let expectedBody: Any?

        static func from(json: [String: Any]) -> StepDescriptor? {
            guard let id = json["id"] as? String,
                let request = json["request"] as? [String: Any],
                let method = request["method"] as? String,
                let path = request["path"] as? String
            else { return nil }
            let responses = json["responses"] as? [[String: Any]] ?? []
            let first = responses.first
            return StepDescriptor(
                id: id,
                method: method,
                path: path,
                headers: request["headers"] as? [String: String] ?? [:],
                requireHeaders: request["requireHeaders"] as? [String] ?? [],
                body: request["body"],
                expectedStatus: first?["status"] as? Int ?? 200,
                expectedBody: first?["body"]
            )
        }
    }

    struct Report {
        let pass: Bool
        let raw: [String: Any]
    }

    public static func run(suiteName: String, baseUrl: URL) throws {
        let steps = try createSession(suite: suiteName, baseUrl: baseUrl)
        for step in steps {
            let (status, body) = try perform(step: step, baseUrl: baseUrl)
            if status != step.expectedStatus {
                throw ConformanceError(
                    "step \(step.id): expected status \(step.expectedStatus), got \(status)")
            }
            if let expected = step.expectedBody, !jsonMatches(expected, actual: body) {
                throw ConformanceError(
                    "step \(step.id): response body mismatch\nexpected: \(expected)\nactual: \(body)"
                )
            }
        }

        let report = try completeSession(baseUrl: baseUrl)
        if !report.pass {
            throw ConformanceError(
                "suite \(suiteName) failed:\n\(String(describing: report.raw["violations"]))")
        }
        print("suite \(suiteName) passed (\(steps.count) steps)")
    }

    // MARK: - HTTP helpers

    private static func request(_ url: URL, method: String, body: Data? = nil) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
        }
        return request
    }

    private static func send(_ urlRequest: URLRequest) throws -> (Int, Any?) {
        let semaphore = DispatchSemaphore(value: 0)
        var payload: (Int, Any?)?
        var failure: Error?
        URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            defer { semaphore.signal() }
            if let error {
                failure = error
                return
            }
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) }
            payload = (status, json)
        }.resume()
        semaphore.wait()
        if let failure { throw failure }
        return payload!
    }

    private static func createSession(suite: String, baseUrl: URL) throws -> [StepDescriptor] {
        let body = try JSONSerialization.data(withJSONObject: ["suite": suite])
        let (status, json) = try send(
            request(baseUrl.appendingPathComponent("__harness/sessions"), method: "POST", body: body)
        )
        guard status == 200, let object = json as? [String: Any],
            let sessionId = object["sessionId"] as? String,
            let stepJson = object["steps"] as? [[String: Any]]
        else {
            throw ConformanceError("failed to create session: \(status)")
        }
        sessionIdentifier = sessionId

        return try stepJson.map { raw in
            guard let step = StepDescriptor.from(json: raw) else {
                throw ConformanceError("malformed step descriptor: \(raw)")
            }
            return step
        }
    }

    private static var sessionIdentifier: String = ""

    private static func perform(step: StepDescriptor, baseUrl: URL) throws -> (Int, Any?) {
        guard var components = URLComponents(
            url: baseUrl.appendingPathComponent(step.path.dropFirst().description),
            resolvingAgainstBaseURL: false
        ) else {
            throw ConformanceError("invalid path: \(step.path)")
        }
        components.query = nil
        guard let url = components.url else {
            throw ConformanceError("invalid path: \(step.path)")
        }

        var urlRequest = request(url, method: step.method)
        for (name, value) in step.headers {
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }
        for name in step.requireHeaders where urlRequest.value(forHTTPHeaderField: name) == nil {
            urlRequest.setValue("conformance-\(name)", forHTTPHeaderField: name)
        }
        urlRequest.setValue(sessionIdentifier, forHTTPHeaderField: "x-harness-session")

        if let body = step.body {
            urlRequest.httpBody = try JSONSerialization.data(withJSONObject: body)
            urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        }
        return try send(urlRequest)
    }

    private static func completeSession(baseUrl: URL) throws -> Report {
        let (status, json) = try send(
            request(
                baseUrl.appendingPathComponent("__harness/sessions/\(sessionIdentifier)/complete"),
                method: "POST"
            )
        )
        guard status == 200, let object = json as? [String: Any],
            let pass = object["pass"] as? Bool
        else {
            throw ConformanceError("failed to complete session: \(status)")
        }
        return Report(pass: pass, raw: object)
    }

    /// Structural JSON equality with a tiny float tolerance so JS/Swift/Kotlin
    /// number round-trips stay comparable.
    private static func jsonMatches(_ expected: Any, actual: Any?) -> Bool {
        switch (expected, actual) {
        case let (lhs as NSNumber, rhs as NSNumber):
            if CFGetTypeID(lhs) == CFBooleanGetTypeID() || CFGetTypeID(rhs) == CFBooleanGetTypeID()
            {
                return lhs.boolValue == rhs.boolValue
            }
            return abs(lhs.doubleValue - rhs.doubleValue) <= 1e-9 * max(1.0, abs(lhs.doubleValue))
        case let (lhs as String, rhs as String):
            return lhs == rhs
        case let (lhs as [Any], rhs as [Any]):
            return lhs.count == rhs.count && zip(lhs, rhs).allSatisfy { jsonMatches($0, actual: $1) }
        case let (lhs as [String: Any], rhs as [String: Any]):
            return lhs.count == rhs.count && lhs.allSatisfy { key, value in
                guard let other = rhs[key] else { return false }
                return jsonMatches(value, actual: other)
            }
        case (is NSNull, is NSNull):
            return true
        default:
            return false
        }
    }
}

public struct ConformanceError: Error, CustomStringConvertible {
    public let description: String

    init(_ description: String) {
        self.description = description
    }
}
