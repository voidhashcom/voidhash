import { AuthScreenLayout } from "./auth-screen-layout";
import { StandaloneSignInForm } from "./standalone-sign-in-form";

/** The one sign-in screen the standalone provider offers. */
export function StandaloneLoginScreen({ next }: { next?: string | undefined }) {
  return (
    <AuthScreenLayout>
      <div className="flex flex-col items-start gap-2 text-left">
        <h1 className="text-3xl">Welcome back!</h1>
      </div>
      <StandaloneSignInForm next={next} />
    </AuthScreenLayout>
  );
}
