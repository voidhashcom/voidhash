import { Hono } from "hono";
import customers from "./endpoints/customers";
import paywalls from "./endpoints/paywalls";
import products from "./endpoints/products";
const app = new Hono().basePath("/v1");

app.route("/customers", customers);
app.route("/paywalls", paywalls);
app.route("/products", products);

export { app as v1 };
