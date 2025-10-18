import { RpcMiddleware } from '@effect/rpc/index';
import {
  AuthenticationError,
  AuthSession,
  NotAuthenticatedError
} from '@voidhash/shared';
import { Schema } from 'effect';

export class AuthMiddleware extends RpcMiddleware.Tag<AuthMiddleware>()(
  'Rpc/AuthenticationMiddleware',
  {
    provides: AuthSession,
    failure: Schema.Union(AuthenticationError, NotAuthenticatedError),
    requiredForClient: false
  }
) {}
