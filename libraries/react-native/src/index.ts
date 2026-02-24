// import { Platform } from "react-native";

// import { PayKit } from "./nitro";

// export * from "./specs/PurchasedItem.nitro";

// export { PayKit };

// type iOSAvailableProduct = {
// 	sku: string;
// };

// type PayKitIntegrationOptions = {
// 	ios?: {
// 		/**
// 		 * Returns currently available products that the user can purchase or subscribe to
// 		 * @returns The offerings
// 		 */
// 		getAvailableProducts: () => Promise<iOSAvailableProduct[]>;
// 	};
// 	android?: {
// 		getAvailableProducts?: () => Promise<string[]>;
// 	};
// };

// export class PayKitIntegration {
// 	constructor(private readonly options: PayKitIntegrationOptions) {
// 		console.log(options);
// 	}

// 	purchase(sku: string) {
// 		return PayKit.purchase(sku);
// 	}

// 	getProducts() {
// 		if (Platform.OS === "ios") {
// 			return this.options.ios?.getAvailableProducts?.();
// 		}

// 		throw new Error("Not implemented");
// 	}
// }

export * from "./client";
export * from "./client-react-native";
export * from "./core/schema";
export * from "./core/types";
export * from "./core/utils";
export * from "./react/components/provider";
export * from "./react/hooks/use-paywall-by-location";
export * from "./react/hooks/use-purchase";
