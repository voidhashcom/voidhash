# Contributing to voidhash

Thanks for taking the time to improve voidhash!

During the repository unification, pull requests are limited to repository
collaborators and external patches are not yet accepted. Issues and private
security reports remain welcome.

Before external contributions reopen, Voidhash will enable an acceptance
process for the [Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md).
Every external contributor will need to accept that agreement before a
contribution can be merged.

## Security issues

Report suspected vulnerabilities privately to
[security@voidhash.com](mailto:security@voidhash.com). Do not open a public
issue or pull request for a vulnerability. See the [Security Policy](SECURITY.md)
for reporting guidance.

## Guidelines

- Rather than extensive configurations, focus instead on providing opinionated, best-practice defaults.
- Keep APIs consistent and predictable across supported frameworks.
- Preserve end-to-end type safety.
- Add JSDoc to public functions and keep existing documentation current.
- Keep infrastructure adapters behind the platform interfaces used by product code.

## Development

Voidhash uses Node.js 22 and pnpm 11. From the repository root:

```sh
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Use `pnpm check:publication` to validate license metadata and the public/private
repository boundary. The [self-hosting guide](selfhost/README.md) documents the
local Compose environment and its smoke tests.

## Testing

Run the smallest relevant package tests while iterating, then run the repository
typecheck and test graph before requesting review. Changes to the Node runtime
or Compose configuration should also pass both self-host smoke tests documented
in [selfhost/README.md](selfhost/README.md#smoke-test).

## License zones

By contributing, you agree that your contribution is licensed under the license
that applies to the files you change. See [LICENSE.md](LICENSE.md) for the MIT
and AGPL zones. The Contributor License Agreement is an additional requirement
once external contributions reopen.
