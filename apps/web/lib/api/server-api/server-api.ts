import { Hono } from "hono";

const serverApi = new Hono().basePath("/server");
serverApi.get("/", (c) => c.text("Server Api")); // GET /user

export { serverApi };
