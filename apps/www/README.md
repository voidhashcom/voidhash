# Community web entrypoint

This application composes the shared Voidhash web package with the Community
route set and standalone runtime adapters.

Shared features and routes live in `packages/web-app`; this directory only owns
the Community entrypoint, generated route tree, source configuration, and local
development command.

```bash
pnpm --filter @voidhash/www build
```
