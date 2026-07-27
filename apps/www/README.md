# www

TanStack Start app deployed as a Cloudflare Worker through Alchemy.

## Development

Run the full Cloudflare-backed stack from the repository root:

```bash
pnpm dev
```

For an app-only build check:

```bash
pnpm --filter @voidhash/www build
```

`alchemy.run.ts` owns the Cloudflare deployment with `Cloudflare.Vite`; the app Vite config only contains the TanStack/React app plugins.
