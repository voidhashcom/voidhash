# Measurement public-release gate

Automated evidence:

- `parity-test-map.json` accounts for every planned ledger row and the exact six-row `wont-do` set.
- `release-scenarios.json` enumerates all fourteen release scenarios.
- React Native unit/type tests, Nitro generation, plugin compilation, API/client/database/backend typechecks, core tests, Swift tests, and Android tests must pass from a clean checkout.
- Store disclosure inputs are generated from the same capability options as the native manifest.
- Documentation coverage compares canonical record and standard-event sources with the data dictionary.

Required attached evidence before a public release:

- iOS physical-device matrix and archive inspection:
- Android physical-device matrix and merged-manifest inspection:
- 72-hour offline soak per platform:
- Dedicated campaign/deferred-link run per platform:
- Sandbox and production purchase/store-notification reconciliation per platform:
- Real self-host deployment run per platform:
- App Store privacy and Google Play Data safety approval:
- Security/privacy review and accepted risks:
- Retention/deletion-SLA review:
- Legal approval or verified default-off status for location, email/phone, and advertising identifiers:
- Operations/support approval:
- Release owner and decision date:

No blank item is an approval. Automated simulator/unit evidence cannot replace physical-device, store, campaign, legal, privacy, or organizational sign-off.
