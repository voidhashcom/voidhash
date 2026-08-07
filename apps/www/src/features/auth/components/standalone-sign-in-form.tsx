import { useMutation } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle, Button, Input, Label } from "@voidhash/ui";
import { AlertCircle, Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import { signInWithRootCredentials } from "@/features/auth/lib/auth-api";

/** Reads a form field as text, ignoring file entries the form never produces. */
const formFieldValue = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  if (typeof value === "string") return value;
  return "";
};

/**
 * Sign-in for the standalone identity provider: the single root account, whose
 * username and password come from the deployment's environment. There is no
 * sign-up, no password reset, and no second user.
 */
export function StandaloneSignInForm({ next }: { next?: string | undefined }) {
  const [error, setError] = useState<string>();
  const signInMutation = useMutation({
    mutationFn: signInWithRootCredentials,
    onError: (mutationError) => {
      setError(mutationError.message);
    },
    onMutate: () => {
      setError(undefined);
    },
    onSuccess: (payload) => {
      // A full navigation so the new cookie is picked up by the server render
      // and the access-token bridge re-seeds from the session endpoint.
      window.location.href = payload.redirectTo ?? "/studio";
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    signInMutation.mutate({
      password: formFieldValue(formData, "password"),
      returnPathname: next,
      username: formFieldValue(formData, "username"),
    });
  };

  return (
    <form className="mt-10 flex flex-col gap-6" onSubmit={handleSubmit}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            autoComplete="username"
            autoFocus
            id="username"
            name="username"
            placeholder="root"
            required
            size={"lg"}
            type="text"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            autoComplete="current-password"
            id="password"
            name="password"
            required
            size={"lg"}
            type="password"
          />
        </div>
        <Button
          className="w-full cursor-pointer"
          disabled={signInMutation.isPending}
          size={"lg"}
          type="submit"
        >
          {signInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        Voidhash self-host signs in with the root credentials from your
        environment (<code>VOIDHASH_ROOT_USERNAME</code> and{" "}
        <code>VOIDHASH_ROOT_PASSWORD</code>).
      </p>
    </form>
  );
}
