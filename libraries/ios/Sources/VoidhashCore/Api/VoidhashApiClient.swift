import Foundation

#if canImport(FoundationNetworking)
    import FoundationNetworking
#endif

/// URLSession backed client for the `/api/v1/sdk/*` endpoints.
///
/// Request and response shapes mirror `packages/generated-clients/src/core/generated.ts`. Header
/// dictionaries are built by ``SdkHeaders`` and passed in per call so the caller controls the
/// distinct id and nonce; they hold raw values and are made wire-safe here, at the transport
/// boundary, by ``SdkHeaders/encodedForTransport(_:)``.
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

    /// `GET /api/v1/sdk/person` — `nil` when the backend answers that this identity has no
    /// person (a `404` tagged ``VoidhashApiError/personNotFoundTag``).
    ///
    /// Any other `404` — an edge page, a proxy, a route missing during a deploy — is thrown like
    /// any other failure, so a cached snapshot is never erased by something that is not the
    /// backend's answer.
    public func getPerson(headers: [String: String]) async throws -> SdkPerson? {
        do {
            let data = try await send(method: "GET", path: "/api/v1/sdk/person", headers: headers)
            return try decode(SdkPerson.self, from: data)
        } catch let error as VoidhashApiError
            where error.statusCode == 404 && error.tag == VoidhashApiError.personNotFoundTag
        {
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

    /// `POST /api/v1/sdk/resolve-paywall` — a JSON `null` body means the location resolves to
    /// nothing. An empty body is thrown as an invalid response.
    ///
    /// - Parameter engine: The paywall engine the app links, so the backend serves only a flow it
    ///   can show; `nil` without one.
    /// - Parameter interfaceRevision: The revision of the location's interface the app was
    ///   built against, so the backend serves only a flow that app satisfies; 0 for none.
    /// - Parameter reportsExposure: Whether the SDK reports the answer's A/B test exposure itself;
    ///   without it the backend counts the person on resolving.
    @_spi(VoidhashFlows)
    public func resolvePaywall(
        headers: [String: String], locationSlug: String, engine: FlowEngineCapabilities? = nil,
        interfaceRevision: Int = 0, reportsExposure: Bool
    ) async throws -> SdkResolvedPaywall? {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/resolve-paywall",
            headers: headers.merging(engine?.headers ?? [:]) { _, reported in reported },
            body: SdkResolvePaywallBody(
                locationSlug: locationSlug, interfaceRevision: interfaceRevision,
                reportsExposure: reportsExposure))
        if isNullBody(data.body) {
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

    /// `POST /api/v1/sdk/promotional-offer-signature` — signs an App Store promotional offer for
    /// the calling person. Fails with the tag ``VoidhashApiError/promotionalOfferUnavailableTag``
    /// when the server will not sign it.
    public func signPromotionalOffer(
        headers: [String: String], body: SdkPromotionalOfferSignatureBody
    ) async throws -> SdkPromotionalOfferSignature {
        let data = try await send(
            method: "POST", path: "/api/v1/sdk/promotional-offer-signature", headers: headers,
            body: body)
        return try decode(SdkPromotionalOfferSignature.self, from: data)
    }

    /// `POST /api/v1/sdk/development/purchase` — records a simulated purchase. Only valid from a
    /// debug build with the project's test publishable key; the backend rejects it otherwise.
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
    ) async throws -> (body: Data, statusCode: Int) {
        let origin =
            baseUrl.absoluteString.hasSuffix("/")
            ? String(baseUrl.absoluteString.dropLast()) : baseUrl.absoluteString
        guard let url = URL(string: origin + path) else {
            throw VoidhashApiError.invalidResponse("Invalid request url: \(origin)\(path)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        for (name, value) in SdkHeaders.encodedForTransport(headers) {
            request.setValue(value, forHTTPHeaderField: name)
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            do {
                request.httpBody = try JSONEncoder().encode(body)
            } catch {
                throw VoidhashApiError.requestEncodingFailed(
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
            throw VoidhashApiError.network(
                error.localizedDescription,
                isDeviceOffline: NetworkPolicy.isDeviceOffline(error))
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw VoidhashApiError.invalidResponse("Response was not an HTTP response")
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw VoidhashApiError.http(
                statusCode: httpResponse.statusCode,
                body: data,
                retryAfterMilliseconds: NetworkPolicy.retryAfterMilliseconds(
                    header: httpResponse.value(forHTTPHeaderField: "retry-after"),
                    body: data,
                    now: Date().timeIntervalSince1970 * 1000)
            )
        }

        return (data, httpResponse.statusCode)
    }

    private func decode<Value: Decodable>(
        _ type: Value.Type, from response: (body: Data, statusCode: Int)
    ) throws -> Value {
        do {
            return try JSONDecoder().decode(type, from: response.body)
        } catch {
            // Only a JSON object can be the backend's own answer, which this SDK then failed to
            // read in full. A page, an empty body, an array or a scalar came from something in
            // front of it, and its status says nothing.
            let isObject = (try? JSONSerialization.jsonObject(with: response.body)) is [String: Any]
            throw VoidhashApiError.invalidResponse(
                "Failed to decode response: \(error)",
                statusCode: isObject ? response.statusCode : nil)
        }
    }

    // Only the JSON literal is the backend's "nothing assigned". An empty body comes from
    // something in front of it and fails to decode like any other answer that is not the
    // backend's, so it never erases a cached paywall.
    private func isNullBody(_ data: Data) -> Bool {
        return String(decoding: data, as: UTF8.self)
            .trimmingCharacters(in: .whitespacesAndNewlines) == "null"
    }
}

extension VoidhashApiClient: SchemaFetching {
    public func fetchSchema(headers: [String: String]) async throws -> RuntimeSchema {
        return try await getSchema(headers: headers)
    }
}
