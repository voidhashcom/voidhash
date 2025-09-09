import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { CookiesAdapter } from '@/lib/cookies-adapter';

export class HonoCookiesAdapter implements CookiesAdapter {
  private readonly honoContext: Context;
  constructor(honoContext: Context) {
    this.honoContext = honoContext;
  }

  // biome-ignore lint/suspicious/useAwait: need to match CookiesAdapter interface
  async get(name: string): Promise<string | null> {
    return getCookie(this.honoContext, name) ?? null;
  }

  // biome-ignore lint/suspicious/useAwait: need to match CookiesAdapter interface
  async set(name: string, value: string): Promise<void> {
    setCookie(this.honoContext, name, value);
  }

  // biome-ignore lint/suspicious/useAwait: need to match CookiesAdapter interface
  async delete(name: string): Promise<void> {
    deleteCookie(this.honoContext, name);
  }
}
