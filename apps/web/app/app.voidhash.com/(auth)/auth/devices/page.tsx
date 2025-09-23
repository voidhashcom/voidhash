// Inspired by https://github.com/unkeyed/examples/blob/main/unkey-cli/web/app/auth/devices/page.tsx
'use client';

import { authClient } from '@voidhash/auth/client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Logo
} from '@voidhash/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

function CodeCharacter({ char }: { char: string }) {
  return (
    <div className="rounded-2xl bg-accent p-2 font-mono text-xl lg:p-4 lg:text-3xl">
      {char}
    </div>
  );
}

function AuthDevicePageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="flex justify-center">
            <Link href="/login">
              <Logo />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function Cancelled() {
  return (
    <AuthDevicePageLayout>
      <Card className="mt-4 min-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Login cancelled</CardTitle>
          <CardDescription>You can return to your CLI.</CardDescription>
        </CardHeader>
      </Card>
    </AuthDevicePageLayout>
  );
}

function Success() {
  return (
    <AuthDevicePageLayout>
      <Card className="mt-4 min-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Login successful!</CardTitle>
          <CardDescription>You can return to your CLI.</CardDescription>
        </CardHeader>
      </Card>
    </AuthDevicePageLayout>
  );
}

function ErrorCard() {
  return (
    <AuthDevicePageLayout>
      <Card className="mt-4 min-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">An error occurred</CardTitle>
          <CardDescription>
            Please try again. If the problem persists, please contact us at
            support@voidhash.com.
          </CardDescription>
        </CardHeader>
      </Card>
    </AuthDevicePageLayout>
  );
}

export default function AuthDevicesPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [success, setSuccess] = useState(false);

  const searchParams = useSearchParams();

  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect');

  if (!(code && redirect)) {
    return <ErrorCard />;
  }

  const confirm = async () => {
    setIsLoading(true);
    const { data, error } = await authClient.apiKey.create({
      name: 'CLI',
      prefix: 'vh_cli_'
    });

    if (error) {
      toast.error('Error creating Voidhash API key.');
      setIsLoading(false);
      return;
    }

    try {
      const redirectUrl = new URL(redirect);
      redirectUrl.searchParams.append('code', code);
      redirectUrl.searchParams.append('key', data.key);
      await fetch(redirectUrl.toString());
      setIsLoading(false);
      setSuccess(true);
    } catch (_error) {
      toast.error('"Error redirecting back to local CLI. Is your CLI running?');
      setIsLoading(false);
      return;
    }
  };

  const cancel = async () => {
    try {
      setIsLoading(true);
      const redirectUrl = new URL(redirect);
      redirectUrl.searchParams.append('cancelled', 'true');
      await fetch(redirectUrl.toString());
      setIsLoading(false);
      setCancelled(true);
    } catch (_error) {
      setIsLoading(false);
      toast.error('Error cancelling login. Is your local CLI running?');
    }
  };

  if (cancelled) {
    return <Cancelled />;
  }

  if (success) {
    return <Success />;
  }

  return (
    <AuthDevicePageLayout>
      <Card className="mt-4 min-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Device confirmation</CardTitle>
          <CardDescription>
            Please confirm this is the code shown in your terminal
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-row items-center justify-center">
            <div className="grid auto-cols-auto grid-flow-col gap-1 pt-6 leading-none lg:gap-3">
              {code?.split('').map((char, i) => (
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
          <div className="mt-6 flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={isLoading}
              onClick={confirm}
              type="submit"
            >
              Confirm code
            </Button>
            <Button
              className="w-full"
              disabled={isLoading}
              onClick={cancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthDevicePageLayout>
  );
}
