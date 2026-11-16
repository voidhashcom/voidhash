# Voidhash CLI

The Voidhash CLI manages your Voidhash projects from the terminal, in scripts and
in CI: end users and their access, products and perks, store connections,
paywalls and their locations, feature flags and experiments, analytics and ads,
webhooks, push notifications, your team and settings, generated types and
paywall components.

Full documentation, with every command and an example of each:
<https://voidhash.com/docs/setup/cli>.

## Installation

The package is published as `voidhash-cli`. For one-off commands, run it without
installing anything:

```sh
npx voidhash-cli --help
# or
pnpm dlx voidhash-cli --help
```

Isolated invocation keeps the CLI out of your app's dependency tree, so it can
never influence your bundle or your lockfile resolution.

Install it as a dev dependency when you run it often, and always when you use
the Metro plugin, which spawns `voidhash-cli types generate --watch` alongside
the Metro dev server and resolves the binary from `PATH`:

```sh
npm install --save-dev voidhash-cli
```

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withVoidhash } = require("@voidhash/react-native/metro");

module.exports = withVoidhash(getDefaultConfig(__dirname));
```

If the binary is not on `PATH`, `withVoidhash` warns and returns the Metro config
unchanged, so the dev server still starts.

## Getting started

```sh
voidhash login          # approve a code in your browser; the CLI then acts as you
voidhash init           # connect an app: voidhash.config.ts, client, generated types
voidhash status         # the project commands act on here, and what its setup still needs
voidhash mcp install    # add the Voidhash MCP server to your AI agents (no keys written)
```

Installed, the CLI answers to both `voidhash` and `voidhash-cli`.

## Commands

Commands read `voidhash <noun> <verb> [arguments] [flags]`; `--help` on any
command lists its verbs and flags. They are grouped as `voidhash --help` shows
them:

| Group                 | Commands                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Get started           | `init`, `login`, `logout`, `whoami`                                                                |
| Choose a project      | `status`, `link`, `unlink`, `switch`, `open`                                                       |
| Persons and access    | `person`                                                                                           |
| Catalog               | `product`, `perk`                                                                                  |
| Payments              | `provider`                                                                                         |
| Paywalls              | `paywall`, `location`                                                                              |
| Flags and experiments | `flag`, `experiment`                                                                               |
| Analytics and ads     | `events`, `insights`, `analytics`, `ads`                                                           |
| Your backend          | `webhook`                                                                                          |
| Messaging             | `push`                                                                                             |
| Team and settings     | `org`, `project`, `member`, `settings`, `domain`, `sandbox`, `key`, `audit`, `notices`, `feedback` |
| Paywall components    | `dev`, `new`, `publish`, `test`, `registry`                                                        |
| More                  | `types`, `mcp`, `api`, `auth`, `config`                                                            |

```sh
voidhash person why ada@example.com premium     # why someone has or lacks a perk
voidhash provider map com.acme.pro.annual pro-annual
voidhash paywall deploy pro
voidhash flag rollout new-checkout 50%
voidhash insights run mrr churn-rate --last 90d --compare
voidhash webhook deliveries --failed
```

`voidhash api list | describe | call` calls any API operation directly, for
scripts and for anything without a command yet.

## Generated types

`voidhash types generate` writes `voidhash.gen.d.ts` (or `typesOutput` in
`voidhash.config.ts`), which types an app's calls to the Voidhash SDKs it depends
on, read from the `package.json` in the current directory:

- `@voidhash/react-native`: product, perk and paywall location slugs, each
  product by its type, and feature flag keys and variant values.
- `@voidhash/web`: feature flag keys and variant values.

Without either dependency (or a `package.json`), it types `@voidhash/react-native`.
Flag keys leave archived flags out, and a flag's variant values are the text
values its variants have. `--watch` regenerates when the schema or the flags
change; it checks the flags every 30 seconds at most. `types check` compares only products, perks and locations, so
regenerate after changing flags. A flag or variant added since the file was
generated is not in its types, so keep a fallback branch for other values.

## Context, output and exit codes

- **Project.** A command acts on the project `--project` names, else the current
  directory's (from its `voidhash.config.ts`, or a `voidhash link`), else your
  default (`voidhash switch`), else the only project you can use. Links and the
  default are kept in `~/.voidhash`, not in the repository.
- **Credentials.** `login` stores its token in the system keychain (macOS
  Keychain, or the Secret Service through `secret-tool` on Linux), or else in
  `~/.config/voidhash/credentials.json` readable only by you, for the API
  origin it came from: its scheme, host and port, so another port or plain
  HTTP is another server. A token saved to the file because the keychain could
  not be written, as over SSH while it is locked, is used before the
  keychain's until a later `login` reaches the keychain. Profiles on the same
  server share its sign-in. In CI, set `VOIDHASH_API_KEY` (a project secret key)
  instead; `VOIDHASH_API_URL` and `VOIDHASH_PROFILE` choose the server and
  profile.
- **Names.** Give a slug, name, email, distinct id or id wherever a command
  takes something; an ambiguous name lists the candidates.
- **Prompts and confirmation.** In a terminal, a missing argument becomes a
  question, and commands that cannot be undone or change what end users get ask
  first. `--yes` confirms without asking. Without a terminal nothing is asked.
- **Output.** Tables on a terminal; `--json` prints the API objects and `-q`
  only ids. Color respects `NO_COLOR`.

| Exit code | Meaning                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| 0         | Done, or help printed                                                           |
| 1         | The command failed                                                              |
| 2         | Wrong usage: a missing, ambiguous or invalid argument, or a confirmation needed |
| 3         | Not signed in, or the stored key no longer works                                |
| 4         | Not found                                                                       |

## Paywall components

`dev`, `new`, `publish`, `test` and `registry` build, publish and share paywall
components written in Rust with `voidhash-ui`. See
<https://voidhash.com/docs/components/developing>.

## Shell completion

```sh
voidhash --completions zsh > "${fpath[1]}/_voidhash"
voidhash --completions bash >> ~/.bashrc
voidhash --completions fish > ~/.config/fish/completions/voidhash.fish
```
