import { Context, Effect } from "effect";

export class Request extends Context.Tag("app/Request")<
	Request,
	{
		readonly getSource: Effect.Effect<string>;
		readonly getHeaders: Effect.Effect<Headers>;
	}
>() {}
