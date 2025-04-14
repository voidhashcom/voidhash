import { Hono } from "hono";
import { sdkApi } from "./sdk-api/sdk-api";
import { serverApi } from "./server-api/server-api";

export const api = new Hono();

api.route("/", sdkApi); // Handle /book
api.route("/", serverApi); // Handle /user
