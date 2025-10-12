import { SHORT_DOMAIN } from '@voidhash/lib';
import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  let domain = headersList.get('host') as string;

  if (domain === 'voidhash.localhost:3000' || domain.endsWith('.vercel.app')) {
    // for local development and preview URLs
    domain = SHORT_DOMAIN;
  }

  return [
    {
      url: `https://${domain}`,
      lastModified: new Date()
    }
  ];
}
