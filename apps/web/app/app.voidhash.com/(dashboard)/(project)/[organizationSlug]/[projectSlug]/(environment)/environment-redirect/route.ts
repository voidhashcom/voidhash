import { Environment as EnvironmentEnum } from '@voidhash/lib/index';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { setEnvironment } from '@/lib/core/environments/utils';
import { NextCookiesAdapter } from '@/lib/nextjs/utils/next-cookies-adapter';

export async function GET(
  request: NextRequest,
  {
    params
  }: {
    params: Promise<{ organizationSlug: string; projectSlug: string }>;
  }
) {
  const searchParams = request.nextUrl.searchParams;
  const { organizationSlug, projectSlug } = await params;

  await setEnvironment(
    new NextCookiesAdapter(),
    organizationSlug,
    projectSlug,
    EnvironmentEnum.Production
  );

  const next = searchParams.get('next');

  if (next) {
    redirect(decodeURIComponent(next));
  } else {
    redirect('/');
  }
}
