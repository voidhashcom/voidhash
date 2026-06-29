import { Effect, Layer, Context } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type AuthServiceShape = Effect.Success<typeof make>;

export class AuthService extends Context.Service<AuthService, AuthServiceShape>()(
  "voidhash-cli/services/AuthService"
) {
  static Default = Layer.effect(AuthService, make)
}
