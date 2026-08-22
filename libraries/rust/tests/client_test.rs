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
