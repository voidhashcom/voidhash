import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

const make = Effect.sync(() => ({}));

type AuthServiceShape = Effect.Success<typeof make>;

export class AuthService extends Context.Service<AuthService, AuthServiceShape>()(
  "voidhash-cli/services/AuthService",
) {
  static Default = Layer.effect(AuthService, make);
}
