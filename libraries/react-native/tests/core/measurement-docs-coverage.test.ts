import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { MEASUREMENT_RECORD_TYPES, STANDARD_EVENTS } from "../../src/core/measurement";

const docsRoot = resolve(process.cwd(), "../../docs/react-native-measurement");

describe("measurement documentation coverage", () => {
  it("documents every unified public method", () => {
    const reference = readFileSync(resolve(docsRoot, "api-reference.md"), "utf8");
    const methods = [
      "capture", "identify", "purchase", "restorePurchases", "flush",
      "configure", "start", "stop", "handle", "on", "getState", "createSupportBundle",
      "getInstallationId", "createInviteLink", "trackInviteShare", "trackCrossPromotion",
      "trackAdRevenue", "validatePurchase", "deleteData", "setTestDevice",
      "getPermissionStatus", "requestPermission", "register", "unregister", "getRegistration",
      "setBadgeCount", "set", "get",
    ];
    for (const method of methods) expect(reference, method).toContain(`\`${method}`);
  });

  it("documents every canonical record and standard event from source constants", () => {
    const dictionary = readFileSync(resolve(docsRoot, "data-dictionary.md"), "utf8");
    for (const recordType of Object.values(MEASUREMENT_RECORD_TYPES)) {
      expect(dictionary, recordType).toContain(`\`${recordType}\``);
    }
    for (const eventName of Object.values(STANDARD_EVENTS)) {
      expect(dictionary, eventName).toContain(`\`${eventName}\``);
    }
  });
});
