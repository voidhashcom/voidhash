import { Effect } from "effect";

export class AuthService extends Effect.Service<AuthService>()(
  "voidhash-cli/services/AuthService",
  {
    dependencies: [],
    scoped: Effect.gen(function* scoped() {
      return {} as const;
    }),
  }
) {}
