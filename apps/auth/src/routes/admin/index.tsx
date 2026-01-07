import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@voidhash/ui";
import { AlertCircle, Copy, Plus, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  getAdminClients,
  syncTrustedClients,
} from "../../lib/admin-server-functions";

export const Route = createFileRoute("/admin/")({
  component: AdminClientsPage,
  loader: async () => {
    const clients = await getAdminClients();
    return { clients };
  },
});

interface SyncedCredential {
  clientId: string;
  clientSecret: string;
  name: string;
}

function AdminClientsPage() {
  const { clients } = Route.useLoaderData();
  const [syncing, setSyncing] = useState(false);
  const [syncedCredentials, setSyncedCredentials] = useState<
    SyncedCredential[]
  >([]);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const syncClients = useServerFn(syncTrustedClients);

  const formatDate = (date: Date | null) => {
    if (!date) {
      return "N/A";
    }
    return new Date(date).toLocaleDateString();
  };

  const handleSyncTrustedClients = async () => {
    try {
      setSyncing(true);
      const result = await syncClients();
      const createdResults = result.results.filter(
        (r: { action: string; clientSecret?: string }) =>
          r.action === "created" && r.clientSecret
      );
      const createdCount = result.results.filter(
        (r: { action: string }) => r.action === "created"
      ).length;
      const updatedCount = result.results.filter(
        (r: { action: string }) => r.action === "updated"
      ).length;

      if (createdCount > 0 || updatedCount > 0) {
        toast.success(
          `Synced trusted clients: ${createdCount} created, ${updatedCount} updated`
        );

        // If new clients were created, show their credentials
        if (createdResults.length > 0) {
          setSyncedCredentials(
            createdResults.map(
              (r: {
                clientId: string;
                clientSecret?: string;
                name: string;
              }) => ({
                clientId: r.clientId,
                clientSecret: r.clientSecret ?? "",
                name: r.name,
              })
            )
          );
          setShowCredentialsDialog(true);
        } else {
          // Reload the page to show updated clients
          window.location.reload();
        }
      } else {
        toast.info("All trusted clients are already in sync");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sync trusted clients";
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleCredentialsDialogClose = () => {
    setShowCredentialsDialog(false);
    setSyncedCredentials([]);
    // Reload the page to show updated clients
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            handleCredentialsDialogClose();
          }
        }}
        open={showCredentialsDialog}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              New Client Credentials
            </AlertDialogTitle>
            <AlertDialogDescription>
              Copy these credentials now. The client secrets will not be shown
              again after you close this dialog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-96 space-y-4 overflow-y-auto">
            {syncedCredentials.map((cred) => (
              <div
                className="space-y-3 rounded-lg border bg-muted/50 p-4"
                key={cred.clientId}
              >
                <div className="font-medium">{cred.name}</div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Client ID
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background px-3 py-2 font-mono text-sm">
                      {cred.clientId}
                    </code>
                    <Button
                      onClick={() => copyToClipboard(cred.clientId)}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Client Secret
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background px-3 py-2 font-mono text-sm">
                      {cred.clientSecret}
                    </code>
                    <Button
                      onClick={() => copyToClipboard(cred.clientSecret)}
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Combined (clientId:clientSecret)
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-background px-3 py-2 font-mono text-sm">
                      {cred.clientId}:{cred.clientSecret}
                    </code>
                    <Button
                      onClick={() =>
                        copyToClipboard(`${cred.clientId}:${cred.clientSecret}`)
                      }
                      size="sm"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600" />
              <div className="text-sm text-yellow-800">
                <strong>Important:</strong> Copy these credentials now. You
                won&apos;t be able to see the client secrets again after closing
                this dialog.
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCredentialsDialogClose}>
              I&apos;ve copied the credentials
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-2xl">OAuth Clients</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage OIDC clients for single sign-on
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={syncing}
            onClick={handleSyncTrustedClients}
            variant="outline"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            Sync Trusted Clients
          </Button>
          <Link to="/admin/clients/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </Link>
        </div>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No clients found</CardTitle>
            <CardDescription>
              Get started by creating your first OAuth client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/admin/clients/new">
              <Button>Create Client</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registered Clients</CardTitle>
            <CardDescription>
              All OAuth clients registered with your OIDC provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      {client.name || "Unnamed"}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {client.clientId ?? ""}
                      </code>
                    </TableCell>
                    <TableCell>
                      {client.type ? (
                        <Badge variant="outline">{client.type}</Badge>
                      ) : (
                        "N/A"
                      )}
                    </TableCell>
                    <TableCell>
                      {client.disabled ? (
                        <Badge variant="destructive">Disabled</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(client.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        params={{ clientId: client.clientId ?? "" }}
                        to="/admin/clients/$clientId"
                      >
                        <Button size="sm" variant="outline">
                          <Settings className="mr-2 h-4 w-4" />
                          Manage
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
