import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MimicSDK } from "@voidhash/mimic-server";
import { Data, Effect } from "effect";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setCredentials } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

class ConnectionFailedError extends Data.TaggedError("ConnectionFailedError")<{
  readonly message: string;
}> {}

/** Extracts the operator-facing reason from an unknown connection failure. */
function connectionFailureReason(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return "Unknown error";
}

/** Label for the connect submit button. */
function connectLabel(isLoading: boolean): string {
  if (isLoading) return "Connecting...";
  return "Connect";
}

function LoginPage() {
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState("http://localhost:5001");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const creds = { serverUrl, username, password };
    // Build a transient SDK to validate the credentials. The real
    // long-lived SDK is owned by `MimicSdkProvider` once we navigate
    // into the protected app; this one gets disposed below.
    const sdk = new MimicSDK({
      url: creds.serverUrl,
      username: creds.username,
      password: creds.password,
    });

    const connect = Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: () => sdk.listDatabases(),
        catch: (cause) => new ConnectionFailedError({ message: connectionFailureReason(cause) }),
      });
      yield* Effect.try({
        try: () => {
          setCredentials(creds);
          void navigate({ to: "/" });
        },
        catch: (cause) => new ConnectionFailedError({ message: connectionFailureReason(cause) }),
      });
    }).pipe(
      Effect.catchTag("ConnectionFailedError", (error) =>
        Effect.sync(() => {
          toast.error(`Connection failed: ${error.message}`);
        }),
      ),
      Effect.ensuring(
        Effect.sync(() => {
          void sdk.dispose();
          setLoading(false);
        }),
      ),
    );

    void Effect.runPromise(connect);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Mimic Admin</CardTitle>
          <CardDescription>
            Connect to a mimic-db instance to manage your databases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:5001"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {connectLabel(loading)}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
