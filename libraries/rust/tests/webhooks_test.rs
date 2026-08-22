//! Webhook verification tests, mirroring the vectors from the Node SDK.

use voidhash::webhooks;

fn sign(timestamp: &str, payload: &str, secret: &str) -> String {
    use hmac::{Hmac, Mac};
    use sha2::Sha256;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(timestamp.as_bytes());
    mac.update(b".");
    mac.update(payload.as_bytes());
    format!("v1={}", hex::encode(mac.finalize().into_bytes()))
}

#[test]
fn construct_event_verifies_and_parses() {
    let payload = r#"{"hello":"world"}"#;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();
    let signature = sign(&timestamp, payload, "whsec_test");

    let event = webhooks::construct_event(
        payload.as_bytes(),
        "purchase.completed",
        &signature,
        &timestamp,
        "whsec_test",
    )
    .expect("verification succeeds");

    assert_eq!(event.event_type, "purchase.completed");
    assert_eq!(event.payload["hello"], "world");
}

#[test]
fn tampered_signature_is_rejected() {
    let payload = r#"{"hello":"world"}"#;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();
    let signature = {
        let full = sign(&timestamp, payload, "whsec_test");
        format!("{}0000", &full[..full.len() - 4])
    };

    let result = webhooks::construct_event(
        payload.as_bytes(),
        "purchase.completed",
        &signature,
        &timestamp,
        "whsec_test",
    );
    assert!(matches!(
        result,
        Err(webhooks::WebhookVerificationError::InvalidSignature)
    ));
}

#[test]
fn stale_timestamp_outside_tolerance_is_rejected() {
    let stale = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
        - 3600;
    let timestamp = stale.to_string();
    let signature = sign(&timestamp, "{}", "whsec_test");

    assert!(!webhooks::verify_signature(
        b"{}",
        &signature,
        &timestamp,
        "whsec_test",
        300
    ));
}
