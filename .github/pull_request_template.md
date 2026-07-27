## Summary

<!-- External pull-request intake is closed during private alpha and beta. -->

## Validation

- [ ] I ran the smallest relevant tests.
- [ ] I ran `pnpm typecheck` and `pnpm test`, or documented why they do not apply.
- [ ] Self-host or runtime changes pass the relevant Compose smoke suites.
- [ ] I updated public JSDoc and user-facing documentation where behavior changed.

## Publication boundary

- [ ] `pnpm check:publication` passes.
- [ ] Community code uses only `@voidhash/*` scopes and provider-neutral platform interfaces.
- [ ] Every changed package retains the correct MIT or AGPL license metadata and license text.
- [ ] The change contains no credentials, customer data, internal hostnames, or private operations/Enterprise code.

## Security

- [ ] I considered tenant isolation, authentication, replay/idempotency, storage ownership, and untrusted input where relevant.
- [ ] I did not disclose a suspected vulnerability in this pull request.
