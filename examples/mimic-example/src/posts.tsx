import { Data, Effect } from "effect";
import axios from "redaxios";

export type PostType = {
  id: string;
  title: string;
  body: string;
};

export class PostNotFoundError extends Data.TaggedError("PostNotFoundError")<{
  readonly message: string;
}> {}

export class PostRequestError extends Data.TaggedError("PostRequestError")<{
  readonly message: string;
}> {}

const isNotFound = (cause: unknown): boolean => {
  if (typeof cause !== "object" || cause === null) return false;
  if (!("status" in cause)) return false;
  return cause.status === 404;
};

const toPostError = (postId: string, cause: unknown) => {
  if (isNotFound(cause)) {
    return new PostNotFoundError({ message: `Post with id "${postId}" not found!` });
  }
  return new PostRequestError({ message: String(cause) });
};

/**
 * Fetches a single post, failing with `PostNotFoundError` when the API returns 404.
 */
export const fetchPost = (postId: string) =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Fetching post with id ${postId}...`);
    yield* Effect.sleep("500 millis");

    return yield* Effect.tryPromise({
      try: () =>
        axios
          .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
          .then((r) => r.data),
      catch: (cause) => toPostError(postId, cause),
    });
  });

/**
 * Fetches the first ten posts from the placeholder API.
 */
export const fetchPosts = () =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Fetching posts...");
    yield* Effect.sleep("500 millis");

    return yield* Effect.tryPromise({
      try: () =>
        axios
          .get<PostType[]>("https://jsonplaceholder.typicode.com/posts")
          .then((r) => r.data.slice(0, 10)),
      catch: (cause) => new PostRequestError({ message: String(cause) }),
    });
  });
