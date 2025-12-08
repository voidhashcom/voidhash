import { Link } from '@tanstack/react-router';
import { Logo } from '@voidhash/ui';

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
    // biome-ignore lint/suspicious/noExplicitAny: Any link
    <Link to={homeLink?.href as any}>
      <Logo className="ml-2 h-4" color="mono" variant="symbol" />
    </Link>
  );
}
