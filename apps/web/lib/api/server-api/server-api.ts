import { Hono } from "hono";
import customers from "./endpoints/customers";
const app = new Hono().basePath("/server");

app.get("/", (c) => c.text("Server Api")); // GET /user

// Endpoints
app.route("/customers", customers);

export { app as serverApi };
