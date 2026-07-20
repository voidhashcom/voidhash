# Measurement integration troubleshooting

Run `npx voidhash-doctor` from the app root with a secret-free `voidhash.config.json` containing the plugin options. The command prints a redacted capability report and exits nonzero for required integration failures.

- `VH_CFG_CONTRADICTION`: fix the configuration reported by Expo prebuild; doctor and plugin share the same validator.
- `VH_IOS_APS_ENTITLEMENT_MISSING`: add the push environment entitlement.
- `VH_ANDROID_GOOGLE_SERVICES_MISSING` / `VH_ANDROID_FCM_HOOK_MISSING`: add the Firebase file/plugin and native messaging subscriber.
- `VH_ANDROID_NO_BACKUP_UNVERIFIED`: keep measurement SQLite/install state under no-backup storage without replacing unrelated app backup rules.
- `VH_IOS_ASSOCIATED_DOMAINS_MISSING` / `VH_ANDROID_APP_LINK_MISSING`: configure matching native link declarations and verify the website association files.
- `VH_IOS_SKAN_ENDPOINT_MISSING`: add the HTTPS postback origin or explicitly disable Apple attribution.
- `VH_IOS_SKAN_PLIST_MISSING` / `VH_IOS_ADATTRIBUTIONKIT_PLIST_MISSING`: regenerate the built Info.plist with both configured copy endpoints.
- `VH_ANDROID_APP_LINK_UNVERIFIED`: enable `android:autoVerify` and publish a matching Digital Asset Links file.

Use `measurement.getState()` for local readiness, collector states, signed-config version, and outbox counts. Generate `measurement.createSupportBundle()` only with user/operator consent. A persistent outbox usually indicates offline state, a retryable 429/5xx, or protected-evidence upload pending. Quarantine indicates a permanent item failure such as an oversized record. Raw links, identifiers, tokens, and receipts never belong in logs or support tickets.

Before release, verify direct/background/foreground/deferred links, offline install referrer, consent-gated start, push delivery/open, purchase/ad-revenue dedupe, reinstall/backup behavior, server renewal/refund correlation, partner allow/deny, and deletion on physical iOS and Android devices. Simulator smoke tests do not certify ATT/IDFA, referrer, store validation, push invalid-token uninstall inference, or real campaign correlation.

The executable parity references and fourteen-scenario catalog are checked in as `parity-test-map.json` and `release-scenarios.json` beside this guide. Physical-device results and organizational approvals must be attached to the release record; local unit tests never substitute for those gates.
