import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// URLSession backed client for the `/api/v1/sdk/*` endpoints.
///
/// Request and response shapes mirror `packages/generated-clients/src/core/generated.ts`. Header
/// dictionaries are built by ``SdkHeaders`` and passed in per call so the caller controls the
/// distinct id and nonce.
public final class VoidhashApiClient: Sendable {
    /// Default production API origin.
    public static let defaultBaseUrl = URL(string: "https://api.voidhash.com")!

    private let baseUrl: URL
    private let session: URLSession

    /// - Parameters:
    ///   - baseUrl: API origin.
    ///   - session: Transport. Defaults to ``NetworkPolicy/defaultSession``, which carries the
    ///     SDK request and resource timeouts.
    public init(
        baseUrl: URL = VoidhashApiClient.defaultBaseUrl,
        session: URLSession = NetworkPolicy.defaultSession
    ) {
        self.baseUrl = baseUrl
        self.session = session
    }

    /// `GET /api/v1/sdk/schema`
    public func getSchema(headers: [String: String]) async throws -> RuntimeSchema {
        let data = try await send(method: "GET", path: "/api/v1/sdk/schema", headers: headers)
        return try decode(RuntimeSchema.self, from: data)
    }

    /// `GET /api/v1/sdk/person` — a `404` means the person does not exist yet and maps to `nil`.
    public func getPerson(headers: [String: String]) async throws -> SdkPerson? {
        do {
            let data = try await send(method: "GET", path: "/api/v1/sdk/person", headers: headers)
            return try decode(SdkPerson.self, from: data)
        } catch let error as VoidhashApiError where error.statusCode == 404 {
            return nil
        }
    }

    /// `POST /api/v1/sdk/identify`
    public func identify(headers: [String: String], body: SdkIdentifyBody) async throws -> SdkPerson
    {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/identify", headers: headers, body: body)
        return try decode(SdkPerson.self, from: data)
    }

    /// `POST /api/v1/sdk/person/traits`
    public func setPersonTraits(headers: [String: String], body: SdkPersonTraitsBody) async throws
        -> SdkPerson
    {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/person/traits", headers: headers, body: body)
        return try decode(SdkPerson.self, from: data)
    }

    /// `POST /api/v1/sdk/evaluate-flags`
    public func evaluateFlags(headers: [String: String], flagKeys: [String]? = nil) async throws
        -> SdkFeatureFlagsResponse
    {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/evaluate-flags", headers: headers,
            body: SdkEvaluateFlagsBody(flagKeys: flagKeys))
        return try decode(SdkFeatureFlagsResponse.self, from: data)
    }

    /// `POST /api/v1/sdk/resolve-paywall` — a `null` body means the location resolves to nothing.
    public func resolvePaywall(headers: [String: String], locationSlug: String) async throws
        -> SdkResolvedPaywall?
    {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/resolve-paywall", headers: headers,
            body: SdkResolvePaywallBody(locationSlug: locationSlug))
        if isNullBody(data) {
            return nil
        }
        return try decode(SdkResolvedPaywall.self, from: data)
    }

    /// `POST /api/v1/sdk/sync-transaction`
    public func syncTransaction(headers: [String: String], body: SdkSyncTransactionBody)
        async throws -> SdkSyncTransactionResponse
    {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/sync-transaction", headers: headers, body: body)
        return try decode(SdkSyncTransactionResponse.self, from: data)
    }

    /// `POST /api/v1/sdk/development/purchase` — records a simulated purchase. Only valid
    /// while the SDK runs with `x-environment: development`; the backend rejects it otherwise.
    public func developmentPurchase(headers: [String: String], body: SdkDevelopmentPurchaseBody)
        async throws -> Bool
    {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/development/purchase", headers: headers, body: body)
        let response = try decode(SdkSyncTransactionResponse.self, from: data)
        return response.accepted
    }

    private func send(
        method: String,
        path: String,
        headers: [String: String],
        body: (any Encodable)? = nil
    ) async throws -> Data {
        let origin =
            baseUrl.absoluteString.hasSuffix("/")
            ? String(baseUrl.absoluteString.dropLast()) : baseUrl.absoluteString
        guard let url = URL(string: origin + path) else {
            throw VoidhashApiError.invalidResponse("Invalid request url: \(origin)\(path)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            do {
                request.httpBody = try JSONEncoder().encode(body)
            } catch {
                throw VoidhashApiError.invalidResponse(
                    "Failed to encode request body: \(error.localizedDescription)")
            }
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            // A cancelled task surfaces as `URLError.cancelled`; reporting it as a transport
            // failure would count it against the host's breaker and let callers treat a caller
            // that went away as an outage.
            if Task.isCancelled || (error as? URLError)?.code == .cancelled {
                throw CancellationError()
            }
            throw VoidhashApiError.network(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw VoidhashApiError.invalidResponse("Response was not an HTTP response")
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let failure = decodeErrorBody(data)
            throw VoidhashApiError.http(
                statusCode: httpResponse.statusCode,
                tag: failure.tag,
                message: failure.message,
                retryAfterMilliseconds: NetworkPolicy.retryAfterMilliseconds(
                    header: httpResponse.value(forHTTPHeaderField: "retry-after"),
                    body: data,
                    now: Date().timeIntervalSince1970 * 1000)
            )
        }

        return data
    }

    private func decode<Value: Decodable>(_ type: Value.Type, from data: Data) throws -> Value {
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            throw VoidhashApiError.invalidResponse("Failed to decode response: \(error)")
        }
    }

    private func isNullBody(_ data: Data) -> Bool {
        let trimmed = String(decoding: data, as: UTF8.self)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty || trimmed == "null"
    }

    private func decodeErrorBody(_ data: Data) -> (tag: String?, message: String?) {
        struct ApiErrorBody: Decodable {
            let tag: String?
            let message: String?
            let cause: String?

            private enum CodingKeys: String, CodingKey {
                case tag = "_tag"
                case message
                case cause
            }
        }

        guard let body = try? JSONDecoder().decode(ApiErrorBody.self, from: data) else {
            return (nil, nil)
        }
        return (body.tag, body.message ?? body.cause)
    }
}

extension VoidhashApiClient: SchemaFetching {
    public func fetchSchema(headers: [String: String]) async throws -> RuntimeSchema {
        return try await getSchema(headers: headers)
    }
}
