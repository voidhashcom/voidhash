import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from "@voidhash/ui";
import { ArrowLeft, Copy, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteAdminClient,
  getAdminClient,
  rotateAdminClientSecret,
  updateAdminClient,
} from "../../../lib/admin-server-functions";

export const Route = createFileRoute("/admin/clients/$clientId")({
  component: ClientDetailPage,
  loader: async ({ params }) => {
    const client = await getAdminClient({
      data: { clientId: params.clientId },
    });
    return { client };
  },
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { client } = Route.useLoaderData();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    disabled: client?.disabled,
    name: client?.name || "",
    redirectUris: client?.redirectUris || "",
  });

  const getClient = useServerFn(getAdminClient);
  const updateClient = useServerFn(updateAdminClient);
  const deleteClient = useServerFn(deleteAdminClient);
  const rotateClientSecret = useServerFn(rotateAdminClientSecret);

  const loadClient = async () => {
    try {
      setLoading(true);
      const data = await getClient({ data: { clientId } });
      setFormData({
        disabled: data.disabled,
        name: data.name || "",
        redirectUris: data.redirectUris || "",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load client details";
      if (errorMessage === "Client not found") {
        toast.error("Client not found");
        navigate({ to: "/admin" });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateClient({
        data: {
          clientId,
          updates: {
            disabled: formData.disabled ?? undefined,
            name: formData.name,
            redirectUris: formData.redirectUris,
          },
        },
      });

      toast.success("Client updated successfully");
      await loadClient();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update client";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteClient({ data: { clientId } });

      toast.success("Client deleted successfully");
      navigate({ to: "/admin" });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete client";
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleRotateSecret = async () => {
    try {
      setRotating(true);
      setRotatedSecret(null);
      const result = await rotateClientSecret({ data: { clientId } });
      setRotatedSecret(result.clientSecret);
      toast.success("Client secret rotated successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to rotate client secret";
      toast.error(errorMessage);
    } finally {
      setRotating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/admin">
          <Button size="sm" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h2 className="font-semibold text-2xl">
            {client.name || "Unnamed Client"}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage OAuth client settings
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client Information</CardTitle>
          <CardDescription>View and manage client details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client ID</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                {client.clientId}
              </code>
              <Button
                onClick={() => copyToClipboard(client.clientId ?? "")}
                size="sm"
                variant="outline"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Client Secret</Label>
            <div className="flex items-center gap-2">
              {rotatedSecret ? (
                <>
                  <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                    {rotatedSecret}
                  </code>
                  <Button
                    onClick={() => copyToClipboard(rotatedSecret)}
                    size="sm"
                    variant="outline"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <p className="flex-1 text-muted-foreground text-sm">
                  Secret is hidden. Rotate to generate a new one.
                </p>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={rotating} size="sm" variant="outline">
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${rotating ? "animate-spin" : ""}`}
                    />
                    {rotating ? "Rotating..." : "Rotate Secret"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rotate Client Secret?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will generate a new client secret. The old secret
                      will be invalidated immediately. Make sure to update your
                      application with the new secret.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRotateSecret}>
                      Rotate Secret
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {rotatedSecret && (
              <p className="text-amber-600 text-xs">
                Copy this secret now. It won't be shown again after you leave
                this page.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Client Name</Label>
            <Input
              id="name"
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              value={formData.name}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="redirectUrls">Redirect URIs</Label>
            <Input
              id="redirectUrls"
              onChange={(e) =>
                setFormData({ ...formData, redirectUris: e.target.value })
              }
              placeholder="https://app.example.com/callback"
              value={formData.redirectUris}
            />
            <p className="text-muted-foreground text-xs">
              Comma-separated list of allowed redirect URIs
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="disabled">Status</Label>
              <p className="text-muted-foreground text-xs">
                Disable this client to prevent authentication
              </p>
            </div>
            <div className="flex items-center gap-2">
              {formData.disabled ? (
                <Badge variant="destructive">Disabled</Badge>
              ) : (
                <Badge variant="default">Active</Badge>
              )}
              <Switch
                checked={formData.disabled ?? false}
                id="disabled"
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, disabled: checked })
                }
              />
            </div>
          </div>

          {client.type && (
            <div className="space-y-2">
              <Label>Client Type</Label>
              <Badge variant="outline">{client.type}</Badge>
            </div>
          )}

          {client.createdAt && (
            <div className="space-y-2">
              <Label>Created</Label>
              <p className="text-muted-foreground text-sm">
                {new Date(client.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={deleting} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Client"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  OAuth client and revoke all associated access tokens.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
