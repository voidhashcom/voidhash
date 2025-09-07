import type { NextRequest } from 'next/server';
import type { CookiesAdapter } from '@/lib/cookies-adapter';

export class NextMiddlewareCookiesAdapter implements CookiesAdapter {
  private readonly req: NextRequest;
  constructor(req: NextRequest) {
    this.req = req;
  }

  // biome-ignore lint/suspicious/useAwait: need to match CookiesAdapter interface
  async get(name: string): Promise<string | null> {
    return this.req.cookies.get(name)?.value ?? null;
  }

  // biome-ignore lint/suspicious/useAwait: need to match CookiesAdapter interface
  async set(_: string, __: string): Promise<void> {
    throw new Error('Settings cookies is not allowed in next.js middleware');
  }

  // biome-ignore lint/suspicious/useAwait: need to match CookiesAdapter interface
  async delete(_: string): Promise<void> {
    throw new Error('Deleting cookies is not allowed in next.js middleware');
  }
}
