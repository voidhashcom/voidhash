# Voidhash CLI

The Voidhash CLI is a tool for managing your Voidhash project.

## Installation

The package is published as `voidhash-cli`. For one-off commands, run it without
installing anything:

```sh
pnpm dlx voidhash-cli init
# or
npx voidhash-cli init
```

Isolated invocation keeps the CLI out of your app's dependency tree, so it can
never influence your bundle or your lockfile resolution.

### Installing it as a dev dependency

Install it when you run it repeatedly — most importantly when you use the Metro
plugin, which spawns `voidhash-cli types generate --watch` alongside the Metro
dev server and resolves the binary from `PATH`. A dev-dependency install puts it
on `PATH` for every `pnpm`/`npm` script, which is what enables that watch
integration:

```sh
pnpm add --save-dev voidhash-cli
# or
npm install --save-dev voidhash-cli
```

Then wire the plugin into `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withVoidhash } = require("@voidhash/react-native/metro");

module.exports = withVoidhash(getDefaultConfig(__dirname));
```

If the binary is not on `PATH`, `withVoidhash` warns and returns the Metro config
unchanged, so the dev server still starts.

## Commands

```sh
voidhash-cli init             # scaffold voidhash.config.ts
voidhash-cli auth login       # authenticate this machine
voidhash-cli auth status      # show who this machine is logged in as
voidhash-cli auth token       # print MCP connection headers for the current login
voidhash-cli auth logout      # drop the stored credentials
voidhash-cli types generate   # write voidhash.gen.d.ts
voidhash-cli types check      # fail if voidhash.gen.d.ts is stale
voidhash-cli config set       # change a stored CLI setting
voidhash-cli config reset     # restore the default CLI settings
```
