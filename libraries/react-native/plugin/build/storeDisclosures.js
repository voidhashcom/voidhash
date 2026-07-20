"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateStoreDisclosureInputs = void 0;
/** Derives mobile-store disclosure inputs from the same enabled capability options as the plugin. */
const generateStoreDisclosureInputs = (options) => {
    const notifications = options.notifications?.enabled === true;
    const iosAdvertising = options.measurement?.ios?.privacyMode !== "strict-no-idfa" &&
        options.measurement?.ios?.requireAdvertisingId === true;
    const androidAdvertising = options.measurement?.android?.advertisingIdPermission === "include";
    const common = ["product-interaction", "device-or-other-identifiers"];
    return {
        apple: {
            collectedData: [...common, ...(notifications ? ["push-token"] : []), ...(iosAdvertising ? ["advertising-identifier"] : [])].sort(),
            tracking: iosAdvertising,
        },
        googlePlay: {
            collectedData: [...common, ...(notifications ? ["push-token"] : []), ...(androidAdvertising ? ["advertising-identifier"] : [])].sort(),
            advertisingId: androidAdvertising,
            deletionSupported: true,
            encryptedInTransit: true,
        },
    };
};
exports.generateStoreDisclosureInputs = generateStoreDisclosureInputs;
