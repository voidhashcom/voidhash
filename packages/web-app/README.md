# Voidhash web application

`@voidhash/web-app` is the shared source package for Voidhash web editions. It
owns the common UI, features, route root, and route sets; an entrypoint selects
the routes and runtime composition that belong to its edition.

The package provides:

- `src/routes/shared` for routes available in every edition;
- `src/routes/community` for Community-only routes;
- Community auth and edition defaults under `src/composition/community`; and
- `@voidhash/web-app/vite`, which composes an edition's physical route
  directories and runtime modules into one TanStack Start application.

The Community entrypoint lives in `apps/www`. Other editions can depend on this
package, add their own route directory, and supply implementations for the auth,
edition, and global-style composition modules without copying shared pages.

## Development

Run the Community development stack from the repository root:

```bash
pnpm dev
```

For an app-only build check:

```bash
pnpm --filter @voidhash/www build
```

The entrypoint remains responsible for its generated route tree, router, server
entry, and environment-specific development command.
