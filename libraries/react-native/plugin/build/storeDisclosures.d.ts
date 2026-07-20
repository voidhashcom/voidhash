import type { VoidhashExpoPluginOptions } from "./withVoidhashReactNative";
export interface StoreDisclosureInputs {
    readonly apple: {
        readonly collectedData: ReadonlyArray<string>;
        readonly tracking: boolean;
    };
    readonly googlePlay: {
        readonly collectedData: ReadonlyArray<string>;
        readonly advertisingId: boolean;
        readonly deletionSupported: true;
        readonly encryptedInTransit: true;
    };
}
/** Derives mobile-store disclosure inputs from the same enabled capability options as the plugin. */
export declare const generateStoreDisclosureInputs: (options: VoidhashExpoPluginOptions) => StoreDisclosureInputs;
