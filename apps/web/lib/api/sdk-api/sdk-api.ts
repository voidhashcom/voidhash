import { Hono } from "hono";
import customers from "./endpoints/customers";

const app = new Hono().basePath("/sdk/v1");
app.get("/", (c) => c.text("SDK Api")); // GET /user

// Endpoints
app.route("/customers", customers);

export { app as sdkApi };
