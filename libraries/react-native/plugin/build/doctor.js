"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnoseVoidhashIntegration = void 0;
const withVoidhashReactNative_1 = require("./withVoidhashReactNative");
/** Evaluates native project integration using the same option validator as the Expo plugin. */
const diagnoseVoidhashIntegration = (snapshot) => {
    const findings = [];
    try {
        (0, withVoidhashReactNative_1.validateVoidhashExpoPluginOptions)(snapshot.options);
    }
    catch (error) {
        findings.push({ code: "VH_CFG_CONTRADICTION", level: "error", message: error instanceof Error ? error.message : "Invalid configuration" });
    }
    const notifications = snapshot.options.notifications;
    if (notifications?.enabled && notifications.ios?.apsEnvironment && !snapshot.iosEntitlements?.includes("aps-environment")) {
        findings.push({ code: "VH_IOS_APS_ENTITLEMENT_MISSING", level: "error", message: "Add the aps-environment entitlement for push notifications." });
    }
    if (notifications?.enabled && !snapshot.googleServicesPresent) {
        findings.push({ code: "VH_ANDROID_GOOGLE_SERVICES_MISSING", level: "error", message: "Add google-services.json to the Android application." });
    }
    if (notifications?.enabled && !/FirebaseMessagingService|VoidhashPush/i.test(snapshot.androidApplicationSource ?? snapshot.androidManifest ?? "")) {
        findings.push({ code: "VH_ANDROID_FCM_HOOK_MISSING", level: "error", message: "Register the FCM service or Voidhash push subscriber." });
    }
    if (snapshot.options.measurement?.android?.backupPolicy === "voidhash-no-backup" && !/fullBackupContent|dataExtractionRules|noBackupFilesDir/.test(snapshot.androidManifest ?? "")) {
        findings.push({ code: "VH_ANDROID_NO_BACKUP_UNVERIFIED", level: "error", message: "Configure or verify no-backup storage for measurement install state." });
    }
    const ios = snapshot.options.measurement?.ios;
    if ((ios?.associatedDomains?.length ?? 0) > 0 && !snapshot.iosEntitlements?.includes("com.apple.developer.associated-domains")) {
        findings.push({ code: "VH_IOS_ASSOCIATED_DOMAINS_MISSING", level: "error", message: "Add the associated-domains entitlement." });
    }
    if (ios?.disableSKAD !== true && !ios?.skAdNetworkPostbackEndpoint) {
        findings.push({ code: "VH_IOS_SKAN_ENDPOINT_MISSING", level: "error", message: "Configure the HTTPS SKAdNetwork postback endpoint or explicitly disable SKAdNetwork." });
    }
    if (ios?.skAdNetworkPostbackEndpoint &&
        !snapshot.iosInfoPlist?.includes("NSAdvertisingAttributionReportEndpoint")) {
        findings.push({ code: "VH_IOS_SKAN_PLIST_MISSING", level: "error", message: "Regenerate Info.plist with NSAdvertisingAttributionReportEndpoint." });
    }
    if (ios?.adAttributionKitPostbackEndpoint &&
        !snapshot.iosInfoPlist?.includes("AttributionCopyEndpoint")) {
        findings.push({ code: "VH_IOS_ADATTRIBUTIONKIT_PLIST_MISSING", level: "error", message: "Regenerate Info.plist with AttributionCopyEndpoint." });
    }
    for (const link of snapshot.options.measurement?.android?.appLinks ?? []) {
        if (!new RegExp(`android:host=["']${link.host.replace(/\./g, "\\.")}["']`).test(snapshot.androidManifest ?? "")) {
            findings.push({ code: "VH_ANDROID_APP_LINK_MISSING", level: "error", message: `Add the verified App Link host ${link.host}.` });
        }
        if (link.autoVerify === false) {
            findings.push({ code: "VH_ANDROID_APP_LINK_UNVERIFIED", level: "error", message: `Enable Android App Link verification for ${link.host}.` });
        }
    }
    const capabilities = {
        links: {
            androidAppLinks: snapshot.options.measurement?.android?.appLinks?.length ?? 0,
            iosAssociatedDomains: snapshot.options.measurement?.ios?.associatedDomains?.length ?? 0,
        },
        notifications: { enabled: notifications?.enabled ?? false },
        purchases: {
            android: snapshot.options.measurement?.android?.purchaseObservation ?? "disabled",
            ios: snapshot.options.measurement?.ios?.purchaseObservation ?? "disabled",
        },
        privacy: {
            androidAdvertisingId: snapshot.options.measurement?.android?.advertisingIdPermission ?? "remove",
            ios: snapshot.options.measurement?.ios?.privacyMode ?? "standard",
        },
    };
    return { ok: findings.every((finding) => finding.level !== "error"), findings, capabilities };
};
exports.diagnoseVoidhashIntegration = diagnoseVoidhashIntegration;
