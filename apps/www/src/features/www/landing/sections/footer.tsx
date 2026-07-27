import { Logo } from "@voidhash/ui";

const GITHUB_REPO = "https://github.com/voidhashcom/voidhash";

const LINK_COLUMNS: {
  title: string;
  links: { label: string; href?: string }[];
}[] = [
  {
    title: "PRODUCT",
    links: [
      { label: "Paywalls", href: "/#paywalls" },
      { label: "Analytics", href: "/#analytics" },
      { label: "Experiments", href: "/#experimentation" },
      { label: "Feature flags", href: "/#experimentation" },
      { label: "CRM", href: "/#crm" },
    ],
  },
  {
    title: "DEVELOPERS",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "React Native SDK", href: "/docs/react-native" },
      { label: "MCP server", href: "/docs/mcp" },
      { label: "CLI", href: "/docs/cli" },
      { label: "API reference", href: "/docs/api" },
    ],
  },
  {
    title: "OPEN SOURCE",
    links: [
      { label: "GitHub", href: GITHUB_REPO },
      { label: "Self-hosting", href: GITHUB_REPO },
      { label: "Licensing", href: `${GITHUB_REPO}/blob/main/LICENSE.md` },
      { label: "Contributing", href: `${GITHUB_REPO}/blob/main/CONTRIBUTING.md` },
      { label: "Changelog", href: `${GITHUB_REPO}/releases` },
    ],
  },
  {
    title: "COMPANY",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Blog" },
      { label: "Security" },
      { label: "Privacy" },
      { label: "Contact" },
    ],
  },
];

const BOTTOM_LINKS: { label: string; href?: string }[] = [
  { label: "Status" },
  { label: "Terms" },
  { label: "X", href: "https://x.com/voidhashcom" },
  { label: "Discord", href: "https://discord.gg/voidhash" },
  { label: "GitHub", href: GITHUB_REPO },
];

function FooterLink({
  label,
  href,
  className,
}: {
  label: string;
  href?: string;
  className: string;
}) {
  if (!href) {
    return <div className={className}>{label}</div>;
  }
  const external = href.startsWith("http");
  return (
    <a
      className={`${className} transition-colors hover:text-white`}
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {label}
    </a>
  );
}

/** Renders the landing page footer. */
export function LandingFooter() {
  return (
    <footer className="flex min-w-0 flex-col items-center self-stretch">
      <div className="flex w-full max-w-[1656px] flex-col gap-14 px-6 pt-16 pb-16 md:px-12 md:pt-24 lg:flex-row lg:items-start lg:justify-between lg:gap-20 xl:px-32">
        <div className="flex w-full max-w-85 shrink-0 flex-col gap-5.5">
          <a aria-label="Voidhash home" href="/">
            <Logo className="h-[17px] w-auto text-white" />
          </a>
          <div className="font-sans text-zinc-400 text-sm/normal tracking-[-0.01em]">
            The open-source growth platform for mobile apps.
          </div>
        </div>
        <div className="grid grow grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-4 lg:flex lg:items-start lg:justify-end lg:gap-20">
          {LINK_COLUMNS.map((column) => (
            <div className="flex flex-col gap-3.5 lg:w-42.5 lg:shrink-0" key={column.title}>
              <div className="font-mono text-zinc-500 text-[11px]/3.5 tracking-[0.06em]">
                {column.title}
              </div>
              {column.links.map((link) => (
                <FooterLink
                  className="w-max font-sans text-zinc-200 text-sm/4.5 tracking-[-0.01em]"
                  href={link.href}
                  key={link.label}
                  label={link.label}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex w-full max-w-[1656px] flex-col gap-4 px-6 pt-6.5 pb-10 sm:flex-row sm:items-center sm:justify-between sm:gap-10 md:px-12 xl:px-32">
        <div className="font-sans text-zinc-500 text-[13px]/4 tracking-[-0.01em]">
          © 2026 Voidhash s.r.o.
        </div>
        <div className="flex flex-wrap items-center gap-7">
          {BOTTOM_LINKS.map((link) => (
            <FooterLink
              className="font-sans text-zinc-500 text-[13px]/4 tracking-[-0.01em]"
              href={link.href}
              key={link.label}
              label={link.label}
            />
          ))}
        </div>
      </div>
    </footer>
  );
}
