#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const doctor_1 = require("./doctor");
const root = (0, node_path_1.resolve)(process.cwd());
const read = (...candidates) => {
    const path = candidates.map((candidate) => (0, node_path_1.resolve)(root, candidate)).find(node_fs_1.existsSync);
    return path ? (0, node_fs_1.readFileSync)(path, "utf8") : undefined;
};
const configured = read("voidhash.config.json");
const options = configured ? JSON.parse(configured) : {};
const report = (0, doctor_1.diagnoseVoidhashIntegration)({
    options,
    androidApplicationSource: read("android/app/src/main/java/MainApplication.kt", "android/app/src/main/java/MainApplication.java"),
    androidManifest: read("android/app/src/main/AndroidManifest.xml"),
    googleServicesPresent: (0, node_fs_1.existsSync)((0, node_path_1.resolve)(root, "android/app/google-services.json")),
    iosEntitlements: read("ios/Voidhash.entitlements", "ios/App.entitlements"),
    iosInfoPlist: read("ios/Info.plist"),
});
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.ok ? 0 : 1;
