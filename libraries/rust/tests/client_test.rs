//! Unit tests for the hand-written DX layer, run against a stub HTTP server
//! (wiremock) so the exact wire behavior is exercised.

use serde_json::json;
use voidhash::VoidhashClient;

async fn test_client() -> (wiremock::MockServer, VoidhashClient) {
    let server = wiremock::MockServer::start().await;
    let client = VoidhashClient::builder()
        .secret_key("vh_sk_test")
        .base_url(server.uri())
        .ingest_url(server.uri())
        .build()
        .expect("client builds");
    (server, client)
}

#[tokio::test]
async fn get_person_by_distinct_id_sends_auth_header_and_decodes() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("GET"))
        .and(wiremock::matchers::path(
            "/api/v1/persons/by-distinct-id/user-123",
        ))
        .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(json!({
            "personId": "per_1",
            "distinctId": "user-123",
            "email": null,
            "name": null,
        })))
        .mount(&server)
        .await;

    let person = client
        .persons()
        .get_by_distinct_id("user-123")
        .await
        .expect("person resolves");

    assert_eq!(person.person_id, "per_1");
    assert_eq!(person.distinct_id, "user-123");

    let requests = server.received_requests().await.expect("requests recorded");
    assert_eq!(requests.len(), 1);
    let auth_header = requests[0]
        .headers
        .iter()
        .find(|(name, _)| name.as_str() == "x-secret-key")
        .map(|(_, value)| String::from_utf8_lossy(value.as_ref()).into_owned())
        .unwrap_or_default();
    assert_eq!(auth_header, "vh_sk_test");
}

#[tokio::test]
async fn error_mapping_carries_status_and_tag() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("GET"))
        .and(wiremock::matchers::path("/api/v1/persons/per_missing"))
        .respond_with(
            wiremock::ResponseTemplate::new(404)
                .set_body_json(json!({"_tag": "Api/PersonNotFoundError", "id": null})),
        )
        .mount(&server)
        .await;

    let error = client
        .persons()
        .get("per_missing")
        .await
        .expect_err("expected an error");

    assert!(error.is_not_found());
    assert_eq!(
        error.to_string(),
        "voidhash api error 404: Api/PersonNotFoundError"
    );
}

#[tokio::test]
async fn has_active_perk_by_slug_and_by_id() {
    let (server, client) = test_client().await;

    // Perks list is hit once per slug lookup.
    for _ in 0..2 {
        wiremock::Mock::given(wiremock::matchers::method("GET"))
            .and(wiremock::matchers::path("/api/v1/perks"))
            .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(vec![
                json!({"id": "perk_free", "name": "Free", "projectId": "prj_1", "slug": "free"}),
                json!({"id": "perk_pro", "name": "Pro", "projectId": "prj_1", "slug": "pro"}),
            ]))
            .mount(&server)
            .await;
    }
    for _ in 0..2 {
        wiremock::Mock::given(wiremock::matchers::method("GET"))
            .and(wiremock::matchers::path(
                "/api/v1/persons/by-distinct-id/user-1",
            ))
            .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(json!({
                "personId": "per_1", "distinctId": "user-1",
                "email": null, "name": null,
            })))
            .mount(&server)
            .await;
        wiremock::Mock::given(wiremock::matchers::method("GET"))
            .and(wiremock::matchers::path(
                "/api/v1/persons/per_1/entitlements",
            ))
            .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(json!({
                "grants": [{
                    "perkId": "perk_pro",
                    "status": "active",
                    "expiresAt": null,
                    "source": "subscription",
                    "sourceId": null,
                    "sourcePersonId": "per_1",
                }],
            })))
            .mount(&server)
            .await;
    }

    let active = client
        .persons()
        .has_active_perk("user-1", None, Some("pro"))
        .await
        .expect("slug lookup succeeds");
    assert!(active);

    let inactive = client
        .persons()
        .has_active_perk("user-1", None, Some("free"))
        .await
        .expect("slug lookup succeeds");
    assert!(!inactive);

    let by_id = client
        .persons()
        .has_active_perk("user-1", Some("perk_pro"), None)
        .await
        .expect("id lookup succeeds");
    assert!(by_id);
}

#[tokio::test]
async fn unknown_person_resolves_to_false_for_has_active_perk() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("GET"))
        .and(wiremock::matchers::path(
            "/api/v1/persons/by-distinct-id/ghost",
        ))
        .respond_with(
            wiremock::ResponseTemplate::new(404)
                .set_body_json(json!({"_tag": "Api/PersonNotFoundError", "id": null})),
        )
        .mount(&server)
        .await;

    let active = client
        .persons()
        .has_active_perk("ghost", Some("perk_pro"), None)
        .await
        .expect("unknown persons are not errors");
    assert!(!active);
}

#[tokio::test]
async fn has_active_perk_requires_exactly_one_selector() {
    let (_server, client) = test_client().await;

    let error = client
        .persons()
        .has_active_perk("user-1", None, None)
        .await
        .expect_err("expected a configuration error");
    assert!(matches!(error, voidhash::Error::Request(_)));

    let error = client
        .persons()
        .has_active_perk("user-1", Some("a"), Some("b"))
        .await
        .expect_err("expected a configuration error");
    assert!(matches!(error, voidhash::Error::Request(_)));
}

#[tokio::test]
async fn empty_secret_key_is_rejected() {
    let result = VoidhashClient::builder().build();
    assert!(matches!(result, Err(voidhash::Error::Request(_))));
}

#[tokio::test]
async fn capture_sends_secret_key_and_full_wire_body() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/i/v1/capture"))
        .respond_with(
            wiremock::ResponseTemplate::new(202)
                .set_body_json(json!({"accepted": 1, "rejected": 0})),
        )
        .mount(&server)
        .await;

    let result = client
        .event_capture()
        .capture(&voidhash::Event::new("paywall_viewed", "user-123"))
        .await
        .expect("capture accepted");
    assert_eq!(result.accepted, 1);
    assert_eq!(result.rejected, 0);

    let requests = server.received_requests().await.expect("requests recorded");
    assert_eq!(requests.len(), 1);

    let secret_key = requests[0]
        .headers
        .iter()
        .find(|(name, _)| name.as_str() == "x-secret-key")
        .map(|(_, value)| String::from_utf8_lossy(value.as_ref()).into_owned())
        .unwrap_or_default();
    assert_eq!(secret_key, "vh_sk_test");

    let body: serde_json::Value = requests[0].body_json().expect("body is json");
    assert_eq!(body["event"], "paywall_viewed");
    assert_eq!(body["distinct_id"], "user-123");
    assert_eq!(body["properties"], json!({}));
    assert_eq!(body["context"], json!({}));
    assert!(body["uuid"].as_str().is_some_and(|uuid| !uuid.is_empty()));
    assert!(body["sent_at"]
        .as_str()
        .is_some_and(|sent| !sent.is_empty()));
    // Backend SDKs authenticate with the secret key alone.
    assert!(body.get("token").is_none());
    assert!(body.get("distinctId").is_none());
    assert!(body.get("session_id").is_none());
    assert!(body.get("timestamp").is_none());
}

#[tokio::test]
async fn capture_preserves_caller_supplied_fields() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/i/v1/capture"))
        .respond_with(
            wiremock::ResponseTemplate::new(202)
                .set_body_json(json!({"accepted": 1, "rejected": 0})),
        )
        .mount(&server)
        .await;

    let event = voidhash::Event::new("purchase", "user-9")
        .uuid("018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f")
        .property("amount", 42)
        .context_property("platform", "ios")
        .session_id("sess_1")
        .timestamp(
            chrono::DateTime::parse_from_rfc3339("2026-08-22T12:00:00Z")
                .expect("timestamp parses")
                .with_timezone(&chrono::Utc),
        );

    client
        .event_capture()
        .capture(&event)
        .await
        .expect("capture accepted");

    let requests = server.received_requests().await.expect("requests recorded");
    let body: serde_json::Value = requests[0].body_json().expect("body is json");
    assert_eq!(body["uuid"], "018f6d2e-4c3a-7b1d-9e5f-2a8c1b0d4e6f");
    assert_eq!(body["properties"], json!({"amount": 42}));
    assert_eq!(body["context"], json!({"platform": "ios"}));
    assert_eq!(body["session_id"], "sess_1");
    assert_eq!(body["timestamp"], "2026-08-22T12:00:00Z");
}

#[tokio::test]
async fn capture_batch_posts_every_event_once() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/i/v1/batch"))
        .respond_with(
            wiremock::ResponseTemplate::new(202)
                .set_body_json(json!({"accepted": 2, "rejected": 0})),
        )
        .mount(&server)
        .await;

    let events = vec![
        voidhash::Event::new("first", "user-1"),
        voidhash::Event::new("second", "user-2").uuid("fixed-uuid"),
    ];

    let result = client
        .event_capture()
        .capture_batch(&events)
        .await
        .expect("batch accepted");
    assert_eq!(result.accepted, 2);

    let requests = server.received_requests().await.expect("requests recorded");
    assert_eq!(requests.len(), 1);
    let body: serde_json::Value = requests[0].body_json().expect("body is json");
    assert!(body["sent_at"]
        .as_str()
        .is_some_and(|sent| !sent.is_empty()));

    let events = body["events"].as_array().expect("events is an array");
    assert_eq!(events.len(), 2);
    assert_eq!(events[0]["event"], "first");
    assert_eq!(events[0]["distinct_id"], "user-1");
    assert!(events[0]["uuid"]
        .as_str()
        .is_some_and(|uuid| !uuid.is_empty()));
    assert!(events[0].get("sent_at").is_none());
    assert_eq!(events[1]["uuid"], "fixed-uuid");
}

#[tokio::test]
async fn capture_maps_rejection_to_api_error() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/i/v1/capture"))
        .respond_with(wiremock::ResponseTemplate::new(401).set_body_json(json!({
            "_tag": "CaptureUnauthorizedError",
            "code": "unauthorized",
            "error": "invalid credential",
        })))
        .mount(&server)
        .await;

    let error = client
        .event_capture()
        .capture(&voidhash::Event::new("paywall_viewed", "user-123"))
        .await
        .expect_err("expected an error");

    assert_eq!(error.status(), Some(401));
    assert_eq!(
        error.to_string(),
        "voidhash api error 401: CaptureUnauthorizedError"
    );
}

#[tokio::test]
async fn set_attributes_posts_traits_for_the_named_person() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/api/v1/persons/attributes"))
        .respond_with(wiremock::ResponseTemplate::new(200).set_body_json(json!({
            "personId": "per_1",
            "distinctId": "user-123",
            "email": null,
            "name": null,
        })))
        .mount(&server)
        .await;

    let traits = json!({ "plan": "pro", "notes_created": 3 })
        .as_object()
        .expect("object")
        .clone();
    let person = client
        .persons()
        .set_attributes(&voidhash::PersonAttributes::new("user-123", traits))
        .await
        .expect("set_attributes succeeds");

    assert_eq!(person.person_id, "per_1");

    let request = &server.received_requests().await.expect("requests")[0];
    let body: serde_json::Value = serde_json::from_slice(&request.body).expect("json body");
    assert_eq!(body["distinctId"], "user-123");
    assert_eq!(body["traits"]["plan"], "pro");
    assert_eq!(body["traits"]["notes_created"], 3);
}

#[tokio::test]
async fn capture_sends_a_configured_publishable_key_as_the_body_token() {
    let server = wiremock::MockServer::start().await;
    let client = VoidhashClient::builder()
        .secret_key("vh_sk_test")
        .publishable_key("vh_pk_test")
        .ingest_url(server.uri())
        .build()
        .expect("client builds");

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/i/v1/capture"))
        .respond_with(
            wiremock::ResponseTemplate::new(202)
                .set_body_json(json!({"accepted": 1, "rejected": 0})),
        )
        .mount(&server)
        .await;

    client
        .event_capture()
        .capture(&voidhash::Event::new("paywall_viewed", "user-123"))
        .await
        .expect("capture accepted");

    let requests = server.received_requests().await.expect("requests recorded");
    let body: serde_json::Value = requests[0].body_json().expect("body is json");
    // Browser parity: the publishable key rides in the body, never the secret.
    assert_eq!(body["token"], "vh_pk_test");
    let secret_key = requests[0]
        .headers
        .iter()
        .find(|(name, _)| name.as_str() == "x-secret-key")
        .map(|(_, value)| String::from_utf8_lossy(value.as_ref()).into_owned())
        .unwrap_or_default();
    assert_eq!(secret_key, "vh_sk_test");
}

#[tokio::test]
async fn capture_batch_with_no_events_sends_nothing() {
    let (server, client) = test_client().await;

    let result = client
        .event_capture()
        .capture_batch(&[])
        .await
        .expect("empty batch is a no-op");
    assert_eq!(result.accepted, 0);
    assert_eq!(result.rejected, 0);
    assert!(server
        .received_requests()
        .await
        .expect("requests recorded")
        .is_empty());
}
