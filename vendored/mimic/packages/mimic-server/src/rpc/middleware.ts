import * as Context from "effect/Context";
import { RpcMiddleware } from "effect/unstable/rpc";

import { UnauthorizedError } from "./errors.ts";

export interface CurrentUserShape {
  readonly userId: string;
  readonly username: string;
  readonly isSuperuser: boolean;
}

export class CurrentUser extends Context.Service<CurrentUser, CurrentUserShape>()(
  "@voidhash/mimic-rpc/CurrentUser",
) {}

export class AuthMiddleware extends RpcMiddleware.Service<
  AuthMiddleware,
  {
    provides: CurrentUser;
  }
>()("@voidhash/mimic-rpc/AuthMiddleware", {
  error: UnauthorizedError,
}) {}
