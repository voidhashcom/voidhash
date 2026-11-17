#!/usr/bin/env node
// Builds a release of the CLI: every platform's binary and screen, the archives
// and their checksums, the npm packages, and the Homebrew formula. It publishes
// nothing.
//
//   node scripts/release.mjs <version> [--out <dir>] [--tag <tag>]
//
// Writes into dist/release (or --out):
//
//   voidhash_<version>_<os>_<arch>.tar.gz   binary, screen, LICENSE, README.md, completions/ and
//                                           third-party/ (.zip on Windows)
//   checksums.txt                           SHA-256 of every archive
//   voidhash.rb                             Homebrew formula for the release tagged --tag
//   npm/voidhash-cli/                       the launcher package, ready for `npm publish`
//   npm/cli-<os>-<cpu>/                     one package per platform, holding its binary and screen
//
// The screen (../cli-tui) is compiled with Bun, so the script needs Bun 1.4 or
// later on PATH (or named by BUN), the workspace's dependencies installed, and
// npm to fetch OpenTUI's native library for each platform, which it checks
// against the lockfile.
//
// The same sources, version, Go toolchain and Bun produce the same bytes:
// binaries are built with -trimpath and without a build id or VCS stamp, and
// archive entries carry a fixed time (SOURCE_DATE_EPOCH when set).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const root = fileURLToPath(new URL("..", import.meta.url));
const repository = "https://github.com/voidhashcom/voidhash";
const targets = JSON.parse(fs.readFileSync(path.join(root, "npm/platforms.json"), "utf8"));

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const [, value] = args.splice(index, 2);
  if (value === undefined) fail(`${name} needs a value`);
  return value;
};
function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

const outDir = path.resolve(option("--out") ?? path.join(root, "dist/release"));
const tagOption = option("--tag");
const version = (args[0] ?? "").replace(/^v/, "");
if (args.length !== 1 || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail("usage: node scripts/release.mjs <version> [--out <dir>] [--tag <tag>]");
}
const tag = tagOption ?? `cli-v${version}`;
const go = process.env.GO || "go";
// 1980-01-01, the earliest time a zip entry can carry.
const epoch = Number(process.env.SOURCE_DATE_EPOCH ?? 315532800);

fs.rmSync(outDir, { recursive: true, force: true });
const buildDir = path.join(outDir, "build");
fs.mkdirSync(buildDir, { recursive: true });

const executable = (goos) => (goos === "windows" ? "voidhash.exe" : "voidhash");
const screenExecutable = (goos) => (goos === "windows" ? "voidhash-tui.exe" : "voidhash-tui");

function build(goos, goarch) {
  const output = path.join(buildDir, `${goos}_${goarch}`, executable(goos));
  try {
    execFileSync(
      go,
      [
        "build",
        "-trimpath",
        "-buildvcs=false",
        "-ldflags",
        `-s -w -buildid= -X main.version=${version}`,
        "-o",
        output,
        "./cmd/voidhash",
      ],
      {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, CGO_ENABLED: "0", GOOS: goos, GOARCH: goarch },
      },
    );
  } catch {
    fail(`the build for ${goos}/${goarch} failed`);
  }
  return output;
}

// The screen carries OpenTUI's native library for its platform. A package
// manager installs only this computer's, so each one is fetched here, at the
// version the screen depends on and with the hash the lockfile records.
const screenRoot = path.join(root, "../cli-tui");
const bun = process.env.BUN || "bun";
const nativeDir = path.join(buildDir, "native");
const openTui = JSON.parse(fs.readFileSync(path.join(screenRoot, "package.json"), "utf8"))
  .dependencies["@opentui/core"];
const lockfile = fs.readFileSync(path.join(root, "../../pnpm-lock.yaml"), "utf8");

let bunVersion;
try {
  bunVersion = execFileSync(bun, ["--version"], { encoding: "utf8" }).trim();
} catch {
  fail("the screen is compiled with Bun, which was not found; install it or set BUN");
}
// Earlier versions leave a macOS program with a signature macOS refuses.
const [bunMajor, bunMinor] = bunVersion.split(".").map(Number);
if (bunMajor < 1 || (bunMajor === 1 && bunMinor < 4)) {
  fail(`the screen needs Bun 1.4 or later to build; found ${bunVersion}`);
}

function nativeLibrary(target) {
  const name = `@opentui/core-${target.os}-${target.cpu}`;
  const locked = lockfile.match(
    new RegExp(`\n  '${name}@${openTui}':\n    resolution: \\{integrity: (sha512-[^}]+)\\}`),
  );
  if (!locked) fail(`pnpm-lock.yaml does not record ${name}@${openTui}`);
  let tarball;
  try {
    const packed = execFileSync(
      "npm",
      ["pack", `${name}@${openTui}`, "--silent", "--pack-destination", nativeDir],
      { encoding: "utf8", shell: process.platform === "win32" },
    );
    tarball = path.join(nativeDir, packed.trim().split("\n").pop());
  } catch {
    fail(`could not download ${name}@${openTui}`);
  }
  const integrity = `sha512-${createHash("sha512").update(fs.readFileSync(tarball)).digest("base64")}`;
  if (integrity !== locked[1]) fail(`${name}@${openTui} is not the package the lockfile records`);
  const directory = path.join(nativeDir, name);
  fs.mkdirSync(directory, { recursive: true });
  execFileSync("tar", ["-xzf", tarball, "-C", directory, "--strip-components=1"]);
  return directory;
}

function buildScreen(target) {
  const output = path.join(
    buildDir,
    `${target.goos}_${target.goarch}`,
    screenExecutable(target.goos),
  );
  try {
    execFileSync(
      bun,
      [
        "scripts/build.ts",
        "--target",
        `bun-${target.goos}-${target.cpu}`,
        "--native",
        nativeDir,
        "--out",
        output,
      ],
      { cwd: screenRoot, stdio: "inherit" },
    );
  } catch {
    fail(`the screen's build for ${target.goos}/${target.goarch} failed`);
  }
  return output;
}

// The notices of what the native library is built from go out with it.
const notices = (directory) =>
  fs
    .readdirSync(directory)
    .filter((name) => /^(LICENSE|AUTHORS|PATENTS|FFMPEG-SOURCE)/.test(name))
    .sort()
    .map((name) => ({
      name: `third-party/opentui/${name}`,
      data: fs.readFileSync(path.join(directory, name)),
      mode: 0o644,
    }));

fs.mkdirSync(nativeDir, { recursive: true });
for (const target of targets) {
  console.log(`Building ${target.goos}/${target.goarch}`);
  target.binary = build(target.goos, target.goarch);
  target.notices = notices(nativeLibrary(target));
  target.screen = buildScreen(target);
}

// Completions come from a binary this computer can run.
const hostGoos = { win32: "windows" }[process.platform] ?? process.platform;
const hostGoarch = { x64: "amd64" }[process.arch] ?? process.arch;
const hostBinary =
  targets.find((target) => target.goos === hostGoos && target.goarch === hostGoarch)?.binary ??
  build(hostGoos, hostGoarch);
const reported = execFileSync(hostBinary, ["--version"], { encoding: "utf8" }).trim();
if (!reported.endsWith(version)) fail(`the binary reports "${reported}", expected ${version}`);

const completions = [
  ["bash", "completions/voidhash.bash"],
  ["zsh", "completions/_voidhash"],
  ["fish", "completions/voidhash.fish"],
].map(([shell, name]) => ({
  name,
  data: execFileSync(hostBinary, ["completion", shell], { maxBuffer: 16 * 1024 * 1024 }),
  mode: 0o644,
}));

const license = fs.readFileSync(path.join(root, "LICENSE.md"));
const readme = fs.readFileSync(path.join(root, "README.md"));

function tarGz(entries) {
  const blocks = [];
  for (const { name, data, mode } of entries) {
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    header.write(`${mode.toString(8).padStart(7, "0")}\0`, 100);
    header.write("0000000\0", 108);
    header.write("0000000\0", 116);
    header.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
    header.write(`${epoch.toString(8).padStart(11, "0")}\0`, 136);
    header.write("        ", 148);
    header.write("0", 156);
    header.write("ustar\x0000", 257);
    const sum = header.reduce((total, byte) => total + byte, 0);
    header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const archive = zlib.gzipSync(Buffer.concat(blocks), { level: 9 });
  // zlib records the operating system it ran on; name one for every build.
  archive[9] = 3;
  return archive;
}

function zip(entries) {
  const date = new Date(epoch * 1000);
  const dosTime =
    (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const dosDate =
    ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const { name, data, mode } of entries) {
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const fileName = Buffer.from(name);
    const shared = Buffer.alloc(26);
    shared.writeUInt16LE(20, 0);
    shared.writeUInt16LE(0x0800, 2);
    shared.writeUInt16LE(8, 4);
    shared.writeUInt16LE(dosTime, 6);
    shared.writeUInt16LE(dosDate, 8);
    shared.writeUInt32LE(zlib.crc32(data), 10);
    shared.writeUInt32LE(compressed.length, 14);
    shared.writeUInt32LE(data.length, 18);
    shared.writeUInt16LE(fileName.length, 22);
    const local = Buffer.concat([Buffer.from("PK\x03\x04"), shared, fileName, compressed]);
    const tail = Buffer.alloc(14);
    tail.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 6);
    tail.writeUInt32LE(offset, 10);
    // "Made by" Unix, so the mode above is read.
    central.push(Buffer.concat([Buffer.from("PK\x01\x02\x14\x03"), shared, tail, fileName]));
    locals.push(local);
    offset += local.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.write("PK\x05\x06", 0, "latin1");
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const archives = [];
for (const target of targets) {
  const binary = fs.readFileSync(target.binary);
  const screen = fs.readFileSync(target.screen);
  const entries = [
    { name: executable(target.goos), data: binary, mode: 0o755 },
    { name: screenExecutable(target.goos), data: screen, mode: 0o755 },
    { name: "LICENSE", data: license, mode: 0o644 },
    { name: "README.md", data: readme, mode: 0o644 },
    ...completions,
    ...target.notices,
  ];
  const windows = target.goos === "windows";
  const name = `voidhash_${version}_${target.goos}_${target.goarch}.${windows ? "zip" : "tar.gz"}`;
  const archive = windows ? zip(entries) : tarGz(entries);
  fs.writeFileSync(path.join(outDir, name), archive);
  archives.push({
    ...target,
    name,
    sha256: sha256(archive),
    size: archive.length,
    binarySize: binary.length,
    screenSize: screen.length,
  });
}

fs.writeFileSync(
  path.join(outDir, "checksums.txt"),
  archives.map((archive) => `${archive.sha256}  ${archive.name}\n`).join(""),
);

// npm: the launcher, and one package per platform that the launcher's
// optionalDependencies name at exactly this version.
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const platformPackage = (target) => `@voidhash/cli-${target.os}-${target.cpu}`;
const writePackage = (directory, packageManifest, files) => {
  for (const [name, data, mode] of files) {
    const file = path.join(directory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data, { mode: mode ?? 0o644 });
  }
  fs.writeFileSync(
    path.join(directory, "package.json"),
    `${JSON.stringify(packageManifest, null, 2)}\n`,
  );
};

const { scripts: _scripts, devDependencies: _devDependencies, ...published } = manifest;
writePackage(
  path.join(outDir, "npm/voidhash-cli"),
  {
    ...published,
    version,
    optionalDependencies: Object.fromEntries(
      targets.map((target) => [platformPackage(target), version]),
    ),
  },
  [
    ["README.md", readme],
    ["LICENSE.md", license],
    ...fs
      .readdirSync(path.join(root, "npm"))
      .map((name) => [
        `npm/${name}`,
        fs.readFileSync(path.join(root, "npm", name)),
        name === "bin.cjs" ? 0o755 : 0o644,
      ]),
  ],
);

for (const target of targets) {
  const name = platformPackage(target);
  writePackage(
    path.join(outDir, "npm", `cli-${target.os}-${target.cpu}`),
    {
      name,
      version,
      description: `The Voidhash CLI for ${target.os} ${target.cpu}. Install voidhash-cli instead.`,
      license: manifest.license,
      homepage: manifest.homepage,
      repository: manifest.repository,
      os: [target.os],
      cpu: [target.cpu],
      files: ["bin", "third-party"],
      publishConfig: manifest.publishConfig,
    },
    [
      [`bin/${executable(target.goos)}`, fs.readFileSync(target.binary), 0o755],
      [`bin/${screenExecutable(target.goos)}`, fs.readFileSync(target.screen), 0o755],
      ...target.notices.map(({ name, data }) => [name, data]),
      ["LICENSE.md", license],
      [
        "README.md",
        `# ${name}\n\nThe [Voidhash CLI](${manifest.homepage}) binary for ${target.os} ${target.cpu}. ` +
          "Install `voidhash-cli`, which picks the package for your computer.\n",
      ],
    ],
  );
}

const formulaSource = (goos, goarch) => {
  const archive = archives.find((entry) => entry.goos === goos && entry.goarch === goarch);
  return `      url "${repository}/releases/download/${tag}/${archive.name}"\n      sha256 "${archive.sha256}"`;
};
fs.writeFileSync(
  path.join(outDir, "voidhash.rb"),
  `class Voidhash < Formula
  desc "Manage your Voidhash projects from the terminal"
  homepage "${manifest.homepage}"
  version "${version}"
  license "${manifest.license}"

  on_macos do
    on_arm do
${formulaSource("darwin", "arm64")}
    end
    on_intel do
${formulaSource("darwin", "amd64")}
    end
  end

  on_linux do
    on_arm do
${formulaSource("linux", "arm64")}
    end
    on_intel do
${formulaSource("linux", "amd64")}
    end
  end

  def install
    # The CLI looks for its screen beside itself; only the CLI goes on PATH.
    libexec.install "voidhash", "voidhash-tui"
    bin.install_symlink libexec/"voidhash"
    bash_completion.install "completions/voidhash.bash" => "voidhash"
    zsh_completion.install "completions/_voidhash"
    fish_completion.install "completions/voidhash.fish"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/voidhash --version")
  end
end
`,
);

fs.rmSync(buildDir, { recursive: true });

console.log(`\nvoidhash ${version} (${tag}) in ${path.relative(process.cwd(), outDir) || "."}`);
for (const archive of archives) {
  console.log(
    `  ${archive.name.padEnd(48)} ${megabytes(archive.size).padStart(8)}   binary ${megabytes(archive.binarySize).padStart(8)}   screen ${megabytes(archive.screenSize).padStart(8)}`,
  );
}
