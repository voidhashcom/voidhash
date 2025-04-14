import { api } from "@/lib/api/api";
import { handle } from "hono/vercel";

export const runtime = "nodejs";

export const GET = handle(api);
export const POST = handle(api);
