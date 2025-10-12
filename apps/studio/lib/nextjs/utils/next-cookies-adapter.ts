import { cookies } from 'next/headers';
import type { CookiesAdapter } from '../../cookies-adapter';

export class NextCookiesAdapter implements CookiesAdapter {
  async get(name: string): Promise<string | null> {
    return (await cookies()).get(name)?.value ?? null;
  }

  async set(name: string, value: string): Promise<void> {
    (await cookies()).set(name, value);
  }

  async delete(name: string): Promise<void> {
    (await cookies()).delete(name);
  }
}
