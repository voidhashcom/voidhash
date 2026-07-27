// Inspired by https://github.com/unkeyed/examples/blob/main/unkey-cli/web/app/auth/devices/page.tsx

import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { Button } from "@voidhash/ui";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AuthHeader, AuthLayout } from "@/features/auth/components/auth-layout";
import { createUserApiKeyOptions } from "@/features/auth/lib/tanstack-query";
import {
  DEVICE_CODE_EXPIRY_MS,
  isDeviceCodeExpired,
  isValidLocalRedirect,
} from "@/features/auth/lib/validation";

const devicesSearchSchema = z.object({
  code: z.string().optional(),
  expires: z.string().optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/devices/")({
  component: AuthDevicesPage,
  loader: async ({ location }) => {
    const auth = await getAuth();
    if (!auth.user) {
      const params = new URLSearchParams(location.searchStr);
      const nextUrl = `/auth/devices?${params.toString()}`;
      throw redirect({ search: { next: nextUrl }, to: "/auth/login" });
    }
  },
  validateSearch: zodValidator(devicesSearchSchema),
});

function CodeCharacter({ char }: { char: string }) {
  return <div className="rounded-lg bg-accent p-2 font-mono text-xl lg:p-2 lg:text-xl">{char}</div>;
}

function Cancelled() {
  return (
    <AuthLayout>
      <AuthHeader description="You can return to your CLI." title="Login cancelled" />
    </AuthLayout>
  );
}

function Success() {
  return (
    <AuthLayout>
      <AuthHeader description="You can return to your CLI." title="Login successful!" />
    </AuthLayout>
  );
}

function ErrorCard({
  title = "An error occurred",
  description = "Please try again. If the problem persists, please contact us at support@voidhash.com.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <AuthLayout>
      <AuthHeader description={description} title={title} />
      <div className="mt-10">
        <Button asChild className="w-full cursor-pointer" size="lg" variant="outline">
          <Link to="/auth/login">Return to login</Link>
        </Button>
      </div>
    </AuthLayout>
  );
}

function ExpiredCard() {
  return (
    <AuthLayout>
      <AuthHeader
        description="This authorization request has expired. Please return to your CLI and try again."
        title="Code expired"
      />
      <p className="mt-6 text-muted-foreground text-xs">
        Device codes expire after {Math.floor(DEVICE_CODE_EXPIRY_MS / 60_000)} minutes for security.
      </p>
    </AuthLayout>
  );
}

function AuthDevicesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [success, setSuccess] = useState(false);

  const { mutateAsync: createUserApiKey } = useMutation({
    ...createUserApiKeyOptions(),
  });

  const searchParams = Route.useSearch();

  const { code, redirect: redirectUrl, expires } = searchParams;

  if (!(code && redirectUrl)) {
    return (
      <ErrorCard
        description="The authorization request is missing required parameters. Please return to your CLI and try again."
        title="Invalid request"
      />
    );
  }

  if (!isValidLocalRedirect(redirectUrl)) {
    return (
      <ErrorCard
        description="The redirect URL must be a localhost address. This is required for security."
        title="Invalid redirect"
      />
    );
  }

  if (isDeviceCodeExpired(expires)) {
    return <ExpiredCard />;
  }

  const confirm = async () => {
    setIsLoading(true);
    try {
      const { rawKey } = await createUserApiKey({ name: "CLI", prefix: "vh_cli_" });

      const url = new URL(redirectUrl);
      url.searchParams.append("code", code);
      url.searchParams.append("key", rawKey);
      await fetch(url.toString());
      setIsLoading(false);
      setSuccess(true);
    } catch (error) {
      console.error("[devices] failed to issue CLI key", error);
      toast.error("Error creating Voidhash API key.");
      setIsLoading(false);
    }
  };

  const cancel = async () => {
    try {
      setIsLoading(true);
      const url = new URL(redirectUrl);
      url.searchParams.append("cancelled", "true");
      await fetch(url.toString());
      setIsLoading(false);
      setCancelled(true);
    } catch {
      setIsLoading(false);
      toast.error("Error cancelling login. Is your local CLI running?");
    }
  };

  if (cancelled) {
    return <Cancelled />;
  }

  if (success) {
    return <Success />;
  }

  return (
    <AuthLayout>
      <AuthHeader
        description="Please confirm this is the code shown in your terminal."
        title="Device confirmation"
      />
      <div className="mt-10 flex flex-col gap-6">
        <div className="flex flex-row items-center justify-center">
          <div className="grid auto-cols-auto grid-flow-col gap-1 leading-none lg:gap-3">
            {[...code].map((char, i) => (
              <CodeCharacter
                char={char}
                key={`${char}-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: OK in this case
                  i
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            className="w-full cursor-pointer"
            disabled={isLoading}
            onClick={confirm}
            size="lg"
            type="submit"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Processing..." : "Confirm code"}
          </Button>
          <Button
            className="w-full cursor-pointer"
            disabled={isLoading}
            onClick={cancel}
            size="lg"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
