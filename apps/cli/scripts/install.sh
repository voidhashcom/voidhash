#!/bin/sh
# Installs the Voidhash CLI on macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/voidhashcom/voidhash/main/apps/cli/scripts/install.sh | sh
#
# Environment:
#   VOIDHASH_VERSION      the version to install, such as 1.2.3; the latest release by default
#   VOIDHASH_INSTALL_DIR  where to put the binary; /usr/local/bin when you can write there,
#                         otherwise ~/.local/bin
#
# It installs two programs side by side: voidhash, and voidhash-tui, the screen
# that voidhash opens on a terminal.
#
# The script downloads the release archive for this computer, checks it against
# the release's checksums, and never asks for more rights than you run it with.
set -eu

repository="https://github.com/voidhashcom/voidhash"

fail() {
  echo "voidhash install: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

need curl
need tar
need uname

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) fail "unsupported system $(uname -s); on Windows use install.ps1 or npm" ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) arch=amd64 ;;
  arm64 | aarch64) arch=arm64 ;;
  *) fail "unsupported processor $(uname -m)" ;;
esac

version="${VOIDHASH_VERSION:-}"
version="${version#cli-v}"
version="${version#v}"
if [ -z "$version" ]; then
  latest=$(curl -fsSLI -o /dev/null -w '%{url_effective}' "$repository/releases/latest") ||
    fail "could not find the latest release; set VOIDHASH_VERSION"
  case "$latest" in
    */tag/cli-v*) version="${latest##*/tag/cli-v}" ;;
    *) fail "could not find the latest release; set VOIDHASH_VERSION" ;;
  esac
fi

archive="voidhash_${version}_${os}_${arch}.tar.gz"
base="$repository/releases/download/cli-v$version"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT INT TERM

echo "Downloading voidhash $version for $os $arch"
curl -fsSL -o "$work/$archive" "$base/$archive" ||
  fail "could not download $base/$archive"
curl -fsSL -o "$work/checksums.txt" "$base/checksums.txt" ||
  fail "could not download $base/checksums.txt"

expected=$(awk -v name="$archive" '$2 == name { print $1 }' "$work/checksums.txt")
[ -n "$expected" ] || fail "checksums.txt does not list $archive"
if command -v sha256sum >/dev/null 2>&1; then
  actual=$(sha256sum "$work/$archive" | awk '{ print $1 }')
elif command -v shasum >/dev/null 2>&1; then
  actual=$(shasum -a 256 "$work/$archive" | awk '{ print $1 }')
else
  fail "sha256sum or shasum is required to check the download"
fi
[ "$actual" = "$expected" ] || fail "the checksum of $archive does not match; nothing was installed"

tar -xzf "$work/$archive" -C "$work" voidhash
# A release from before the screen has none; voidhash then prints its help.
tar -xzf "$work/$archive" -C "$work" voidhash-tui 2>/dev/null || true

if [ -n "${VOIDHASH_INSTALL_DIR:-}" ]; then
  directory="$VOIDHASH_INSTALL_DIR"
elif [ -d /usr/local/bin ] && [ -w /usr/local/bin ]; then
  directory=/usr/local/bin
else
  directory="$HOME/.local/bin"
fi
mkdir -p "$directory" || fail "could not create $directory"
[ -w "$directory" ] ||
  fail "cannot write to $directory; set VOIDHASH_INSTALL_DIR, or run the script with the rights it needs"

# Replace in one step, so a running CLI keeps the file it started from.
if [ -f "$work/voidhash-tui" ]; then
  cp "$work/voidhash-tui" "$directory/.voidhash-tui.new"
  chmod 755 "$directory/.voidhash-tui.new"
  mv -f "$directory/.voidhash-tui.new" "$directory/voidhash-tui"
fi
cp "$work/voidhash" "$directory/.voidhash.new"
chmod 755 "$directory/.voidhash.new"
mv -f "$directory/.voidhash.new" "$directory/voidhash"

echo "Installed $("$directory/voidhash" --version) to $directory/voidhash"
case ":$PATH:" in
  *":$directory:"*) ;;
  *) echo "Add $directory to your PATH to run it as 'voidhash'." ;;
esac
