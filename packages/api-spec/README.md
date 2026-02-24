# @voidhash/api-spec

`@voidhash/api-spec` contains the shared Voidhash API contracts (routes, schemas, auth headers, and API error types).

## Installation

Install stable:

```bash
pnpm add @voidhash/api-spec@latest
```

Install a specific version:

```bash
pnpm add @voidhash/api-spec@0.0.1-alpha.1
```

Install latest canary:

```bash
pnpm add @voidhash/api-spec@canary
```

## Runtime Expectations

- ESM package (`"type": "module"`).
- Exports TypeScript source files from `src`.
- Consumers should compile TS dependencies in their build pipeline.
- Peer dependencies are required from the consuming app:
  - `effect`
  - `@effect/platform`

## Release Channels

- `latest`: stable releases published from `main`.
- `canary`: preview builds published from pushes to `preview`.

Recommended flow:

1. Push `api-spec` changes to `preview` to publish a canary build.
2. Validate in `voidhash-mono` against `@voidhash/api-spec@canary` (or the exact canary version).
3. Merge to `main` and publish `latest`.
