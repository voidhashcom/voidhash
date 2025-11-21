'use client'; // Error boundaries must be Client Components

import { ErrorCard } from '@voidhash/ui';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
export default function ErrorRender({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (error.name === 'VoidhashError:UNAUTHORIZED' && pathname !== '/login') {
      router.push('/login');
    }

    setInitialized(true);
  }, [error, pathname, router]);

  if (!initialized) {
    return <div>Loading...</div>;
  }

  return (
    <ErrorCard
      className="h-screen"
      description="Please try again"
      onRetry={() => reset()}
      title="Something went wrong!"
    />
  );
}
