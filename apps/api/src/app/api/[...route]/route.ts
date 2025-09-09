import { Context } from 'effect';
import { handler } from '@/index';
export const dynamic = 'force-dynamic';

// biome-ignore lint/suspicious/noExplicitAny: this should be ok, because we don't use the context
const context = Context.empty() as Context.Context<any>;

export const GET = async (request: Request) => {
  return await handler(request, context);
};
export const POST = async (request: Request) => await handler(request, context);
export const PUT = async (request: Request) => await handler(request, context);
export const DELETE = async (request: Request) =>
  await handler(request, context);
export const PATCH = async (request: Request) =>
  await handler(request, context);
export const OPTIONS = async (request: Request) =>
  await handler(request, context);
