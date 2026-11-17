# Installs the Voidhash CLI on Windows.
#
#   irm https://raw.githubusercontent.com/voidhashcom/voidhash/main/apps/cli/scripts/install.ps1 | iex
#
# Environment:
#   VOIDHASH_VERSION      the version to install, such as 1.2.3; the latest release by default
#   VOIDHASH_INSTALL_DIR  where to put voidhash.exe; %LOCALAPPDATA%\Programs\voidhash by default
#
# It installs two programs side by side: voidhash.exe, and voidhash-tui.exe, the
# screen that voidhash opens on a terminal.
$ErrorActionPreference = "Stop"

$repository = "https://github.com/voidhashcom/voidhash"
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "amd64" }

$version = "$env:VOIDHASH_VERSION" -replace "^(cli-)?v", ""
if (-not $version) {
  $latest = (Invoke-WebRequest -Method Head -UseBasicParsing "$repository/releases/latest").BaseResponse
  $address = if ($latest.ResponseUri) { $latest.ResponseUri } else { $latest.RequestMessage.RequestUri }
  if ("$address" -notmatch "/tag/cli-v(.+)$") {
    throw "Could not find the latest release; set VOIDHASH_VERSION."
  }
  $version = $Matches[1]
}

$archive = "voidhash_${version}_windows_${arch}.zip"
$base = "$repository/releases/download/cli-v$version"
$work = Join-Path ([IO.Path]::GetTempPath()) ([IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Path $work | Out-Null
try {
  Write-Host "Downloading voidhash $version for windows $arch"
  Invoke-WebRequest -UseBasicParsing "$base/$archive" -OutFile (Join-Path $work $archive)
  Invoke-WebRequest -UseBasicParsing "$base/checksums.txt" -OutFile (Join-Path $work "checksums.txt")

  $line = Get-Content (Join-Path $work "checksums.txt") | Where-Object { $_ -match "\s$([regex]::Escape($archive))$" }
  if (-not $line) { throw "checksums.txt does not list $archive." }
  $expected = ($line -split "\s+")[0]
  $actual = (Get-FileHash -Algorithm SHA256 (Join-Path $work $archive)).Hash.ToLower()
  if ($actual -ne $expected) { throw "The checksum of $archive does not match; nothing was installed." }

  Expand-Archive -Path (Join-Path $work $archive) -DestinationPath $work
  $directory = if ($env:VOIDHASH_INSTALL_DIR) { $env:VOIDHASH_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "Programs\voidhash" }
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  Copy-Item -Force (Join-Path $work "voidhash.exe") (Join-Path $directory "voidhash.exe")
  # A release from before the screen has none; voidhash then prints its help.
  $screen = Join-Path $work "voidhash-tui.exe"
  if (Test-Path $screen) { Copy-Item -Force $screen (Join-Path $directory "voidhash-tui.exe") }

  Write-Host "Installed $(& (Join-Path $directory 'voidhash.exe') --version) to $directory\voidhash.exe"
  if (($env:Path -split ";") -notcontains $directory) {
    Write-Host "Add $directory to your Path to run it as 'voidhash'."
  }
} finally {
  Remove-Item -Recurse -Force $work
}
