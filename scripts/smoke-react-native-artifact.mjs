import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sdk = resolve(dirname(fileURLToPath(import.meta.url)), "../libraries/react-native");
const root = resolve(sdk, "../..");
const platform = process.argv[2] ?? "ios";
assert(["ios", "android"].includes(platform), "Expected ios or android");
const compile = process.argv.includes("--compile");
const fixture = mkdtempSync(join(tmpdir(), "voidhash-artifact-"));
console.log(`Artifact smoke fixture: ${fixture}`);

function run(command, args, cwd = fixture) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, CI: "1" },
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed`);
}

run("pnpm", ["specs"], sdk);
run("pnpm", ["build"], sdk);
const overrides = {};
for (const path of [
  "libraries/ios",
  "libraries/android",
  "packages/generated-clients",
  "libraries/react-native",
]) {
  const directory = join(root, path);
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  run("pnpm", ["pack", "--pack-destination", fixture], directory);
  const tarball = `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
  overrides[manifest.name] = `file:${join(fixture, tarball)}`;
}

const manifest = JSON.parse(readFileSync(join(sdk, "package.json"), "utf8"));
writeFileSync(
  join(fixture, "package.json"),
  JSON.stringify(
    {
      name: "voidhash-artifact-smoke",
      version: "1.0.0",
      private: true,
      dependencies: {
        ...overrides,
        expo: process.env.EXPO_SMOKE_VERSION ?? "^55.0.9",
        react: "19.2.0",
        "react-native": "0.83.4",
        "react-native-nitro-modules": manifest.peerDependencies["react-native-nitro-modules"],
        effect: "4.0.0-beta.102",
      },
    },
    null,
    2,
  ),
);
writeFileSync(
  join(fixture, "pnpm-workspace.yaml"),
  `nodeLinker: hoisted\noverrides: ${JSON.stringify(overrides)}\n`,
);
writeFileSync(
  join(fixture, "app.json"),
  JSON.stringify({
    expo: {
      name: "VoidhashSmoke",
      slug: "voidhash-smoke",
      ios: { bundleIdentifier: "com.voidhash.smoke" },
      android: { package: "com.voidhash.smoke" },
      plugins: ["@voidhash/react-native"],
    },
  }),
);
run("pnpm", ["install", "--ignore-scripts", "--no-frozen-lockfile"]);
run("pnpm", ["exec", "expo", "prebuild", "--platform", platform, "--no-install"]);

if (platform === "ios") {
  const podfile = readFileSync(join(fixture, "ios/Podfile"), "utf8");
  for (const pod of ["VoidhashCore", "Voidhash"]) {
    assert(podfile.includes(`pod "${pod}", :path => "../node_modules/@voidhash/ios"`));
  }
  // A second prebuild must preserve exactly one declaration of each pod.
  run("pnpm", ["exec", "expo", "prebuild", "--platform", "ios", "--no-install"]);
  const refreshed = readFileSync(join(fixture, "ios/Podfile"), "utf8");
  for (const pod of ["VoidhashCore", "Voidhash"]) {
    assert.equal(refreshed.split(`pod "${pod}"`).length - 1, 1);
  }
  if (compile) {
    run("pod", ["install"], join(fixture, "ios"));
    const workspace = readdirSync(join(fixture, "ios")).find((name) =>
      name.endsWith(".xcworkspace"),
    );
    assert(workspace, "CocoaPods must generate a workspace");
    run(
      "xcodebuild",
      [
        "-workspace",
        workspace,
        "-scheme",
        "VoidhashSmoke",
        "-configuration",
        "Debug",
        "-sdk",
        "iphonesimulator",
        "-destination",
        "generic/platform=iOS Simulator",
        "-derivedDataPath",
        join(fixture, "DerivedData"),
        "CODE_SIGNING_ALLOWED=NO",
        "build",
      ],
      join(fixture, "ios"),
    );
  }
} else if (compile) {
  run(
    "./gradlew",
    [":voidhash_react-native:assembleDebug", "-PreactNativeArchitectures=arm64-v8a", "--no-daemon"],
    join(fixture, "android"),
  );
}
console.log(`Packed ${platform} ${compile ? "native compile" : "prebuild"} smoke passed.`);
