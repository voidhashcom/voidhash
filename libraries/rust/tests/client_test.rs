//! Unit tests for the hand-written DX layer, run against a stub HTTP server
//! (wiremock) so the exact wire behavior is exercised.

use serde_json::json;
use voidhash::VoidhashClient;

async fn test_client() -> (wiremock::MockServer, VoidhashClient) {
    let server = wiremock::MockServer::start().await;
    let client = VoidhashClient::builder()
        .secret_key("vh_sk_test")
        .base_url(server.uri())
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
        .respond_with(
            wiremock::ResponseTemplate::new(200).set_body_json(json!({
                "personId": "per_1",
                "distinctId": "user-123",
                "email": null,
                "name": null,
            })),
        )
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
            .respond_with(
                wiremock::ResponseTemplate::new(200).set_body_json(json!({
                    "personId": "per_1", "distinctId": "user-1",
                    "email": null, "name": null,
                })),
            )
            .mount(&server)
            .await;
        wiremock::Mock::given(wiremock::matchers::method("GET"))
            .and(wiremock::matchers::path("/api/v1/persons/per_1/entitlements"))
            .respond_with(
                wiremock::ResponseTemplate::new(200).set_body_json(json!({
                    "grants": [{
                        "perkId": "perk_pro",
                        "status": "active",
                        "expiresAt": null,
                        "source": "subscription",
                        "sourceId": null,
                        "sourcePersonId": "per_1",
                    }],
                })),
            )
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
async fn capture_sends_the_ingest_contract_with_the_publishable_key() {
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
                .set_body_json(json!({ "accepted": 1, "rejected": 0 })),
        )
        .mount(&server)
        .await;

    let result = client
        .event_capture()
        .capture(&voidhash::Event::new("user-123", "note_created"))
        .await
        .expect("capture succeeds");

    assert_eq!(result.accepted, 1);
    assert_eq!(result.rejected, 0);

    let request = &server.received_requests().await.expect("requests")[0];
    let body: serde_json::Value = serde_json::from_slice(&request.body).expect("json body");
    assert_eq!(body["event"], "note_created");
    assert_eq!(body["distinct_id"], "user-123");
    assert_eq!(body["token"], "vh_pk_test");
    assert!(body["uuid"].as_str().is_some_and(|id| !id.is_empty()));
    assert!(body["sent_at"].as_str().is_some_and(|at| !at.is_empty()));
    // Both must be JSON objects; `[]` or `null` is rejected with a 400.
    assert!(body["context"].is_object());
    assert!(body["properties"].is_object());
    // Ingest authenticates on the body token; the secret key must not leak
    // onto this origin.
    assert!(request.headers.get("x-secret-key").is_none());
}

#[tokio::test]
async fn capture_without_a_publishable_key_is_rejected() {
    let (_server, client) = test_client().await;

    let error = client
        .event_capture()
        .capture(&voidhash::Event::new("user-123", "note_created"))
        .await
        .expect_err("capture requires a publishable key");

    assert!(matches!(error, voidhash::Error::Request(_)));
}

#[tokio::test]
async fn set_attributes_posts_traits_for_the_named_person() {
    let (server, client) = test_client().await;

    wiremock::Mock::given(wiremock::matchers::method("POST"))
        .and(wiremock::matchers::path("/api/v1/persons/attributes"))
        .respond_with(
            wiremock::ResponseTemplate::new(200).set_body_json(json!({
                "personId": "per_1",
                "distinctId": "user-123",
                "email": null,
                "name": null,
            })),
        )
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
