# Voidhash CLI

The Voidhash CLI manages your Voidhash projects from the terminal, in scripts and
in CI: end users and their access, products and perks, store connections,
paywalls and their locations, feature flags and experiments, analytics and ads,
webhooks, push notifications, your team and settings, generated types and
paywall components.

Full documentation, with every command and an example of each:
<https://voidhash.com/docs/cli>.

## Installation

The CLI is self-contained, for macOS, Linux and Windows. Install it whichever
way suits your project; none of them needs the others.

**npm**, for JavaScript and React Native projects. Run it without installing
anything, or add it as a dev dependency so everyone on the project runs the
same version:

```sh
npx voidhash-cli                      # in your app's directory: opens the screen
npm install --save-dev voidhash-cli
```

The `voidhash-cli` package is a small launcher; the program itself comes from an
optional package for your platform, `@voidhash/cli-<os>-<cpu>`, which your
package manager picks. If you install with optional dependencies turned off
(`--omit=optional`, `--no-optional`), add that package yourself; the launcher
names it when it is missing.

**Homebrew**, on macOS and Linux:

```sh
brew install voidhashcom/tap/voidhash
```

**Install script**, on macOS and Linux. It downloads the release for your
computer, checks it against the release's checksums and puts `voidhash` in
`/usr/local/bin` when you can write there, otherwise in `~/.local/bin`:

```sh
curl -fsSL https://raw.githubusercontent.com/voidhashcom/voidhash/main/apps/cli/scripts/install.sh | sh
```

Set `VOIDHASH_VERSION` to install a specific version and `VOIDHASH_INSTALL_DIR`
to choose the directory. The script never asks for more rights than you run it
with. On Windows, in PowerShell:

```powershell
irm https://raw.githubusercontent.com/voidhashcom/voidhash/main/apps/cli/scripts/install.ps1 | iex
```

That script puts `voidhash.exe` in `%LOCALAPPDATA%\Programs\voidhash` and reads the
same two variables.

**Direct download.** Every [release](https://github.com/voidhashcom/voidhash/releases)
has an archive per platform, `voidhash_<version>_<os>_<arch>.tar.gz` (`.zip`
for Windows), and a `checksums.txt` with their SHA-256 sums. Unpack it and move
`voidhash` to a directory on your `PATH`. The Linux builds are static and run
on glibc and musl systems alike.

Installed with npm, the CLI answers to both `voidhash` and `voidhash-cli`;
otherwise to `voidhash`.

### With React Native

The Metro plugin runs `voidhash-cli types generate --watch` alongside the Metro
dev server and finds `voidhash-cli` on `PATH`, so install the npm package as a
dev dependency:

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withVoidhash } = require("@voidhash/react-native/metro");

module.exports = withVoidhash(getDefaultConfig(__dirname));
```

If it is not on `PATH`, the plugin warns and the dev server still starts. To use
a CLI installed another way, pass `{ cliBinary: "voidhash" }`.

## Getting started

Run `voidhash` in your app's directory. On a terminal it opens a screen that knows
where you are: it signs you in, asks which project the directory is, and sets the app
up with a coding agent. Once the directory has a project, the same screen shows the
project's setup and live events, and lets you copy its publishable keys and manage its
perks, paywall locations and webhooks. `ctrl+p` searches every command.

Off a terminal, `voidhash` prints the help; `VOIDHASH_NO_TUI=1` does the same on one.
So does a Linux without glibc, such as Alpine, where the screen does not run.
Everything the screen does is also a command:

```sh
voidhash login          # approve a code in your browser; the CLI then acts as you
voidhash init           # connect an app: voidhash.json, client, generated types
voidhash integrate      # or: add Voidhash to the app's code too, with a coding agent
voidhash status         # the project commands act on here, and what its setup still needs
voidhash mcp install    # add the Voidhash MCP server to your AI agents (no keys written)
```

## Integrate with a coding agent

`voidhash integrate`, run in an app's root, takes it from no Voidhash to an
integration that builds:

1. The CLI does what needs no reading of your code. It detects the kind of app
   and its package manager, signs you in, chooses or creates the project,
   creates the perk and product you ask for, installs the SDK, and writes
   `voidhash.json`, the SDK client or environment values, and the generated
   types.
2. A coding agent you already have (Claude Code, Codex, OpenCode, Grok Build,
   Cursor or fx) wires the SDK into your code: where the app starts, where the
   user signs in, where access is decided. It runs without its own interface
   and on your own account, runs your project's checks and installs nothing,
   and is kept to the app's directory and off `.env` files as far as that
   agent can be; the plan says how far. Its task is written to
   `.voidhash/integrate/task.md` first.
3. The CLI checks the result itself: your typecheck or build must pass, the SDK
   must be in your code, and with `--wait` the app's first event must arrive.
   The summary lists the files git shows as changed and what is left for you.

```sh
voidhash integrate                       # asks what it needs, shows the plan first
voidhash integrate --dry-run             # the plan only
voidhash integrate --model sonnet        # the agent's model, named as that agent names it
voidhash integrate --agent none          # write the task for any agent, or for you
voidhash integrate --project acme/app --perk premium --product pro_monthly --yes --json
```

It needs a clean git working tree (`--allow-dirty` lifts that) and commits
nothing. Run it again at any time: it repeats nothing that is done, and an
interrupted agent continues its earlier conversation. `--restart` forgets the
earlier run.

Expo, Next.js and React with Vite are supported. React Native without Expo,
other Vite sites, Node.js servers, and iOS and Android apps are best effort:
the same steps, with less set up and checked for you. See
<https://voidhash.com/docs/cli/integrate>.

A platform is a description, not code: a JSON file in
`internal/integrate/platforms` says how the platform is detected, which
packages, files and environment values it gets, which checks apply and what
stays with the person, and names the Markdown guide the agent's task is built
from. A coding agent is an implementation of `integrate.Agent`
(`internal/integrate/agent.go`). One that speaks the Agent Client Protocol is
a line in `acpAgents` (`internal/integrate/acp.go`): how it is started so that
it asks before it acts. The CLI answers every such agent by the same rules.
Before adding one, run it on a scratch project and check what it asks about:
agents differ in what they ask, and in where they name the file or command.

## voidhash.json

`voidhash.json`, in your app's root, names the project the app is built for and
the type files to generate for it. Commit it.

```json
{
  "team": "acme",
  "project": "app",
  "types": [
    { "language": "typescript", "output": "voidhash.gen.d.ts" },
    { "language": "swift", "output": "App/VoidhashTypes.swift" },
    { "language": "kotlin", "output": "app/src/main/java/com/acme/app/VoidhashTypes.kt" }
  ]
}
```

| Field     | What it is                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------- |
| `team`    | The slug of the organization that owns the project.                                               |
| `project` | The project's slug.                                                                               |
| `types`   | The files `voidhash types generate` writes. Without it, one TypeScript file, `voidhash.gen.d.ts`. |

Each `types` entry has a `language` (`typescript`, `swift` or `kotlin`) and an
`output` path relative to `voidhash.json`. A Kotlin entry may name its
`package`; otherwise the package follows from the path below a `java` or
`kotlin` source directory, and a file outside one declares no package.

| Language     | What the file holds                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `typescript` | A declaration file that types the product, location and perk slugs the React Native SDK takes.                                                         |
| `swift`      | The enums `VoidhashProductSlug`, `VoidhashLocationSlug` and `VoidhashPerkSlug`, with a case per slug. Pass a case's `rawValue` to the SDK.             |
| `kotlin`     | The enum classes `VoidhashProductSlug`, `VoidhashLocationSlug` and `VoidhashPerkSlug`, with a constant per slug. Pass a constant's `value` to the SDK. |

A slug that is not a name in the language is spelled as one: `pro-monthly` is
`proMonthly` in Swift and `PRO_MONTHLY` in Kotlin.

`voidhash types generate` writes every file, and `voidhash types check` fails
when a committed one is behind the project, which suits CI. `voidhash init`
writes `voidhash.json` for you. In an Xcode project or Swift package it adds
the Swift file, and in a Gradle project the Kotlin file; in a terminal it asks
first.

### Migrating from voidhash.config.ts

Earlier versions of the CLI wrote a `voidhash.config.ts` (or `.js`, `.cjs`,
`.mjs`) that imported `defineConfig` from `voidhash-cli`. The CLI still reads
such a file, as text and without running it, when it exports an object of
plain strings: `export default defineConfig({ … })`, the same without
`defineConfig`, or `module.exports = { … }`. A computed value, such as an
environment variable or a function call, can't be read that way; the command
then fails and prints the `voidhash.json` to write instead. The `voidhash-cli`
package still exports `defineConfig`, now deprecated.

To move over, write the same values to `voidhash.json` and delete the old file,
or run `voidhash init` again, which does both:

```ts
// voidhash.config.ts
export default defineConfig({ team: "acme", project: "app", typesOutput: "src/voidhash.gen.d.ts" });
```

```json
{
  "team": "acme",
  "project": "app",
  "types": [{ "language": "typescript", "output": "src/voidhash.gen.d.ts" }]
}
```

When both files exist, `voidhash.json` is used, and the CLI warns if they name
different projects. `voidhash.json` also still accepts `typesOutput` in place
of `types`, for one TypeScript file.

## Commands

Commands read `voidhash <noun> <verb> [arguments] [flags]`; `--help` on any
command lists its verbs and flags. They are grouped as `voidhash --help` shows
them:

| Group                 | Commands                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Get started           | `init`, `integrate`, `login`, `logout`, `whoami`                                                   |
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
  directory's (from its `voidhash.json`, or a `voidhash link`), else your
  default (`voidhash switch`), else the only project you can use. Links and the
  default are kept in `~/.voidhash`, not in the repository.
- **Credentials.** `login` stores its token in the system keychain (macOS
  Keychain, or the Secret Service through `secret-tool` on Linux), or else in
  `~/.config/voidhash/credentials.json` (`%APPDATA%\voidhash\credentials.json`
  on Windows) readable only by you, for the API origin it came from: its
  scheme, host and port, so another port or plain HTTP is another server. A token saved to the file because the keychain could
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
  only ids. Results go to standard output; errors, warnings, notes and
  questions go to standard error, so a pipe gets only the result. `--no-color`
  or `NO_COLOR` prints without colors.

| Exit code | Meaning                                                                         |
| --------- | ------------------------------------------------------------------------------- |
| 0         | Done, or help printed                                                           |
| 1         | The command failed                                                              |
| 2         | Wrong usage: a missing, ambiguous or invalid argument, or a confirmation needed |
| 3         | Not signed in, or the stored key no longer works                                |
| 4         | Not found                                                                       |
| 130       | Interrupted with Ctrl+C                                                         |

## Paywall components

`dev`, `new`, `publish`, `test` and `registry` build, publish and share paywall
components written in Rust with `voidhash-ui`. See
<https://voidhash.com/docs/components/developing>.

## Shell completion

`voidhash completion <shell>` prints a completion script for `bash`, `zsh`,
`fish` or `powershell`; `voidhash completion <shell> --help` says how to load
it. Homebrew installs the bash, zsh and fish scripts for you, and the release
archives carry those three in `completions/`.

```sh
voidhash completion zsh > "${fpath[1]}/_voidhash"
voidhash completion bash > ~/.local/share/bash-completion/completions/voidhash
voidhash completion fish > ~/.config/fish/completions/voidhash.fish
```

## Developing

The CLI is written in Go and builds with the toolchain `go.mod` names; a recent
Go downloads it by itself.

```sh
go build -o bin/voidhash ./cmd/voidhash   # or: pnpm build
go vet ./...
```

The screen `voidhash` opens on a terminal is a program of its own, in
`../cli-tui`: TypeScript drawn with [OpenTUI](https://github.com/anomalyco/opentui).
The CLI starts it and answers what it asks over a local connection, so the screen
holds no logic of its own. `pnpm build` there compiles it to `bin/voidhash-tui`,
beside the CLI's binary, which is where the CLI looks for it; without it,
`voidhash` prints the help. To work on the screen without compiling, point the
CLI at its source:

```sh
VOIDHASH_TUI=../cli-tui/src/main.tsx bin/voidhash   # runs it with bun
```

`npm/` holds the npm launcher. In a source checkout it runs the binary in
`bin/`, so `pnpm exec voidhash` works after a build.

`internal/cli/testdata/help` holds the `--help` output of every command, one
file per command, which is the quickest place to read or search them.

`node scripts/release.mjs <version>` builds a release into `dist/release`
without publishing anything: the archive of every platform with the binary, the
screen, the license, this file and the completion scripts; `checksums.txt`; the
Homebrew formula `voidhash.rb`; and, under `npm/`, the launcher and platform
packages ready for `npm publish`. It compiles the screen for every platform, so
it needs Bun 1.4 or later and the workspace's dependencies installed. The same
sources, version, Go toolchain and Bun produce the same files.
