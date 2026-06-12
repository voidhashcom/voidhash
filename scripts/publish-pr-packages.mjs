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

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

// Ordered deps-first for readable logs; uploads don't depend on order since
// install URLs are resolved lazily, at install time.
//
// `internal: true` marks private packages that are published only so the
// rewritten workspace-dep URLs of the public packages resolve; they are left
// out of the PR comment.
const PACKAGES = [
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

const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required environment variable ${key}`);
    process.exit(1);
  }
  return value;
};

const dryRun = process.env.PR_PACKAGES_DRY_RUN === "1";
const sha = requireEnv("SHA");
const branch = requireEnv("BRANCH");
// Trim: the server does a strict `Bearer ${token}` string compare, so a
// trailing newline in the GitHub secret (common when a token is piped in from
// a file) would otherwise 401 every upload.
const token = (
  dryRun ? process.env.PR_PACKAGE_TOKEN : requireEnv("PR_PACKAGE_TOKEN")
)?.trim();
const host = process.env.PR_PACKAGE_HOST || "pkg.voidha.sh";
const ttl = process.env.PR_PACKAGE_TTL || "";
const prNumber = process.env.PR_NUMBER || "";

const shortSha = sha.slice(0, 7);
const tags = [shortSha, sha, branch, ...(prNumber ? [`pr-${prNumber}`] : [])];
const installUrl = (pkg) => `https://${host}/${pkg.project}/${shortSha}`;

const byName = new Map(PACKAGES.map((pkg) => [pkg.name, pkg]));

const group = (title, fn) => {
  console.log(`::group::${title}`);
  try {
    return fn();
  } finally {
    console.log("::endgroup::");
  }
};

// ── 1. Rewrite manifests ─────────────────────────────────────────────
group(`Rewrite manifests (version + workspace deps @ ${shortSha})`, () => {
  for (const pkg of PACKAGES) {
    const file = path.join(pkg.dir, "package.json");
    const raw = fs.readFileSync(file, "utf8");
    const manifest = JSON.parse(raw);
    manifest.version = `${manifest.version}-${shortSha}`;

    // devDependencies are skipped: consumers never install them, and
    // `pnpm pack` substitutes their workspace ranges with local versions.
    for (const field of [
      "dependencies",
      "optionalDependencies",
      "peerDependencies",
    ]) {
      for (const [depName, range] of Object.entries(manifest[field] ?? {})) {
        if (!range.startsWith("workspace:")) {
          continue;
        }
        const dep = byName.get(depName);
        if (!dep) {
          throw new Error(
            `${pkg.name} has workspace ${field} "${depName}" that is not in the pr-packages list — the published tarball would not install`,
          );
        }
        manifest[field][depName] = installUrl(dep);
      }
    }

    const indent = raw.match(/\n([ \t]+)"/)?.[1] ?? "  ";
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, indent)}\n`);
    console.log(`${pkg.name} → ${manifest.version}`);
  }
});

// ── 2. Build ─────────────────────────────────────────────────────────
for (const pkg of PACKAGES) {
  if (!pkg.build) {
    continue;
  }
  group(`Build ${pkg.name}`, () => {
    execFileSync("pnpm", ["--filter", pkg.name, "run", "build"], {
      stdio: "inherit",
    });
  });
}

// ── 3. Pack + upload ─────────────────────────────────────────────────
for (const pkg of PACKAGES) {
  await group(`Publish ${pkg.name}`, async () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), "pr-packages-"));
    execFileSync("pnpm", ["pack", "--pack-destination", destination], {
      cwd: pkg.dir,
      stdio: "inherit",
    });
    const tarball = fs.readdirSync(destination).find((f) => f.endsWith(".tgz"));
    if (!tarball) {
      throw new Error(`pnpm pack produced no tarball for ${pkg.name}`);
    }

    if (dryRun) {
      console.log(
        `[dry run] would upload ${tarball} to ${installUrl(pkg)} with tags ${JSON.stringify(tags)}`,
      );
      return;
    }

    const response = await fetch(
      `https://${host}/projects/${pkg.project}/packages`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "x-tags": JSON.stringify(tags),
          ...(ttl ? { "x-ttl": ttl } : {}),
          "content-type": "application/gzip",
        },
        body: fs.readFileSync(path.join(destination, tarball)),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Upload of ${pkg.name} failed: ${response.status} ${response.statusText}\n${await response.text()}`,
      );
    }
    console.log(
      `Published ${installUrl(pkg)} (tags: ${tags.join(", ")}, ttl: ${ttl || "default"})`,
    );
  });
}

// ── 4. Install instructions (PR comment / step summary) ──────────────
const lines = [
  "<!-- pr-packages -->",
  "",
  `Install the packages built from ${shortSha}:`,
  "",
];
for (const pkg of PACKAGES) {
  if (pkg.internal) {
    continue;
  }
  lines.push(
    `**${pkg.name}**`,
    "```sh",
    `pnpm add ${pkg.name}@${installUrl(pkg)}`,
    "```",
    "",
  );
}
lines.push(
  "Internal workspace deps (generated-clients, shared, studio) are published at the same sha and resolved automatically.",
  "",
  ...(prNumber
    ? [
        `Replace the sha with \`pr-${prNumber}\` or the branch name to always get the latest build of this PR.`,
        "",
      ]
    : []),
);
const body = lines.join("\n");

if (process.env.COMMENT_FILE) {
  fs.writeFileSync(process.env.COMMENT_FILE, body);
}
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body);
}
console.log(body);
