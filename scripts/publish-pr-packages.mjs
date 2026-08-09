/**
 * Publishes per-commit tarballs of every publishable workspace package to
 * the pr-package service (alchemy's `@alchemy.run/pr-package` worker) at
 * pkg.voidha.sh, so any commit can be installed without publishing to
 * npm:
 *
 *   pnpm add @voidhash/node@https://pkg.voidha.sh/node/<short-sha>
 *
 * The pretty URL form relies on the deployment's `parseAliasUrl` mapping
 * `/<project>/<tag>`; the canonical form is
 * `https://<host>/projects/<project>/tags/<tag>`.
 *
 * For each package in PACKAGES it:
 *   1. rewrites package.json — suffixes the version with the short sha and
 *      pins `workspace:*` runtime/peer deps to pr-package URLs at the same
 *      sha (so installs of e.g. voidhash-cli resolve its private workspace
 *      deps to tarballs built from this very commit)
 *   2. runs the package's build (after the rewrite, so e.g. the CLI embeds
 *      the sha-suffixed version)
 *   3. `pnpm pack`s it (pnpm also resolves `catalog:` ranges at pack time)
 *   4. PUTs the tarball to the pr-package host, tagged with short sha, full
 *      sha, branch and (for PRs) `pr-<number>`
 *
 * Mutates package.json files in place — meant for a throwaway CI checkout.
 * Locally, use PR_PACKAGES_DRY_RUN=1 (skips upload) and `git restore` the
 * manifests afterwards.
 *
 * Environment:
 *   SHA                  (required) full commit sha the tarballs are built from
 *   BRANCH               (required) branch name, used as an install tag
 *   PR_NUMBER            (optional) adds a `pr-<number>` tag
 *   PR_PACKAGE_TOKEN     (required unless dry run) bearer token for the host
 *   PR_PACKAGE_HOST      (optional) pr-package host, default pkg.voidha.sh
 *   PR_PACKAGE_TTL       (optional) X-TTL header, e.g. "1 week" for PR builds
 *   PR_PACKAGES_DRY_RUN  (optional) "1" → rewrite/build/pack but skip upload
 *   COMMENT_FILE         (optional) where to write the PR comment markdown
 */

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import {
  Config,
  Console,
  Data,
  Effect,
  FileSystem,
  Path,
  Schema,
  SchemaGetter,
  SchemaTransformation,
} from "effect";
import { FetchHttpClient, HttpBody, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

/** Any failure that aborts the publish run with a non-zero exit code. */
class PublishError extends Data.TaggedError("PublishError") {}

// Ordered deps-first for readable logs; uploads don't depend on order since
// install URLs are resolved lazily, at install time.
//
// `internal: true` marks private packages that are published only so the
// rewritten workspace-dep URLs of the public packages resolve; they are left
// out of the PR comment.
const PACKAGES = [
  {
    dir: "packages/lib",
    name: "@voidhash/lib",
    project: "lib",
    build: false,
    internal: true,
  },
  {
    dir: "packages/generated-clients",
    name: "@voidhash/generated-clients",
    project: "generated-clients",
    build: false,
    internal: true,
  },
  {
    dir: "packages/shared",
    name: "@voidhash/shared",
    project: "shared",
    build: false,
    internal: true,
  },
  // Studio ships as source (src + index.html + vite.config.ts) that the CLI
  // drives through Vite at runtime, so it packs without a build.
  {
    dir: "apps/studio",
    name: "@voidhash/studio",
    project: "studio",
    build: false,
    internal: true,
  },
  {
    dir: "libraries/paywalls",
    name: "@voidhash/paywalls",
    project: "paywalls",
    build: true,
  },
  {
    dir: "libraries/node",
    name: "@voidhash/node",
    project: "node",
    build: true,
  },
  {
    dir: "libraries/web",
    name: "@voidhash/web",
    project: "web",
    build: true,
  },
  {
    dir: "apps/cli",
    name: "voidhash-cli",
    project: "cli",
    build: true,
  },
  {
    dir: "libraries/react-native",
    name: "@voidhash/react-native",
    project: "react-native",
    build: true,
  },
];

/** Manifests are round-tripped verbatim, so the parsed shape stays opaque. */
const decodeManifest = Schema.decodeUnknownEffect(Schema.UnknownFromJsonString);

/**
 * Re-serializes a manifest with the indentation the file already used, so the
 * rewrite touches only the fields this script changes.
 *
 * @param {string} indent
 */
const manifestJson = (indent) =>
  Schema.String.pipe(
    Schema.decodeTo(
      Schema.Unknown,
      new SchemaTransformation.Transformation(
        SchemaGetter.parseJson(),
        SchemaGetter.stringifyJson({ space: indent }),
      ),
    ),
  );

const encodeTags = Schema.encodeEffect(Schema.fromJsonString(Schema.Array(Schema.String)));

/**
 * Reads a required environment variable, aborting with the original one-line
 * message when it is unset or empty.
 *
 * @param {string} key
 */
const requireEnv = (key) =>
  Effect.gen(function* () {
    const value = yield* Config.string(key).pipe(Config.withDefault(""), Effect.orDie);
    if (!value) {
      yield* Console.error(`Missing required environment variable ${key}`);
      return yield* new PublishError({ message: `missing ${key}`, silent: true });
    }
    return value;
  });

/**
 * Reads an optional environment variable as a possibly-empty string.
 *
 * @param {string} key
 */
const optionalEnv = (key) => Config.string(key).pipe(Config.withDefault(""), Effect.orDie);

/**
 * Wraps an effect in GitHub Actions' collapsible log group markers, closing the
 * group even when the body fails.
 *
 * @param {string} title
 */
const group = (title, body) =>
  Effect.gen(function* () {
    yield* Console.log(`::group::${title}`);
    return yield* body;
  }).pipe(Effect.ensuring(Console.log("::endgroup::")));

/**
 * Runs a command with the parent's stdio attached, failing when it exits
 * non-zero — the behaviour `execFileSync` had by throwing.
 *
 * @param {ChildProcess.Command} command
 * @param {string} label
 */
const runInherit = (command, label) =>
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const code = yield* spawner
      .exitCode(command)
      .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
    if (Number(code) !== 0) {
      return yield* new PublishError({ message: `${label} failed with exit code ${code}` });
    }
  });

/** PR builds get an extra `pr-<number>` install tag; pushes to a branch do not. */
const prTags = (prNumber) => {
  if (!prNumber) return [];
  return [`pr-${prNumber}`];
};

/** The TTL header is only sent when configured, so the host applies its default. */
const ttlHeader = (ttl) => {
  if (!ttl) return {};
  return { "x-ttl": ttl };
};

/** Reported TTL in the success line — the host's default when none was set. */
const ttlLabel = (ttl) => {
  if (!ttl) return "default";
  return ttl;
};

/** The trailing "replace the sha" hint only makes sense for a PR build. */
const prHint = (prNumber) => {
  if (!prNumber) return [];
  return [
    `Replace the sha with \`pr-${prNumber}\` or the branch name to always get the latest build of this PR.`,
    "",
  ];
};

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fileSystem = yield* FileSystem.FileSystem;
  const client = yield* HttpClient.HttpClient;

  // The original `process.chdir`'d here; every path and child process is anchored
  // to the repo root explicitly instead.
  const scriptDirectory = path.dirname(yield* path.fromFileUrl(new URL(import.meta.url)));
  const repoRoot = path.resolve(scriptDirectory, "..");

  const dryRun = (yield* optionalEnv("PR_PACKAGES_DRY_RUN")) === "1";
  const sha = yield* requireEnv("SHA");
  const branch = yield* requireEnv("BRANCH");
  // Trim: the server does a strict `Bearer ${token}` string compare, so a
  // trailing newline in the GitHub secret (common when a token is piped in from
  // a file) would otherwise 401 every upload.
  const rawToken = yield* Effect.gen(function* () {
    if (dryRun) return yield* optionalEnv("PR_PACKAGE_TOKEN");
    return yield* requireEnv("PR_PACKAGE_TOKEN");
  });
  const token = rawToken.trim();
  const host = (yield* optionalEnv("PR_PACKAGE_HOST")) || "pkg.voidha.sh";
  const ttl = yield* optionalEnv("PR_PACKAGE_TTL");
  const prNumber = yield* optionalEnv("PR_NUMBER");

  const shortSha = sha.slice(0, 7);
  const tags = [shortSha, sha, branch, ...prTags(prNumber)];
  const installUrl = (pkg) => `https://${host}/${pkg.project}/${shortSha}`;

  const byName = new Map(PACKAGES.map((pkg) => [pkg.name, pkg]));

  // ── 1. Rewrite manifests ─────────────────────────────────────────────
  yield* group(
    `Rewrite manifests (version + workspace deps @ ${shortSha})`,
    Effect.gen(function* () {
      for (const pkg of PACKAGES) {
        const file = path.join(repoRoot, pkg.dir, "package.json");
        const raw = yield* fileSystem
          .readFileString(file)
          .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
        const manifest = yield* decodeManifest(raw).pipe(
          Effect.mapError(
            (cause) => new PublishError({ message: `${file} is not valid JSON`, cause }),
          ),
        );
        manifest.version = `${manifest.version}-${shortSha}`;

        // devDependencies are skipped: consumers never install them, and
        // `pnpm pack` substitutes their workspace ranges with local versions.
        for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
          for (const [depName, range] of Object.entries(manifest[field] ?? {})) {
            if (!range.startsWith("workspace:")) {
              continue;
            }
            const dep = byName.get(depName);
            if (!dep) {
              return yield* new PublishError({
                message: `${pkg.name} has workspace ${field} "${depName}" that is not in the pr-packages list — the published tarball would not install`,
              });
            }
            manifest[field][depName] = installUrl(dep);
          }
        }

        const indent = raw.match(/\n([ \t]+)"/)?.[1] ?? "  ";
        const serialized = yield* Schema.encodeEffect(manifestJson(indent))(manifest).pipe(
          Effect.mapError((cause) => new PublishError({ message: String(cause) })),
        );
        yield* fileSystem
          .writeFileString(file, `${serialized}\n`)
          .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
        yield* Console.log(`${pkg.name} → ${manifest.version}`);
      }
    }),
  );

  // ── 2. Build ─────────────────────────────────────────────────────────
  for (const pkg of PACKAGES) {
    if (!pkg.build) {
      continue;
    }
    yield* group(
      `Build ${pkg.name}`,
      runInherit(
        ChildProcess.make("pnpm", ["--filter", pkg.name, "run", "build"], {
          cwd: repoRoot,
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        }),
        `build of ${pkg.name}`,
      ),
    );
  }

  // ── 3. Pack + upload ─────────────────────────────────────────────────
  for (const pkg of PACKAGES) {
    yield* group(
      `Publish ${pkg.name}`,
      Effect.gen(function* () {
        const destination = yield* fileSystem
          .makeTempDirectory({ prefix: "pr-packages-" })
          .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
        yield* runInherit(
          ChildProcess.make("pnpm", ["pack", "--pack-destination", destination], {
            cwd: path.join(repoRoot, pkg.dir),
            stdin: "inherit",
            stdout: "inherit",
            stderr: "inherit",
          }),
          `pnpm pack of ${pkg.name}`,
        );
        const entries = yield* fileSystem
          .readDirectory(destination)
          .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
        const tarball = entries.find((f) => f.endsWith(".tgz"));
        if (!tarball) {
          return yield* new PublishError({
            message: `pnpm pack produced no tarball for ${pkg.name}`,
          });
        }

        const encodedTags = yield* encodeTags(tags).pipe(
          Effect.mapError((cause) => new PublishError({ message: String(cause) })),
        );

        if (dryRun) {
          return yield* Console.log(
            `[dry run] would upload ${tarball} to ${installUrl(pkg)} with tags ${encodedTags}`,
          );
        }

        const body = yield* fileSystem
          .readFile(path.join(destination, tarball))
          .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));

        const response = yield* client
          .execute(
            HttpClientRequest.put(`https://${host}/projects/${pkg.project}/packages`, {
              headers: {
                authorization: `Bearer ${token}`,
                "x-tags": encodedTags,
                ...ttlHeader(ttl),
              },
              body: HttpBody.uint8Array(body, "application/gzip"),
            }),
          )
          .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));

        if (response.status < 200 || response.status >= 300) {
          const detail = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
          return yield* new PublishError({
            message: `Upload of ${pkg.name} failed: ${response.status}\n${detail}`,
          });
        }

        yield* Console.log(
          `Published ${installUrl(pkg)} (tags: ${tags.join(", ")}, ttl: ${ttlLabel(ttl)})`,
        );
      }),
    );
  }

  // ── 4. Install instructions (PR comment / step summary) ──────────────
  const lines = ["<!-- pr-packages -->", "", `Install the packages built from ${shortSha}:`, ""];
  for (const pkg of PACKAGES) {
    if (pkg.internal) {
      continue;
    }
    lines.push(`**${pkg.name}**`, "```sh", `pnpm add ${pkg.name}@${installUrl(pkg)}`, "```", "");
  }
  lines.push(
    "Internal workspace deps (lib, generated-clients, shared, studio) are published at the same sha and resolved automatically.",
    "",
    ...prHint(prNumber),
  );
  const body = lines.join("\n");

  const commentFile = yield* optionalEnv("COMMENT_FILE");
  if (commentFile) {
    yield* fileSystem.writeFileString(commentFile, body).pipe(Effect.orDie);
  }
  const stepSummary = yield* optionalEnv("GITHUB_STEP_SUMMARY");
  if (stepSummary) {
    yield* fileSystem.writeFileString(stepSummary, body, { flag: "a" }).pipe(Effect.orDie);
  }
  yield* Console.log(body);
});

/** Prints the failure as one line, unless it was already reported in full. */
const reportFailure = (error) =>
  Effect.gen(function* () {
    if (!error.silent) yield* Console.error(`publish-pr-packages: ${error.message}`);
    return yield* Effect.fail(error);
  });

// Error reporting stays off so a failure prints only the single line above, and
// `runMain` still exits non-zero on the tagged failure.
NodeRuntime.runMain(
  program.pipe(
    Effect.catch(reportFailure),
    Effect.provide([NodeServices.layer, FetchHttpClient.layer]),
  ),
  { disableErrorReporting: true },
);
