// Real Cloudflare Workers (workerd) smoke test for the App Store SDK verifier.
//
// Bundles `worker.ts` (which imports the ported verifier) with esbuild for the
// workerd runtime, runs it inside an actual workerd instance via miniflare, and
// asserts the full WebCrypto verification path works there:
//   - a genuinely Apple-signed transaction verifies (ok: true)
//   - a tampered signature is rejected (ok: false)
//
// This is the proof that the SDK runs on Workers, complementing the static
// `import-ban.test.ts` gate. Run with `pnpm test:workers`.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { Miniflare } from "miniflare";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");

// Test root certificates (base64 DER) that the mock_signed_data fixtures chain
// to — kept in sync with tests/util.ts.
const ROOT_CA_BASE64_ENCODED_1 =
  "MIIBXDCCAQICCQCfjTUGLDnR9jAKBggqhkjOPQQDAzA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMB4XDTIzMDEwNDE2MjAzMloXDTMzMDEwMTE2MjAzMlowNjELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGlubzBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABHPvwZfoKLKaOrX/We4qObXSna5TdWHVZ6hIRA1w0oc3QCT0Io2plyDB3/MVlk2tc4KGE8TiqW7ibQ6Zc9V64k0wCgYIKoZIzj0EAwMDSAAwRQIhAMTHhWtbAQN0hSxIXcP4CKrDCH/gsxWpx6jTZLTeZ+FPAiB35nwk5q0zcIpefvYJ0MU/yGGHSWez0bq0pDYUO/nmDw==";
const ROOT_CA_BASE64_ENCODED_2 =
  "MIIBgjCCASmgAwIBAgIJALUc5ALiH5pbMAoGCCqGSM49BAMDMDYxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRIwEAYDVQQHDAlDdXBlcnRpbm8wHhcNMjMwMTA1MjEzMDIyWhcNMzMwMTAyMjEzMDIyWjA2MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTESMBAGA1UEBwwJQ3VwZXJ0aW5vMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEc+/Bl+gospo6tf9Z7io5tdKdrlN1YdVnqEhEDXDShzdAJPQijamXIMHf8xWWTa1zgoYTxOKpbuJtDplz1XriTaMgMB4wDAYDVR0TBAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwCgYIKoZIzj0EAwMDRwAwRAIgemWQXnMAdTad2JDJWng9U4uBBL5mA7WI05H7oH7c6iQCIHiRqMjNfzUAyiu9h6rOU/K+iTR0I/3Y/NSWsXHX+acc";

const toPem = (base64) => `-----BEGIN CERTIFICATE-----\n${base64}\n-----END CERTIFICATE-----`;

// Rewrite NodeNext `.js` specifiers to their sibling `.ts` source so esbuild can
// bundle the TS package without a prior compile step. Bare deps (jose, peculiar,
// effect, reflect-metadata) keep normal node_modules resolution.
const tsResolvePlugin = {
  name: "ts-js-resolve",
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (args.kind === "entry-point" || !args.path.startsWith(".")) return undefined;
      const tsPath = path.resolve(args.resolveDir, args.path).replace(/\.js$/, ".ts");
      return existsSync(tsPath) ? { path: tsPath } : undefined;
    });
  },
};

const flipLastChar = (segment) => {
  const last = segment[segment.length - 1];
  return segment.slice(0, -1) + (last === "A" ? "B" : "A");
};

const main = async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(here, "worker.ts")],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
    platform: "browser",
    conditions: ["workerd", "worker", "browser", "import", "module", "default"],
    mainFields: ["module", "main"],
    plugins: [tsResolvePlugin],
    logLevel: "warning",
  });

  const code = result.outputFiles[0].text;

  // Intentionally NO nodejs_compat flag: we want to prove the verifier runs in
  // pure workerd, with no Node shims (no Buffer, no node: builtins).
  const mf = new Miniflare({
    modules: true,
    compatibilityDate: "2025-01-01",
    script: code,
  });

  let failures = 0;
  const check = (label, condition, detail) => {
    if (condition) {
      console.log(`  ✓ ${label}`);
    } else {
      failures++;
      console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    }
  };

  try {
    const signedTransaction = readFileSync(
      path.join(pkgRoot, "tests/resources/mock_signed_data/transactionInfo"),
      "utf-8",
    ).trim();

    const baseBody = {
      rootCertificates: [toPem(ROOT_CA_BASE64_ENCODED_1), toPem(ROOT_CA_BASE64_ENCODED_2)],
      bundleId: "com.example",
      environment: "Sandbox",
    };

    const post = async (body) => {
      const res = await mf.dispatchFetch("http://smoke/", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return res.json();
    };

    console.log("workerd smoke test (App Store SDK verifier):");

    const valid = await post({ ...baseBody, signedTransaction });
    check(
      "runs inside workerd with WebCrypto",
      valid.runtime?.subtle === "object",
      JSON.stringify(valid.runtime),
    );
    check(
      "does NOT rely on Node Buffer",
      valid.runtime?.hasBuffer === false,
      `Buffer present: ${valid.runtime?.hasBuffer}`,
    );
    check("verifies a genuinely Apple-signed transaction", valid.ok === true, valid.error);

    const tamperedSignature = (() => {
      const parts = signedTransaction.split(".");
      parts[2] = flipLastChar(parts[2]);
      return parts.join(".");
    })();
    const tampered = await post({ ...baseBody, signedTransaction: tamperedSignature });
    check("rejects a tampered signature (fails loud)", tampered.ok === false, tampered.error);
  } finally {
    await mf.dispose();
  }

  if (failures > 0) {
    console.error(`\nworkerd smoke test FAILED (${failures} check(s) failed)`);
    process.exit(1);
  }
  console.log("\nworkerd smoke test PASSED — verifier runs on Cloudflare Workers.");
};

await main();
