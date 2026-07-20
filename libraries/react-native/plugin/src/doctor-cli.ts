#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { diagnoseVoidhashIntegration } from "./doctor";
import type { VoidhashExpoPluginOptions } from "./withVoidhashReactNative";

const root = resolve(process.cwd());
const read = (...candidates: ReadonlyArray<string>): string | undefined => {
  const path = candidates.map((candidate) => resolve(root, candidate)).find(existsSync);
  return path ? readFileSync(path, "utf8") : undefined;
};
const configured = read("voidhash.config.json");
const options = configured ? JSON.parse(configured) as VoidhashExpoPluginOptions : {};
const report = diagnoseVoidhashIntegration({
  options,
  androidApplicationSource: read("android/app/src/main/java/MainApplication.kt", "android/app/src/main/java/MainApplication.java"),
  androidManifest: read("android/app/src/main/AndroidManifest.xml"),
  googleServicesPresent: existsSync(resolve(root, "android/app/google-services.json")),
  iosEntitlements: read("ios/Voidhash.entitlements", "ios/App.entitlements"),
  iosInfoPlist: read("ios/Info.plist"),
});
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.ok ? 0 : 1;
