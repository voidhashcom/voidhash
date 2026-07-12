#!/usr/bin/env bash

set -euo pipefail

destination="${STOREKIT_SIMULATOR_DESTINATION:-platform=iOS Simulator,OS=18.5,name=iPhone 16 Pro}"
result_directory="$(mktemp -d "${TMPDIR:-/tmp}/voidhash-storekit-tests.XXXXXX")"
trap 'rm -rf "$result_directory"' EXIT

set +e
xcodebuild test \
  -project ios-storekit-tests/VoidhashStoreKitTests.xcodeproj \
  -scheme StoreKitPurchaseTests \
  -destination "$destination" \
  -derivedDataPath .build/xcode-storekit-host \
  -resultBundlePath "$result_directory/result.xcresult" \
  -quiet
xcode_status=$?
set -e

if [[ ! -d "$result_directory/result.xcresult" ]]; then
  exit "$xcode_status"
fi

set +e
xcrun xcresulttool get test-results summary \
  --path "$result_directory/result.xcresult" \
  --format json | node -e '
let input = ""
process.stdin.on("data", (chunk) => { input += chunk })
process.stdin.on("end", () => {
  const summary = JSON.parse(input)
  const passed = summary.passedTests ?? 0
  const failed = summary.failedTests ?? 0
  const skipped = summary.skippedTests ?? 0
  console.log(`StoreKit simulator result: ${passed} passed, ${failed} failed, ${skipped} skipped`)
  if (failed > 0 || skipped > 0 || passed === 0) {
    console.error("StoreKit simulator validation requires every discovered test to execute and pass")
    process.exit(1)
  }
})
'
summary_status=$?
set -e

if ((xcode_status != 0 || summary_status != 0)); then
  xcrun xcresulttool get test-results tests \
    --path "$result_directory/result.xcresult" \
    --compact | node -e '
let input = ""
process.stdin.on("data", (chunk) => { input += chunk })
process.stdin.on("end", () => {
  const report = JSON.parse(input)
  const visit = (node) => {
    if (node.nodeType === "Test Case" && node.result !== "Passed") {
      const messages = (node.children ?? [])
        .filter((child) => child.nodeType === "Failure Message")
        .map((child) => child.name)
      console.error(`${node.name}: ${node.result}${messages.length ? ` — ${messages.join("; ")}` : ""}`)
    }
    for (const child of node.children ?? []) visit(child)
  }
  for (const node of report.testNodes ?? []) visit(node)
})
'
  exit 1
fi
