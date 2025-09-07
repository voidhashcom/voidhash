import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@voidhash/ui';
import Link from 'next/link';

export function ProductDetailPaymentProvidersEmptyState({
  projectSlug,
  organizationSlug
}: {
  projectSlug: string;
  organizationSlug: string;
}) {
  return (
    <Card className="mx-auto w-full max-w-5xl text-center">
      <CardHeader>
        <CardTitle>No payment providers enabled</CardTitle>
        <CardDescription>
          Setup and enable at least one payment provider before proceeding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link
          href={`/${organizationSlug}/${projectSlug}/settings/payment-providers`}
        >
          <Button>Setup payment providers</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
