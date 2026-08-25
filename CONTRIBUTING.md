# Contributing to voidhash

Thanks for taking the time to improve voidhash!

External contributions are welcome. Open a pull request against `main` as you
would in any other project; CI runs against your branch as-is.

This repository is a synchronized distribution. Once a pull request is
approved, a maintainer imports it into the project validation workflow. The
accepted change then lands on `main` with the contributor preserved as its Git
author, and the original pull request closes automatically. Do not push
directly to `main`; it is maintained by the synchronization bot.

Every external contributor must accept the
[Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md) before a
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
- Keep pull requests focused and describe the validation you ran.

## Development

Voidhash uses Node.js 24 and pnpm 11. From the repository root:

```sh
corepack enable
corepack prepare pnpm@11.21.0 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
```

Use `pnpm check:publication` to validate license metadata and the repository
boundary. The [Cloudflare deployment guide](docs/cloudflare-deployment.md)
documents the local and live Alchemy workflow.

Linting and formatting go through vite-plus: `pnpm lint` (`vp check`) and
`pnpm format` (`vp check --fix`).

Launch the Community Alchemy stack:

```sh
cp .env.example .env
pnpm dev
```

Alchemy uses a persistent PGlite database in `.pglite/` by default, applies
pending migrations, and injects its connection into the local Hyperdrive
binding. Set `DATABASE_MODE=pg` to use and migrate an already-running
PostgreSQL origin instead.
Alchemy serves the backend on `http://localhost:8787` and the web application
on `http://localhost:3000`. Ports are strict so local links cannot silently move
between runs.

## Validation

Run the repository lint, typecheck, and build before requesting review. The
maintainer import workflow runs the private test suite against the proposed
change before it can merge.

## License zones

By contributing, you agree that your contribution is licensed under the license
that applies to the files you change. See [LICENSE.md](LICENSE.md) for the MIT
and AGPL zones. The Contributor License Agreement is an additional requirement
for external contributions.
