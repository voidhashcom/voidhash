import { createVoidhash } from "voidhash";
import { env } from "./env";

export const voidhash = createVoidhash(env.VOIDHASH_SECRET_KEY);
