import { Hono } from "hono";
import { sdkApi } from "./sdk-api/sdk-api";
import { serverApi } from "./server-api/server-api";

export const app = new Hono();

app.route("/", sdkApi); // Handle /book
app.route("/", serverApi); // Handle /user
