# React Native measurement privacy guide

Collection and upload are separate controls. `collectionOptOut` prevents new collection; upload pause retains already durable evidence. Partner sharing is re-evaluated at send time. A deletion request is written durably before protected local values are purged and the server deletion endpoint is called.

Consent revisions must increase. Effective precedence is: collection opt-out, explicit collection policy, category consent (`adStorage` for advertising identifiers and `dataUsage` for vendor identifiers/protected identity), then partner exclusions. TCF/DMA fields are evidence inputs and do not override a stricter application or system decision. ATT is observed only; the SDK never prompts outside the application-controlled permission path. IDFA is read only with authorized ATT and an allowed advertising policy. The strict-no-IDFA build configuration makes the collector unavailable.

Raw URLs/referrers, push tokens/payloads, receipts/JWS/purchase tokens, advertising and vendor identifiers, email, phone, and diagnostic authorizations are protected fields. They are encrypted in the native vault and ordinary records contain only opaque references. The public-property classifier rejects protected key names and URL/email-shaped values. Support bundles hash installation/session IDs and omit endpoint origins, event properties, and protected values.

Location is denied by default and is manual-only when enabled. Email/phone and advertising identifiers require product/legal approval before enabling. Configure iOS privacy-manifest declarations and Play Data safety answers from the enabled capability manifest; include collection purpose, retention, linking, sharing, deletion, ATT/AD_ID behavior, and every optional store provider actually shipped.

Production builds must use production purchase validation. Sandbox validation in a release build is rejected. Self-hosted endpoints require HTTPS except an explicit debug-only localhost policy, and signed remote configuration requires a project binding and trusted rotating public keys.
