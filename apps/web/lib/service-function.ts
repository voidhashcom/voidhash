import { z } from "zod";
import { CacheAdapter } from "./cache-adapter";
import { CookiesAdapter } from "./cookies-adapter";

export type ServiceParamWithInput<T = unknown> = {
	ctx: ServiceContext;
	input: T;
};

export type ServiceParamWithoutInput = {
	ctx: ServiceContext;
};

export function createServiceFunction() {
	return {
		input: <TSchema extends z.ZodType>(schema: TSchema) => {
			type Input = z.infer<TSchema>;

			return {
				function: <OutputType = unknown>(
					fn: ({
						input,
						ctx,
					}: { input: Input; ctx: ServiceContext }) => Promise<OutputType>
				) => {
					return async ({
						ctx,
						input,
					}: ServiceParamWithInput<Input>): Promise<OutputType> => {
						const validatedInput = schema.parse(input) as Input;
						return await fn({ ctx, input: validatedInput });
					};
				},
			};
		},
		function: <OutputType = unknown>(
			fn: ({ ctx }: { ctx: ServiceContext }) => Promise<OutputType>
		) => {
			return async ({ ctx }: ServiceParamWithoutInput): Promise<OutputType> => {
				return await fn({ ctx });
			};
		},
	};
}

export type ServiceContext = {
	headers: Headers;
	cache: CacheAdapter;
	cookies: CookiesAdapter;
};
