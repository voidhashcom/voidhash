import type { ConfigPlugin } from "expo/config-plugins";
import {
  createRunOncePlugin,
  withAndroidManifest,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from "expo/config-plugins";

// biome-ignore lint/nursery/useJsonImportAttribute: plugin code is emitted as CommonJS.
import pkg from "../../package.json";

export interface VoidhashExpoPluginOptions {
  readonly measurement?: {
    readonly buildMode?: "development" | "production";
    readonly purchaseValidationEnvironment?: "production" | "sandbox";
    readonly ios?: {
      readonly associatedDomains?: ReadonlyArray<string>;
      readonly urlSchemes?: ReadonlyArray<string>;
      readonly skAdNetworkPostbackEndpoint?: string;
      readonly adAttributionKitPostbackEndpoint?: string;
      readonly disableSKAD?: boolean;
      readonly privacyMode?: "standard" | "strict-no-idfa";
      readonly requireAdvertisingId?: boolean;
      readonly purchaseObservation?: "storekit2" | "storekit1" | "disabled";
    };
    readonly android?: {
      readonly appLinks?: ReadonlyArray<{
        readonly host: string;
        readonly pathPrefix?: string;
        readonly autoVerify?: boolean;
      }>;
      readonly urlSchemes?: ReadonlyArray<string>;
      readonly backupPolicy?: "voidhash-no-backup" | "preserve-app-rules";
      readonly advertisingIdPermission?: "include" | "remove";
      readonly requireAdvertisingId?: boolean;
      readonly purchaseObservation?: "billing8" | "disabled";
      readonly installReferrers?: ReadonlyArray<"google-play" | "meta" | "samsung" | "huawei" | "xiaomi">;
      readonly identifierProviders?: ReadonlyArray<"app-set-id" | "gaid" | "oaid" | "amazon-aaid" | "meta">;
      readonly outOfStore?: string;
    };
  };
  readonly notifications?: {
    readonly enabled?: boolean;
    readonly ios?: {
      readonly apsEnvironment?: "development" | "production";
      readonly backgroundRemoteNotifications?: boolean;
    };
    readonly android?: {
      readonly googleServicesFile?: string;
      readonly postNotifications?: "include" | "remove";
      readonly defaultChannel?: {
        readonly id: string;
        readonly name: string;
        readonly importance?: "default" | "high" | "low" | "min" | "none";
      };
    };
  };
}

const DOMAIN = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}$/i;
const SCHEME = /^[a-z][a-z\d+.-]*$/i;

const validateApplePostbackEndpoint = (value: string, field: string): void => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Voidhash: ${field} must be an absolute HTTPS origin`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Voidhash: ${field} must be an absolute HTTPS origin`);
  }
};

/** Validates build-time link and notification configuration before mutating a project. */
export const validateVoidhashExpoPluginOptions = (
  options: VoidhashExpoPluginOptions,
): void => {
  if (
    options.measurement?.buildMode === "production" &&
    options.measurement.purchaseValidationEnvironment === "sandbox"
  ) {
    throw new Error("Voidhash: sandbox purchase validation cannot be used in a production build");
  }
  for (const domain of options.measurement?.ios?.associatedDomains ?? []) {
    const host = domain.replace(/^applinks:/, "");
    if (!DOMAIN.test(host)) throw new Error(`Voidhash: invalid associated domain '${domain}'`);
  }
  for (const appLink of options.measurement?.android?.appLinks ?? []) {
    if (!DOMAIN.test(appLink.host)) throw new Error(`Voidhash: invalid App Link host '${appLink.host}'`);
    if (appLink.pathPrefix && !appLink.pathPrefix.startsWith("/")) {
      throw new Error(`Voidhash: App Link pathPrefix must start with '/': '${appLink.pathPrefix}'`);
    }
  }
  const schemes = [
    ...(options.measurement?.ios?.urlSchemes ?? []),
    ...(options.measurement?.android?.urlSchemes ?? []),
  ];
  for (const scheme of schemes) {
    if (!SCHEME.test(scheme)) throw new Error(`Voidhash: invalid URL scheme '${scheme}'`);
  }
  const iosMeasurement = options.measurement?.ios;
  if (iosMeasurement?.privacyMode === "strict-no-idfa" && iosMeasurement.requireAdvertisingId) {
    throw new Error(
      "Voidhash: strict-no-idfa cannot be combined with requireAdvertisingId",
    );
  }
  const androidMeasurement = options.measurement?.android;
  if (
    androidMeasurement?.advertisingIdPermission === "remove" &&
    androidMeasurement.requireAdvertisingId
  ) {
    throw new Error(
      "Voidhash: advertisingIdPermission remove cannot be combined with requireAdvertisingId",
    );
  }
  if (iosMeasurement?.skAdNetworkPostbackEndpoint) {
    validateApplePostbackEndpoint(
      iosMeasurement.skAdNetworkPostbackEndpoint,
      "measurement.ios.skAdNetworkPostbackEndpoint",
    );
  }
  if (iosMeasurement?.adAttributionKitPostbackEndpoint) {
    validateApplePostbackEndpoint(
      iosMeasurement.adAttributionKitPostbackEndpoint,
      "measurement.ios.adAttributionKitPostbackEndpoint",
    );
  }
  if (
    iosMeasurement?.disableSKAD === true &&
    (iosMeasurement.skAdNetworkPostbackEndpoint || iosMeasurement.adAttributionKitPostbackEndpoint)
  ) {
    throw new Error(
      "Voidhash: measurement.ios.disableSKAD cannot be combined with Apple postback endpoints",
    );
  }
  if (
    options.notifications?.enabled &&
    !options.notifications.android?.googleServicesFile
  ) {
    throw new Error(
      "Voidhash: notifications.android.googleServicesFile is required when Android notifications are enabled",
    );
  }
  const channel = options.notifications?.android?.defaultChannel;
  if (channel && (!channel.id.trim() || !channel.name.trim())) {
    throw new Error("Voidhash: the default Android notification channel requires id and name");
  }
  const apsEnvironment = options.notifications?.ios?.apsEnvironment as string | undefined;
  if (
    apsEnvironment !== undefined &&
    apsEnvironment !== "development" &&
    apsEnvironment !== "production"
  ) {
    throw new Error("Voidhash: notifications.ios.apsEnvironment must be development or production");
  }
};

const unique = <T>(values: ReadonlyArray<T>): T[] => [...new Set(values)];

/** Applies deterministic iOS plist values and returns the same plist object. */
export const applyVoidhashIosInfoPlist = <T extends Record<string, unknown>>(
  infoPlist: T,
  options: VoidhashExpoPluginOptions,
): T => {
  const iosMeasurement = options.measurement?.ios;
  const plist = infoPlist as Record<string, unknown>;
  if (iosMeasurement?.disableSKAD === true) {
    delete plist.NSAdvertisingAttributionReportEndpoint;
    delete plist.AttributionCopyEndpoint;
  } else {
    if (iosMeasurement?.skAdNetworkPostbackEndpoint) {
      plist.NSAdvertisingAttributionReportEndpoint =
        iosMeasurement.skAdNetworkPostbackEndpoint;
    }
    if (iosMeasurement?.adAttributionKitPostbackEndpoint) {
      plist.AttributionCopyEndpoint = iosMeasurement.adAttributionKitPostbackEndpoint;
    }
  }
  return infoPlist;
};

/** Applies the compilation condition used to remove IDFA-linked code from strict builds. */
export const applyVoidhashIosBuildSettings = (
  buildSettings: Record<string, unknown>,
  options: VoidhashExpoPluginOptions,
): Record<string, unknown> => {
  const current = String(buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS ?? "$(inherited)")
    .split(/\s+/)
    .filter((value) => value && value !== "VOIDHASH_STRICT_NO_IDFA");
  if (options.measurement?.ios?.privacyMode === "strict-no-idfa") {
    current.push("VOIDHASH_STRICT_NO_IDFA");
  }
  buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS = unique(current).join(" ");
  return buildSettings;
};

const withIosMeasurement: ConfigPlugin<VoidhashExpoPluginOptions> = (config, options) => {
  config = withXcodeProject(config, (current) => {
    const configurations = current.modResults.pbxXCBuildConfigurationSection();
    for (const [key, value] of Object.entries(configurations)) {
      if (key.endsWith("_comment") || !value || typeof value !== "object") continue;
      const configuration = value as { buildSettings?: Record<string, unknown> };
      configuration.buildSettings ??= {};
      applyVoidhashIosBuildSettings(configuration.buildSettings, options);
    }
    return current;
  });
  config = withEntitlementsPlist(config, (current) => {
    const configured = (options.measurement?.ios?.associatedDomains ?? []).map((domain) =>
      domain.startsWith("applinks:") ? domain : `applinks:${domain}`,
    );
    current.modResults["com.apple.developer.associated-domains"] = unique([
      ...((current.modResults["com.apple.developer.associated-domains"] as string[] | undefined) ?? []),
      ...configured,
    ]).sort();
    const environment = options.notifications?.ios?.apsEnvironment;
    if (options.notifications?.enabled && environment) {
      current.modResults["aps-environment"] = environment;
    }
    return current;
  });

  return withInfoPlist(config, (current) => {
    applyVoidhashIosInfoPlist(current.modResults, options);
    const schemes = unique(options.measurement?.ios?.urlSchemes ?? []).sort();
    if (schemes.length > 0) {
      const existing = current.modResults.CFBundleURLTypes ?? [];
      const retained = existing.filter((item) => item.CFBundleURLName !== "com.voidhash.measurement");
      current.modResults.CFBundleURLTypes = [
        ...retained,
        { CFBundleURLName: "com.voidhash.measurement", CFBundleURLSchemes: schemes },
      ];
    }
    if (options.notifications?.ios?.backgroundRemoteNotifications) {
      current.modResults.UIBackgroundModes = unique([
        ...((current.modResults.UIBackgroundModes as string[] | undefined) ?? []),
        "remote-notification",
      ]).sort();
    }
    current.modResults.VoidhashCapabilityManifest = JSON.stringify({
      links: {
        associatedDomains: options.measurement?.ios?.associatedDomains ?? [],
        urlSchemes: schemes,
      },
      appleAttribution: {
        adAttributionKitPostbackEndpoint:
          options.measurement?.ios?.adAttributionKitPostbackEndpoint,
        disableSKAD: options.measurement?.ios?.disableSKAD ?? false,
        skAdNetworkPostbackEndpoint:
          options.measurement?.ios?.skAdNetworkPostbackEndpoint,
      },
      privacy: {
        mode: options.measurement?.ios?.privacyMode ?? "standard",
        advertisingIdAvailable: options.measurement?.ios?.privacyMode !== "strict-no-idfa",
      },
      purchases: {
        observation: options.measurement?.ios?.purchaseObservation ?? "disabled",
        validationEnvironment: options.measurement?.purchaseValidationEnvironment ?? "production",
      },
      notifications: {
        enabled: options.notifications?.enabled ?? false,
        environment: options.notifications?.ios?.apsEnvironment,
        background: options.notifications?.ios?.backgroundRemoteNotifications ?? false,
      },
    });
    return current;
  });
};

type AndroidManifestShape = {
  $?: Record<string, string | undefined>;
  "uses-permission"?: Array<{ $: Record<string, string | undefined> }>;
};

/** Applies explicit notification and advertising-identifier permission policy. */
export const applyVoidhashAndroidPermissions = <T extends AndroidManifestShape>(
  manifest: T,
  options: VoidhashExpoPluginOptions,
): T & AndroidManifestShape => {
  manifest["uses-permission"] ??= [];
  const permissions = manifest["uses-permission"];
  const pushPermission = "android.permission.POST_NOTIFICATIONS";
  const advertisingPermission = "com.google.android.gms.permission.AD_ID";
  const retained = permissions.filter(
    (item) => ![pushPermission, advertisingPermission].includes(item.$["android:name"] ?? ""),
  );
  if (
    options.notifications?.enabled &&
    options.notifications.android?.postNotifications !== "remove"
  ) {
    retained.push({ $: { "android:name": pushPermission } });
  }
  if (options.measurement?.android?.advertisingIdPermission === "include") {
    retained.push({ $: { "android:name": advertisingPermission } });
  } else if (options.measurement?.android?.advertisingIdPermission === "remove") {
    manifest.$ ??= {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    retained.push({
      $: { "android:name": advertisingPermission, "tools:node": "remove" },
    });
  }
  manifest["uses-permission"] = retained;
  return manifest as T & AndroidManifestShape;
};

const withAndroidMeasurement: ConfigPlugin<VoidhashExpoPluginOptions> = (config, options) => {
  if (options.notifications?.android?.googleServicesFile) {
    config.android = {
      ...config.android,
      googleServicesFile: options.notifications.android.googleServicesFile,
    };
  }
  return withAndroidManifest(config, (current) => {
    const manifest = current.modResults.manifest;
    applyVoidhashAndroidPermissions(manifest, options);

    const application = manifest.application?.[0];
    if (!application) throw new Error("Voidhash: AndroidManifest is missing an application element");
    application["meta-data"] ??= [];
    const metadata = application["meta-data"].filter(
      (item) => !item.$["android:name"].startsWith("com.voidhash.measurement."),
    );
    const channel = options.notifications?.android?.defaultChannel;
    const manifestValue = JSON.stringify({
      links: {
        appLinks: options.measurement?.android?.appLinks ?? [],
        urlSchemes: options.measurement?.android?.urlSchemes ?? [],
      },
      notifications: {
        enabled: options.notifications?.enabled ?? false,
        defaultChannel: channel,
      },
      backupPolicy: options.measurement?.android?.backupPolicy ?? "preserve-app-rules",
      privacy: {
        advertisingIdPermission:
          options.measurement?.android?.advertisingIdPermission ?? "remove",
      },
      purchases: {
        observation: options.measurement?.android?.purchaseObservation ?? "disabled",
        validationEnvironment: options.measurement?.purchaseValidationEnvironment ?? "production",
      },
      installReferrers: Object.fromEntries(
        ["google-play", "meta", "samsung", "huawei", "xiaomi"].map((provider) => [
          provider,
          options.measurement?.android?.installReferrers?.includes(provider as "google-play")
            ? "available"
            : "notConfigured",
        ]),
      ),
      identifierProviders: Object.fromEntries(
        ["app-set-id", "gaid", "oaid", "amazon-aaid", "meta"].map((provider) => [
          provider,
          options.measurement?.android?.identifierProviders?.includes(provider as "gaid")
            ? "available"
            : "notConfigured",
        ]),
      ),
      outOfStore: options.measurement?.android?.outOfStore,
    });
    metadata.push({
      $: {
        "android:name": "com.voidhash.measurement.CAPABILITIES",
        "android:value": manifestValue,
      },
    });
    if (channel) {
      metadata.push({
        $: {
          "android:name": "com.google.firebase.messaging.default_notification_channel_id",
          "android:value": channel.id,
        },
      });
    }
    application["meta-data"] = metadata;

    const activity = application.activity?.find((item) =>
      item["intent-filter"]?.some((filter) =>
        filter.action?.some((action) => action.$["android:name"] === "android.intent.action.MAIN"),
      ),
    );
    if (!activity) throw new Error("Voidhash: AndroidManifest is missing a launcher activity");
    const preserved = (activity["intent-filter"] ?? []).filter(
      (filter) => !filter.category?.some((category) => category.$["android:name"] === "com.voidhash.MEASUREMENT_LINK"),
    );
    const linkFilters = (options.measurement?.android?.appLinks ?? []).map((link) => ({
      $: { "android:autoVerify": String(link.autoVerify ?? true) },
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      category: [
        { $: { "android:name": "android.intent.category.DEFAULT" } },
        { $: { "android:name": "android.intent.category.BROWSABLE" } },
        { $: { "android:name": "com.voidhash.MEASUREMENT_LINK" } },
      ],
      data: [{ $: { "android:host": link.host, "android:pathPrefix": link.pathPrefix ?? "/", "android:scheme": "https" } }],
    }));
    const schemeFilters = (options.measurement?.android?.urlSchemes ?? []).map((scheme) => ({
      action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
      category: [
        { $: { "android:name": "android.intent.category.DEFAULT" } },
        { $: { "android:name": "android.intent.category.BROWSABLE" } },
        { $: { "android:name": "com.voidhash.MEASUREMENT_LINK" } },
      ],
      data: [{ $: { "android:scheme": scheme } }],
    }));
    activity["intent-filter"] = [...preserved, ...linkFilters, ...schemeFilters];
    return current;
  });
};

const withVoidhashReactNative: ConfigPlugin<VoidhashExpoPluginOptions> = (
  config,
  options = {},
) => {
  validateVoidhashExpoPluginOptions(options);
  const withIos = withIosMeasurement(config, options);
  return withAndroidMeasurement(withIos, options);
};

export default createRunOncePlugin(withVoidhashReactNative, pkg.name, pkg.version);
