import { Logo } from '@voidhash/ui';
import Link from 'next/link';

export function NavBarLogo({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) {
  const homeLink = (() => {
    if (organizationSlug && !projectSlug) {
      return {
        href: `/${organizationSlug}`
      } as const;
    }
    if (organizationSlug && projectSlug) {
      return {
        href: `/${organizationSlug}/${projectSlug}`
      } as const;
    }
    return {
      href: '/'
    } as const;
  })();

  return (
    <Link href={homeLink?.href}>
      <Logo className="ml-2 h-4" color="mono" variant="symbol" />
    </Link>
  );
}
