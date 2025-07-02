import { Effect } from "effect";
import {
	createHash as createHashFn,
	EncodingFormat,
	SHAFamily,
	TypedArray,
} from "../functions";

export const createHash = <Encoding extends EncodingFormat = "none">(
	algorithm: SHAFamily,
	encoding?: Encoding
) =>
	Effect.succeed({
		digest: (input: string | ArrayBuffer | TypedArray) =>
			Effect.promise(() => createHashFn(algorithm, encoding).digest(input)),
	});
