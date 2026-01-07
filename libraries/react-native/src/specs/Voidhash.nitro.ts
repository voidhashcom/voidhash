// TODO: Export specs that extend HybridObject<...> here

import type { HybridObject } from "react-native-nitro-modules";

import type { PurchasedItem } from "./PurchasedItem.nitro";

export interface Voidhash extends HybridObject<{
  ios: "swift";
  android: "kotlin";
}> {
  purchase(sku: string): Promise<PurchasedItem>;
}
