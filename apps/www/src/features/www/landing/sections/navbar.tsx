"use client";

import {
  Button,
  Logo,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  navigationMenuTriggerStyle,
} from "@voidhash/ui";
import {
  BookOpenIcon,
  BracesIcon,
  ChartColumnIcon,
  FlaskConicalIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  MenuIcon,
  UsersIcon,
} from "lucide-react";

import { MARKETING_COMPANY_LINKS } from "@/features/www/landing/marketing-nav-config";
import { signUpCtaLabel } from "@/lib/waitlist";

type NavLink = {
  label: string;
  href: string;
  description?: string;
  icon: LucideIcon;
};

/**
 * Product links point at landing page sections, so they stay root-relative: from a standalone
 * marketing page a bare `#paywalls` fragment resolves against a page that has no such section
 * and goes nowhere.
 */
const PRODUCT_LINKS: NavLink[] = [
  {
    label: "Paywalls",
    href: "/#paywalls",
    description: "No-code designer with AI, shipped without a release.",
    icon: LayoutTemplateIcon,
  },
  {
    label: "Analytics",
    href: "/#analytics",
    description: "See what drives conversion and revenue.",
    icon: ChartColumnIcon,
  },
  {
    label: "Experimentation",
    href: "/#experimentation",
    description: "Try ideas, compare results and launch what works.",
    icon: FlaskConicalIcon,
  },
  {
    label: "CRM",
    href: "/#crm",
    description: "See the full journey behind every customer.",
    icon: UsersIcon,
  },
];

const DEVELOPER_LINKS: NavLink[] = [
  { label: "Documentation", href: "/docs", icon: BookOpenIcon },
  { label: "API reference", href: "/docs/api", icon: BracesIcon },
];

/** Shared look for the top-level triggers and links. */
const NAV_ITEM_CLASS =
  "h-auto rounded-lg px-3 py-2 font-normal font-sans text-zinc-400 text-sm/4.5 tracking-[-0.03em] transition-colors hover:bg-white/5 hover:text-white focus:bg-white/5 focus:text-white data-pressed:bg-white/10 data-popup-open:bg-white/5 data-popup-open:text-white data-popup-open:hover:bg-white/5";

/** Shared look for the links inside a menu panel. */
const PANEL_ITEM_CLASS =
  "items-start gap-3 p-3 transition-colors hover:bg-zinc-900 focus:bg-zinc-900";

function ProductItem({ link }: { link: NavLink }) {
  const Icon = link.icon;
  return (
    <li>
      <NavigationMenuLink className={PANEL_ITEM_CLASS} render={<a href={link.href} />}>
        <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
        <div className="flex flex-col gap-1">
          <div className="font-medium font-sans text-white text-sm/4.5 tracking-[-0.02em]">
            {link.label}
          </div>
          <div className="font-sans text-zinc-400 text-xs/4 tracking-[-0.01em]">
            {link.description}
          </div>
        </div>
      </NavigationMenuLink>
    </li>
  );
}

function DeveloperItem({ link }: { link: NavLink }) {
  const Icon = link.icon;
  return (
    <li>
      <NavigationMenuLink
        className={`${PANEL_ITEM_CLASS} items-center gap-2.5 p-2.5`}
        render={<a href={link.href} />}
      >
        <Icon className="size-4 shrink-0 text-zinc-500" />
        <div className="font-sans text-zinc-200 text-sm/4.5 tracking-[-0.02em]">{link.label}</div>
      </NavigationMenuLink>
    </li>
  );
}

/** Renders the landing page navigation bar. */
export function LandingNavbar() {
  return (
    <div className="sticky top-0 z-50 flex min-w-0 flex-col items-center self-stretch border-zinc-800 border-b bg-zinc-950/85 backdrop-blur-md">
      <div className="flex w-full max-w-[1656px] items-center justify-between gap-4 border-zinc-800 p-4 md:p-6 xl:border-x">
        <a aria-label="Voidhash home" href="/">
          <Logo className="h-[17px] w-auto text-white" />
        </a>
        <NavigationMenu className="hidden lg:flex" popupClassName="dark">
          <NavigationMenuList className="-mx-3 gap-1">
            <NavigationMenuItem>
              <NavigationMenuTrigger className={NAV_ITEM_CLASS}>Product</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[540px] grid-cols-2 gap-1">
                  {PRODUCT_LINKS.map((link) => (
                    <ProductItem key={link.href} link={link} />
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className={NAV_ITEM_CLASS}>Developers</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[240px] gap-1">
                  {DEVELOPER_LINKS.map((link) => (
                    <DeveloperItem key={link.href} link={link} />
                  ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            {MARKETING_COMPANY_LINKS.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  className={`${navigationMenuTriggerStyle()} ${NAV_ITEM_CLASS}`}
                  render={<a href={link.href} />}
                >
                  {link.label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        <div className="hidden items-center gap-4 lg:flex">
          <Button asChild variant="outline">
            <a href="/auth/login">Log in</a>
          </Button>
          <Button asChild>
            <a href="/auth/sign-up">{signUpCtaLabel("Sign up")}</a>
          </Button>
        </div>
        <Sheet>
          <SheetTrigger asChild className="lg:hidden">
            <Button aria-label="Open menu" size="icon" variant="ghost">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent className="dark flex flex-col border-zinc-800 bg-zinc-950" side="right">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <nav className="flex flex-1 flex-col gap-8 overflow-y-auto px-6 pt-12">
              {[
                { title: "Product", links: PRODUCT_LINKS },
                { title: "Developers", links: DEVELOPER_LINKS },
                { title: "Company", links: MARKETING_COMPANY_LINKS },
              ]
                .filter((group) => group.links.length > 0)
                .map((group) => (
                  <div className="flex flex-col gap-4" key={group.title}>
                    <div className="font-sans text-zinc-500 text-xs/4 tracking-[-0.01em]">
                      {group.title}
                    </div>
                    {group.links.map((link) => (
                      <SheetClose asChild key={link.href}>
                        <a
                          className="flex items-center gap-3 font-sans text-zinc-200 text-base tracking-[-0.02em] transition-colors hover:text-white"
                          href={link.href}
                        >
                          <link.icon className="size-4 shrink-0 text-zinc-500" />
                          {link.label}
                        </a>
                      </SheetClose>
                    ))}
                  </div>
                ))}
            </nav>
            <div className="mt-auto flex flex-col gap-3 px-6 pb-8">
              <Button asChild size="lg" variant="outline">
                <a href="/auth/login">Log in</a>
              </Button>
              <Button asChild size="lg">
                <a href="/auth/sign-up">{signUpCtaLabel("Sign up")}</a>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
