import { Spinner } from '@voidhash/ui';

export default function SignUpLoading() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
