import { createFileRoute } from "@tanstack/react-router";
import { signOut } from "@workos/authkit-tanstack-react-start";
import { Spinner } from "@voidhash/ui";

import { VoidhashGradientBackground } from "@/components/voidhash-gradient-background";
import { toSafeReturnPathname } from "@/features/auth/lib/validation";

const logoutGradientSettings = {
  topEnabled: false,
  effectHeight: 100,
} as const;

export const Route = createFileRoute("/auth/logout")({
  component: LogoutPage,
  loader: async ({ location }) => {
    const returnTo = toSafeReturnPathname(
      new URLSearchParams(location.searchStr).get("returnTo"),
    ) ?? "/";

    await signOut({
      data: { returnTo },
    });
  },
});

function LogoutPage() {
  return (
    <div className="relative min-h-svh overflow-hidden bg-background">
      <VoidhashGradientBackground
        className="absolute inset-0"
        controlsQueryParam="logoutGradientControls"
        controlsStorageKey="voidhash:logout-gradient-controls"
        controlsTitle="Logout FX"
        fadeToBlack={false}
        lenticular
        settings={logoutGradientSettings}
        settingsStorageKey="voidhash:logout-gradient-settings"
      />
      <div className="relative z-10 flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    </div>
  );
}
