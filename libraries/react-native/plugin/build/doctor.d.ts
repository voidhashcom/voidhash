import type { VoidhashExpoPluginOptions } from "./withVoidhashReactNative";
export interface DoctorFinding {
    readonly code: string;
    readonly level: "error" | "warning";
    readonly message: string;
}
export interface DoctorProjectSnapshot {
    readonly options: VoidhashExpoPluginOptions;
    readonly iosEntitlements?: string;
    readonly iosInfoPlist?: string;
    readonly androidManifest?: string;
    readonly androidApplicationSource?: string;
    readonly googleServicesPresent?: boolean;
}
export interface DoctorReport {
    readonly ok: boolean;
    readonly findings: ReadonlyArray<DoctorFinding>;
    readonly capabilities: Readonly<Record<string, unknown>>;
}
/** Evaluates native project integration using the same option validator as the Expo plugin. */
export declare const diagnoseVoidhashIntegration: (snapshot: DoctorProjectSnapshot) => DoctorReport;
