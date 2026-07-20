import type { ConfigPlugin } from "expo/config-plugins";
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
/** Validates build-time link and notification configuration before mutating a project. */
export declare const validateVoidhashExpoPluginOptions: (options: VoidhashExpoPluginOptions) => void;
/** Applies deterministic iOS plist values and returns the same plist object. */
export declare const applyVoidhashIosInfoPlist: <T extends Record<string, unknown>>(infoPlist: T, options: VoidhashExpoPluginOptions) => T;
/** Applies the compilation condition used to remove IDFA-linked code from strict builds. */
export declare const applyVoidhashIosBuildSettings: (buildSettings: Record<string, unknown>, options: VoidhashExpoPluginOptions) => Record<string, unknown>;
type AndroidManifestShape = {
    $?: Record<string, string | undefined>;
    "uses-permission"?: Array<{
        $: Record<string, string | undefined>;
    }>;
};
/** Applies explicit notification and advertising-identifier permission policy. */
export declare const applyVoidhashAndroidPermissions: <T extends AndroidManifestShape>(manifest: T, options: VoidhashExpoPluginOptions) => T & AndroidManifestShape;
declare const _default: ConfigPlugin<VoidhashExpoPluginOptions>;
export default _default;
