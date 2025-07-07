import { Context } from "effect";

export class HonoRuntimeTag extends Context.Tag("app/HonoRuntimeTag")<
	HonoRuntimeTag,
	"hono"
>() {}


export class NextjsRuntimeTag extends Context.Tag("app/NextjsRuntimeTag")<
	NextjsRuntimeTag,
	"nextjs"
>() {}
