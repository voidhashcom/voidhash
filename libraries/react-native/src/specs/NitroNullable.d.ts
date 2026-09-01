/** A nullable value represented by the Nitro native bridge. */
export type NitroNullable<Value> = Value | Exclude<Response["body"], object>;
