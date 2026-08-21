/**
 * Publishes per-commit tarballs of every publishable workspace package to
 * the pr-package service (alchemy's `@alchemy.run/pr-package` worker) at
 * pkg.voidha.sh, so any commit can be installed without publishing to
 * npm:
 *
 *   pnpm add @voidhash/node@https://pkg.voidha.sh/node/<short-sha>
 *
 * The pretty URL form relies on the deployment's `parseAliasUrl` mapping
 * `/<project>/<tag>`, which only recognizes a single-segment tag; the canonical
 * form `https://<host>/projects/<project>/tags/<tag>` (url-encoded) accepts any
 * tag and is what this script uses for slash-bearing tags such as branch names.
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
 * Every PUT repoints the moving tags (branch, `pr-<number>`) on its own, so a
 * failure part-way through the loop would leave e.g. `react-native@main` on an
 * older commit than `node@main`. To make that loud rather than silent, once all
 * uploads are done it:
 *   5. re-resolves every tag it just wrote and fails the run unless each one
 *      serves this run's upload — the failure names the diverged packages and a
 *      re-run heals the tags
 *   6. publishes the verified set as its own `release-manifest` package, so
 *      `https://<host>/release-manifest/<short-sha>` is an immutable record of
 *      which versions belong together and `.../release-manifest/<branch>`
 *      always describes the newest fully verified set
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

/**
 * The release manifest is generated rather than built from the workspace, so it
 * has no `dir` and never goes through the manifest-rewrite phase. It is
 * uploaded last, after the consistency check, so its presence at a tag means
 * every package at that tag was verified.
 */
const RELEASE_MANIFEST = {
  name: "@voidhash/release-manifest",
  project: "release-manifest",
};

/** Manifests are round-tripped verbatim, so the parsed shape stays opaque. */
const decodeManifest = Schema.decodeUnknownEffect(Schema.UnknownFromJsonString);

/**
 * The upload receipt carries the resource id the host minted for the tarball —
 * the only value that distinguishes this run's upload from an older one still
 * holding a tag.
 */
const decodeReceipt = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Struct({ resourceId: Schema.String })),
);

/** Canonical resource path the host redirects a tag to, e.g. `/projects/node/packages/<uuid>`. */
const RESOURCE_PATH = /\/projects\/[^/]+\/packages\/([^/?#]+)$/;

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

/**
 * `pnpm pack`s a directory into a fresh temp directory and returns the absolute
 * path of the tarball it produced.
 *
 * @param {string} directory
 * @param {string} label
 */
const packDirectory = (directory, label) =>
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const fileSystem = yield* FileSystem.FileSystem;

    const destination = yield* fileSystem
      .makeTempDirectory({ prefix: "pr-packages-" })
      .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
    yield* runInherit(
      ChildProcess.make("pnpm", ["pack", "--pack-destination", destination], {
        cwd: directory,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }),
      `pnpm pack of ${label}`,
    );

    const entries = yield* fileSystem
      .readDirectory(destination)
      .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
    const tarball = entries.find((f) => f.endsWith(".tgz"));
    if (!tarball) {
      return yield* new PublishError({ message: `pnpm pack produced no tarball for ${label}` });
    }
    return path.join(destination, tarball);
  });

/**
 * PUTs a tarball to the pr-package host and returns the resource id the host
 * minted for it, which every tag in `tags` now points at.
 */
const uploadTarball = ({ file, host, label, project, tags, token, ttl }) =>
  Effect.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const client = yield* HttpClient.HttpClient;

    const encodedTags = yield* encodeTags(tags).pipe(
      Effect.mapError((cause) => new PublishError({ message: String(cause) })),
    );
    const body = yield* fileSystem
      .readFile(file)
      .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));

    const response = yield* client
      .execute(
        HttpClientRequest.put(`https://${host}/projects/${project}/packages`, {
          headers: {
            authorization: `Bearer ${token}`,
            "x-tags": encodedTags,
            ...ttlHeader(ttl),
          },
          body: HttpBody.uint8Array(body, "application/gzip"),
        }),
      )
      .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));

    const detail = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
    if (response.status < 200 || response.status >= 300) {
      return yield* new PublishError({
        message: `Upload of ${label} failed: ${response.status}\n${detail}`,
      });
    }

    const receipt = yield* decodeReceipt(detail).pipe(
      Effect.mapError(
        () =>
          new PublishError({
            message: `Upload of ${label} returned no resource id: ${detail}`,
          }),
      ),
    );
    return receipt.resourceId;
  });

/**
 * Canonical tag route on the host — the one the worker decodes itself:
 * `decodeURIComponent(subPath.slice("/tags/".length))`. The pretty
 * `/<project>/<tag>` alias is parsed by splitting the path on `/`, so it only
 * recognizes a two-segment path (three when the first is `@scoped`); a branch
 * tag containing a slash never matches it and 404s.
 */
const canonicalTagUrl = (host, project, tag) =>
  `https://${host}/projects/${encodeURIComponent(project)}/tags/${encodeURIComponent(tag)}`;

/**
 * Resolves a tag to the resource id it currently serves, by walking the host's
 * redirect chain (`/projects/<project>/tags/<tag>` →
 * `/projects/<project>/packages/<id>`) by hand and stopping at the last
 * redirect. Letting fetch follow the chain would download the whole tarball and
 * hide the resource id, which is exactly the value that tells this run's upload
 * apart from an earlier one.
 *
 * Goes through {@link canonicalTagUrl} rather than the pretty alias so branch
 * names with a slash — the convention here — resolve like any other tag.
 */
const resolveTagResource = (host, project, tag) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    let url = canonicalTagUrl(host, project, tag);
    for (let hop = 0; hop < 4; hop++) {
      const response = yield* client
        .execute(HttpClientRequest.get(url))
        .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
      const location = response.headers.location;
      if (response.status < 300 || response.status >= 400 || !location) {
        return yield* new PublishError({
          message: `${project}@${tag} did not resolve to a package (${response.status} at ${url})`,
        });
      }
      const next = new URL(location, url).toString();
      const resource = RESOURCE_PATH.exec(new URL(next).pathname);
      if (resource) {
        return resource[1];
      }
      url = next;
    }
    return yield* new PublishError({
      message: `${project}@${tag} redirected too many times`,
    });
  }).pipe(Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }));

/**
 * Fetches the immutable resource URL a tag points at and fails unless the host
 * actually serves bytes for it — proves the tarball survived the upload, not
 * just that the tag index was written.
 */
const verifyResourceServed = (host, project, resourceId) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;

    const url = `https://${host}/projects/${project}/packages/${resourceId}`;
    const response = yield* client
      .execute(HttpClientRequest.get(url))
      .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
    if (response.status !== 200) {
      return yield* new PublishError({ message: `${url} returned ${response.status}` });
    }
    const bytes = yield* response.arrayBuffer.pipe(
      Effect.mapError((cause) => new PublishError({ message: String(cause) })),
    );
    if (bytes.byteLength === 0) {
      return yield* new PublishError({ message: `${url} served an empty tarball` });
    }
    return bytes.byteLength;
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

/** Names the tags this run repointed, for the comment's "pin the sha instead" warning. */
const movingTags = (branch, prNumber) => {
  if (!prNumber) return `The \`${branch}\` tag moves`;
  return `The \`${branch}\` and \`pr-${prNumber}\` tags move`;
};

/**
 * Pretty `/<project>/<tag>` install URLs are matched by splitting the path, so
 * only a tag without a `/` can be substituted into one. Branch names with a
 * slash are still published as tags — they just need the canonical route.
 */
const isAliasSafeTag = (tag) => !tag.includes("/");

/**
 * The trailing "replace the sha" hint only makes sense for a PR build, and it
 * only offers the branch name when that name works in a pretty install URL.
 */
const prHint = (prNumber, branch, host) => {
  if (!prNumber) return [];
  if (!isAliasSafeTag(branch)) {
    return [
      `Replace the sha with \`pr-${prNumber}\` to always get the latest build of this PR. The \`${branch}\` tag is published too, but a branch name containing \`/\` only resolves through the canonical form \`https://${host}/projects/<project>/tags/<url-encoded tag>\`.`,
      "",
    ];
  }
  return [
    `Replace the sha with \`pr-${prNumber}\` or \`${branch}\` to always get the latest build of this PR.`,
    "",
  ];
};

const program = Effect.gen(function* () {
  const path = yield* Path.Path;
  const fileSystem = yield* FileSystem.FileSystem;

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
  /** Sha-suffixed version of each package, filled in by the rewrite phase. */
  const versions = new Map();
  /** Resource id the host minted for each package, filled in by the upload phase. */
  const resourceIds = new Map();

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
        versions.set(pkg.name, manifest.version);

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
        const file = yield* packDirectory(path.join(repoRoot, pkg.dir), pkg.name);

        if (dryRun) {
          return yield* Console.log(
            `[dry run] would upload ${path.basename(file)} to ${installUrl(pkg)} with tags ${tags.join(", ")}`,
          );
        }

        const resourceId = yield* uploadTarball({
          file,
          host,
          label: pkg.name,
          project: pkg.project,
          tags,
          token,
          ttl,
        });
        resourceIds.set(pkg.name, resourceId);

        yield* Console.log(
          `Published ${installUrl(pkg)} (tags: ${tags.join(", ")}, ttl: ${ttlLabel(ttl)})`,
        );
      }),
    );
  }

  // ── 4. Verify the release set ────────────────────────────────────────
  // Each PUT repoints the moving tags on its own, so a failure part-way through
  // the previous loop silently leaves them straddling two commits. Re-resolving
  // every tag here turns that into a red run, and re-running the workflow heals
  // the tags.
  yield* group(
    "Verify published tags",
    Effect.gen(function* () {
      if (dryRun) {
        return yield* Console.log("[dry run] skipping tag verification — nothing was uploaded");
      }

      const diverged = [];
      for (const pkg of PACKAGES) {
        const expected = resourceIds.get(pkg.name);
        for (const tag of tags) {
          const actual = yield* resolveTagResource(host, pkg.project, tag);
          if (actual !== expected) {
            diverged.push(`${pkg.project}@${tag} serves ${actual}, expected ${expected}`);
          }
        }
      }

      // Reported before the per-resource fetch below: a concurrent run that
      // repointed every tag of a package orphans this run's tarball, so asking
      // the host for it would die with a bare 404 instead of the divergence
      // that actually explains the failure.
      if (diverged.length > 0) {
        return yield* new PublishError({
          message: `The published set is inconsistent — re-run this workflow to heal the tags:\n${diverged.join("\n")}`,
        });
      }

      for (const pkg of PACKAGES) {
        const expected = resourceIds.get(pkg.name);
        const size = yield* verifyResourceServed(host, pkg.project, expected);
        yield* Console.log(`${pkg.project}: ${tags.length} tags → ${expected} (${size} bytes)`);
      }
    }),
  );

  // ── 5. Release manifest ──────────────────────────────────────────────
  // Uploaded last and under the same tags, so `release-manifest/<branch>`
  // describes the newest fully verified set and `release-manifest/<sha>` is an
  // immutable record of which versions belong together.
  const releaseManifest = {
    sha,
    shortSha,
    branch,
    // oxlint-disable-next-line effect/noGlobals -- the manifest records when this publish actually ran, so it must be the real wall clock; a test-controllable Clock would defeat the purpose of the field.
    publishedAt: new Date().toISOString(),
    packages: PACKAGES.map((pkg) => ({
      name: pkg.name,
      project: pkg.project,
      version: versions.get(pkg.name),
      url: installUrl(pkg),
    })),
  };
  const releaseManifestJson = yield* Schema.encodeEffect(manifestJson("  "))(releaseManifest).pipe(
    Effect.mapError((cause) => new PublishError({ message: String(cause) })),
  );

  yield* group(
    `Publish ${RELEASE_MANIFEST.name}`,
    Effect.gen(function* () {
      const directory = yield* fileSystem
        .makeTempDirectory({ prefix: "pr-packages-manifest-" })
        .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
      const packageJson = yield* Schema.encodeEffect(manifestJson("  "))({
        name: RELEASE_MANIFEST.name,
        version: `0.0.1-alpha.1-${shortSha}`,
        private: false,
        description: `Record of the voidhash package set published from ${sha}.`,
        license: "MIT",
        files: ["manifest.json"],
      }).pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));

      yield* fileSystem
        .writeFileString(path.join(directory, "package.json"), `${packageJson}\n`)
        .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));
      yield* fileSystem
        .writeFileString(path.join(directory, "manifest.json"), `${releaseManifestJson}\n`)
        .pipe(Effect.mapError((cause) => new PublishError({ message: String(cause) })));

      const file = yield* packDirectory(directory, RELEASE_MANIFEST.name);

      if (dryRun) {
        return yield* Console.log(
          `[dry run] would upload ${path.basename(file)} to ${installUrl(RELEASE_MANIFEST)} with tags ${tags.join(", ")}\n${releaseManifestJson}`,
        );
      }

      yield* uploadTarball({
        file,
        host,
        label: RELEASE_MANIFEST.name,
        project: RELEASE_MANIFEST.project,
        tags,
        token,
        ttl,
      });
      yield* Console.log(`Published ${installUrl(RELEASE_MANIFEST)}`);
    }),
  );

  // ── 6. Install instructions (PR comment / step summary) ──────────────
  const internalProjects = PACKAGES.filter((pkg) => pkg.internal).map((pkg) => pkg.project);
  const lines = ["<!-- pr-packages -->", "", `Install the packages built from ${shortSha}:`, ""];
  for (const pkg of PACKAGES) {
    if (pkg.internal) {
      continue;
    }
    lines.push(`**${pkg.name}**`, "```sh", `pnpm add ${pkg.name}@${installUrl(pkg)}`, "```", "");
  }
  lines.push(
    `Internal workspace deps (${internalProjects.join(", ")}) are published at the same sha and resolved automatically.`,
    "",
    ...prHint(prNumber, branch, host),
    "**For production lockfiles, pin these immutable sha URLs.**",
    "",
    `${movingTags(branch, prNumber)} to the newest verified build on every run; the sha URLs above never change. The full set verified for this commit is recorded at ${installUrl(RELEASE_MANIFEST)}:`,
    "",
    "<details><summary>manifest.json</summary>",
    "",
    "```json",
    releaseManifestJson,
    "```",
    "",
    "</details>",
    "",
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
