import { Card, CardHeader, CardTitle, Logo } from '@voidhash/ui';

export default function ConsentLoading() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6">
          <div className="flex justify-center">
            <Logo />
          </div>
          <Card className="mt-4">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Loading...</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}
