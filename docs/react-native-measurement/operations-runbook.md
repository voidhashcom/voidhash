# Measurement operations and support runbook

Use `measurement.getState()` first. Record SDK/native/config versions, readiness, signed-config version, capability states, outbox counts, and last delivery outcome. Use `measurement.createSupportBundle()` only with operator/user consent; never request raw URLs, store receipts, push tokens, advertising identifiers, email, phone, protected ciphertext, or configuration key material.

For delivery backlog, separate policy-blocked, retry-scheduled, and quarantined records. A 429 must preserve the server `Retry-After`; 5xx/network failures use bounded backoff; 413 recursively splits and quarantines only a failing single record. Verify protected evidence is acknowledged before investigating its referencing public record. Do not manually acknowledge or delete evidence to clear an alert.

For self-hosted deployments, verify the API, ingest, and links origins independently. Rotate configuration signing keys by publishing the new public key ID alongside the old ID, deploying the new signer, confirming a higher signed version is accepted, and only then removing the old trust entry. Never lower a configuration version or reuse a signing key ID with different key material.

Deletion incidents are tracked by request ID and installation/person scope. Confirm the durable client request, protected-vault purge, raw/derived-data deletion, and partner-send suppression. Retention exceptions require a documented legal basis and must remain unavailable to ordinary analytics reads.

Partner incidents are investigated from append-only send/suppression audit rows: trigger ID, partner, current consent revision, filtered fields, result, and reason. Do not replay a postback until its idempotency key and current send-time policy have been checked.

Release operators attach physical-device results for the fourteen scenarios, the Android/iOS matrix cells, the offline soak, self-host run, store/campaign runs, privacy/store disclosures, retention review, and security/legal/support approvals to the release decision record.
