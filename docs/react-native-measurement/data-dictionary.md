# Measurement data dictionary

Every `MeasurementEnvelopeV1` contains `schemaVersion`, `recordId`, `type`, `occurredAt`, `queuedAt`, `installationId`, `installationSequence`, capture-time `identity` and `consent`, `app`, `device`, `source`, `publicPayload`, and optionally an opaque `protectedPayloadRef`. Session state and monotonic time are included when available. Product analytics carries standardized metadata under `context`, not duplicated inside event properties.

| Record type | Public purpose |
| --- | --- |
| `installation.created.v1` | First open, app release, and collector capability baseline. |
| `installation.updated.v1` | App release transition. |
| `session.started.v1` | Session sequence, reason, and readiness. |
| `session.ended.v1` | End reason and monotonic duration. |
| `identity.changed.v1` | Immutable previous/current identity revisions. |
| `consent.changed.v1` | Immutable previous/current consent and effective policy. |
| `link.received.v1` | Source, app state, time, and protected raw-link reference. |
| `link.resolved.v1` | Direct/deferred status and allowlisted route/campaign projection. |
| `link.routed.v1` | Application routing outcome. |
| `android.install_referrer.v1` | Store outcome, timestamps/version/verification, protected referrer. |
| `android.preinstall.v1` | Typed OEM/preinstall attribution. |
| `ios.adservices.v1` | Availability/timing and protected Apple Ads result. |
| `ios.att.changed.v1` | ATT status transition and source. |
| `identifier.observed.v1` | Identifier kind, policy basis, outcome, and protected reference. |
| `push.token.v1` | Provider, environment, rotation reason, and opaque device-token ID. |
| `push.received.v1` | Allowlisted push metadata and protected payload reference. |
| `push.opened.v1` | Notification/open/link correlation. |
| `revenue.ad_impression.v1` | Impression ID, network, mediation, decimal revenue, currency, and safe dimensions. |
| `purchase.observed.v1` | Store transaction projection and protected receipt/token reference. |
| `purchase.validation_requested.v1` | Correlated validation request, environment, and idempotency key. |
| `purchase.validation_result.v1` | Valid/invalid/indeterminate outcome, store state, and failure class. |
| `diagnostic.capability.v1` | Collector/build capability and redacted error state. |
| `partner.context_changed.v1` | Partner IDs, configuration revision, and protected partner-context reference. |

Protected vault purposes are `advertising-identifier`, `diagnostic-authorization`, `email`, `install-referrer`, `link-capture`, `partner-context`, `phone`, `purchase-receipt`, and `push-token`. A vault row carries its opaque blob ID, consent revision, retention class, encryption-key version, deletion state, and upload state. Ciphertext and raw values are excluded from public records, reports, state, and support bundles.

`purchase.validation_result.v1` may carry normalized cancellation, pause/resume, offer, replacement, prepaid/top-up, price-change, line-item, and test-environment state. It never carries the raw store response; that response uses `purchase-receipt` protected storage.

Standard event aliases are: `add payment info`, `add to cart`, `add to wishlist`, `complete registration`, `initiated checkout`, `invite shared`, `level achieved`, `location`, `login`, `purchase`, `rate`, `search`, `share`, `spent credits`, `subscribe`, `tutorial completion`, `unlock achievement`, `viewed content`, and the SDK-only automatic `opened from push notification` event. Revenue is represented only by explicit purchase/ad-revenue fields; aliases do not infer revenue.
