import { describe, expect, it } from "vitest";

import {
  applyVoidhashAndroidPermissions,
  applyVoidhashIosBuildSettings,
  applyVoidhashIosInfoPlist,
  validateVoidhashExpoPluginOptions,
} from "../../plugin/src/withVoidhashReactNative";
import { diagnoseVoidhashIntegration } from "../../plugin/src/doctor";
import { generateStoreDisclosureInputs } from "../../plugin/src/storeDisclosures";

describe("Voidhash Expo plugin validation", () => {
  it("accepts a complete link and push configuration", () => {
    expect(() =>
      validateVoidhashExpoPluginOptions({
        measurement: {
          android: {
            appLinks: [{ autoVerify: true, host: "links.example.com", pathPrefix: "/open" }],
            urlSchemes: ["voidhash-demo"],
          },
          ios: {
            adAttributionKitPostbackEndpoint: "https://attribution.example.com",
            associatedDomains: ["applinks:links.example.com"],
            skAdNetworkPostbackEndpoint: "https://skan.example.com",
            urlSchemes: ["voidhash-demo"],
          },
        },
        notifications: {
          android: {
            defaultChannel: { id: "updates", name: "Updates" },
            googleServicesFile: "./google-services.json",
          },
          enabled: true,
          ios: { apsEnvironment: "development", backgroundRemoteNotifications: true },
        },
      }),
    ).not.toThrow();
  });

  it.each([
    [{ measurement: { ios: { associatedDomains: ["not a host"] } } }, "associated domain"],
    [{ measurement: { android: { appLinks: [{ host: "localhost" }] } } }, "App Link host"],
    [{ measurement: { android: { appLinks: [{ host: "example.com", pathPrefix: "open" }] } } }, "pathPrefix"],
    [{ measurement: { ios: { urlSchemes: ["1invalid"] } } }, "URL scheme"],
    [{ notifications: { android: {}, enabled: true } }, "googleServicesFile"],
    [{ notifications: { android: { defaultChannel: { id: "", name: "Updates" } } } }, "requires id and name"],
    [{ notifications: { enabled: true } }, "googleServicesFile"],
    [{ notifications: { ios: { apsEnvironment: "invalid" as never } } }, "apsEnvironment"],
    [{ measurement: { ios: { skAdNetworkPostbackEndpoint: "http://example.com" } } }, "HTTPS origin"],
    [{ measurement: { ios: { adAttributionKitPostbackEndpoint: "https://example.com/path" } } }, "HTTPS origin"],
    [{ measurement: { ios: { disableSKAD: true, skAdNetworkPostbackEndpoint: "https://example.com" } } }, "cannot be combined"],
    [{ measurement: { ios: { privacyMode: "strict-no-idfa", requireAdvertisingId: true } } }, "strict-no-idfa"],
    [{ measurement: { android: { advertisingIdPermission: "remove", requireAdvertisingId: true } } }, "advertisingIdPermission"],
    [{ measurement: { buildMode: "production", purchaseValidationEnvironment: "sandbox" } }, "sandbox purchase validation"],
  ] as const)("rejects contradictory configuration containing %s", (options, message) => {
    expect(() => validateVoidhashExpoPluginOptions(options)).toThrow(message);
  });

  it("explicitly includes or removes Android AD_ID across manifest merging", () => {
    const included = applyVoidhashAndroidPermissions(
      { "uses-permission": [] },
      { measurement: { android: { advertisingIdPermission: "include" } } },
    );
    expect(included["uses-permission"]).toContainEqual({
      $: { "android:name": "com.google.android.gms.permission.AD_ID" },
    });

    const removed = applyVoidhashAndroidPermissions(
      { "uses-permission": [{ $: { "android:name": "com.google.android.gms.permission.AD_ID" } }] },
      { measurement: { android: { advertisingIdPermission: "remove" } } },
    );
    expect(removed.$?.["xmlns:tools"]).toBe("http://schemas.android.com/tools");
    expect(removed["uses-permission"]).toContainEqual({
      $: {
        "android:name": "com.google.android.gms.permission.AD_ID",
        "tools:node": "remove",
      },
    });
  });

  it("writes both Apple attribution endpoints and removes both when disabled", () => {
    const plist: Record<string, unknown> = {};
    applyVoidhashIosInfoPlist(plist, {
      measurement: {
        ios: {
          adAttributionKitPostbackEndpoint: "https://aak.example.com",
          skAdNetworkPostbackEndpoint: "https://skan.example.com",
        },
      },
    });
    expect(plist).toMatchObject({
      AttributionCopyEndpoint: "https://aak.example.com",
      NSAdvertisingAttributionReportEndpoint: "https://skan.example.com",
    });
    applyVoidhashIosInfoPlist(plist, { measurement: { ios: { disableSKAD: true } } });
    expect(plist).not.toHaveProperty("AttributionCopyEndpoint");
    expect(plist).not.toHaveProperty("NSAdvertisingAttributionReportEndpoint");
  });

  it("adds and removes the strict no-IDFA Swift compilation condition deterministically", () => {
    const settings: Record<string, unknown> = {
      SWIFT_ACTIVE_COMPILATION_CONDITIONS: "$(inherited) DEBUG VOIDHASH_STRICT_NO_IDFA",
    };
    applyVoidhashIosBuildSettings(settings, { measurement: { ios: { privacyMode: "standard" } } });
    expect(settings.SWIFT_ACTIVE_COMPILATION_CONDITIONS).toBe("$(inherited) DEBUG");
    applyVoidhashIosBuildSettings(settings, { measurement: { ios: { privacyMode: "strict-no-idfa" } } });
    applyVoidhashIosBuildSettings(settings, { measurement: { ios: { privacyMode: "strict-no-idfa" } } });
    expect(settings.SWIFT_ACTIVE_COMPILATION_CONDITIONS).toBe(
      "$(inherited) DEBUG VOIDHASH_STRICT_NO_IDFA",
    );
  });

  it("shares plugin validation and reports actionable doctor codes without secrets", () => {
    const report = diagnoseVoidhashIntegration({
      options: {
        measurement: {
          android: { advertisingIdPermission: "remove", requireAdvertisingId: true },
          ios: { associatedDomains: ["links.example.com"] },
        },
        notifications: { enabled: true, ios: { apsEnvironment: "production" } },
      },
      androidManifest: "<manifest />",
      googleServicesPresent: false,
      iosEntitlements: "<plist />",
    });
    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "VH_CFG_CONTRADICTION",
      "VH_IOS_APS_ENTITLEMENT_MISSING",
      "VH_ANDROID_GOOGLE_SERVICES_MISSING",
      "VH_IOS_ASSOCIATED_DOMAINS_MISSING",
    ]));
    expect(JSON.stringify(report)).not.toMatch(/token|password|secret/i);
  });

  it("doctor reports every required broken-integration fixture and accepts a complete bare project", () => {
    const baseOptions = {
      measurement: {
        android: {
          appLinks: [{ autoVerify: true, host: "links.example.com" }],
          backupPolicy: "voidhash-no-backup" as const,
        },
        ios: {
          adAttributionKitPostbackEndpoint: "https://aak.example.com",
          associatedDomains: ["links.example.com"],
          skAdNetworkPostbackEndpoint: "https://skan.example.com",
        },
      },
      notifications: {
        android: { googleServicesFile: "./google-services.json" },
        enabled: true,
        ios: { apsEnvironment: "production" as const },
      },
    };
    const broken = diagnoseVoidhashIntegration({
      options: baseOptions,
      androidManifest: "<manifest />",
      googleServicesPresent: false,
      iosEntitlements: "<plist />",
      iosInfoPlist: "<plist />",
    });
    expect(broken.findings.map(({ code }) => code)).toEqual(expect.arrayContaining([
      "VH_ANDROID_APP_LINK_MISSING",
      "VH_ANDROID_FCM_HOOK_MISSING",
      "VH_ANDROID_GOOGLE_SERVICES_MISSING",
      "VH_ANDROID_NO_BACKUP_UNVERIFIED",
      "VH_IOS_ADATTRIBUTIONKIT_PLIST_MISSING",
      "VH_IOS_APS_ENTITLEMENT_MISSING",
      "VH_IOS_ASSOCIATED_DOMAINS_MISSING",
      "VH_IOS_SKAN_PLIST_MISSING",
    ]));
    const complete = diagnoseVoidhashIntegration({
      options: baseOptions,
      androidApplicationSource: "class VoidhashPushFirebaseMessagingService",
      androidManifest: '<manifest fullBackupContent="false"><data android:host="links.example.com" /></manifest>',
      googleServicesPresent: true,
      iosEntitlements: "aps-environment com.apple.developer.associated-domains",
      iosInfoPlist: "NSAdvertisingAttributionReportEndpoint AttributionCopyEndpoint",
    });
    expect(complete).toMatchObject({ ok: true, findings: [] });
  });

  it("derives store disclosures from strict privacy and notification capability toggles", () => {
    const full = generateStoreDisclosureInputs({
      measurement: {
        android: { advertisingIdPermission: "include" },
        ios: { privacyMode: "standard", requireAdvertisingId: true },
      },
      notifications: { enabled: true },
    });
    expect(full.apple.tracking).toBe(true);
    expect(full.apple.collectedData).toContain("advertising-identifier");
    expect(full.googlePlay.collectedData).toContain("push-token");
    const strict = generateStoreDisclosureInputs({
      measurement: {
        android: { advertisingIdPermission: "remove" },
        ios: { privacyMode: "strict-no-idfa" },
      },
      notifications: { enabled: false },
    });
    expect(strict.apple.tracking).toBe(false);
    expect(strict.apple.collectedData).not.toContain("advertising-identifier");
    expect(strict.googlePlay.collectedData).not.toContain("push-token");
  });
});
