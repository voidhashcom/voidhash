import { sendJson } from "../http";
import type { RouteHandler } from "../server";

/** Liveness. Never touches Voidhash, so it stays green during an outage. */
export const healthRoute: RouteHandler = (_request, response) => {
  sendJson(response, 200, { status: "ok" });
};
