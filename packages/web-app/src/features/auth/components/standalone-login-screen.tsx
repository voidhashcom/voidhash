import { AuthScreenLayout } from "./auth-screen-layout";
import { StandaloneSignInForm } from "./standalone-sign-in-form";

/** The one sign-in screen the standalone provider offers. */
export function StandaloneLoginScreen({ next }: { next?: string | undefined }) {
  return (
    <AuthScreenLayout>
      <h1 className="text-3xl font-medium leading-[43px] tracking-[-0.03em] sm:text-4xl">
        Welcome back!
      </h1>
      <StandaloneSignInForm next={next} />
    </AuthScreenLayout>
  );
}
