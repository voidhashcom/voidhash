import { Effect } from "effect";

import {
  type EncodingFormat,
  type SHAFamily,
  type TypedArray,
  createHash as createHashFn,
} from "../functions";

export const createHashEf = <Encoding extends EncodingFormat = "none">(
  algorithm: SHAFamily,
  encoding?: Encoding
) =>
  Effect.succeed({
    digest: (input: string | ArrayBuffer | TypedArray) =>
      Effect.promise(() => createHashFn(algorithm, encoding).digest(input)),
  });
