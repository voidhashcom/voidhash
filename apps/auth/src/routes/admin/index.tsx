import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@voidhash/ui';
import { Plus, RefreshCw, Settings } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getAdminClients,
  syncTrustedClients
} from '../../lib/admin-server-functions';

export const Route = createFileRoute('/admin/')({
  component: AdminClientsPage,
  loader: async () => {
    const clients = await getAdminClients();
    return { clients };
  }
});

function AdminClientsPage() {
  const { clients } = Route.useLoaderData();
  const [syncing, setSyncing] = useState(false);
  const syncClients = useServerFn(syncTrustedClients);

  const formatDate = (date: Date | null) => {
    if (!date) {
      return 'N/A';
    }
    return new Date(date).toLocaleDateString();
  };

  const handleSyncTrustedClients = async () => {
    try {
      setSyncing(true);
      const result = await syncClients();
      const createdCount = result.results.filter(
        (r: { action: string }) => r.action === 'created'
      ).length;
      const updatedCount = result.results.filter(
        (r: { action: string }) => r.action === 'updated'
      ).length;

      if (createdCount > 0 || updatedCount > 0) {
        toast.success(
          `Synced trusted clients: ${createdCount} created, ${updatedCount} updated`
        );
        // Reload the page to show updated clients
        window.location.reload();
      } else {
        toast.info('All trusted clients are already in sync');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to sync trusted clients';
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
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
              className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`}
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
                      {client.name || 'Unnamed'}
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {client.clientId ?? ''}
                      </code>
                    </TableCell>
                    <TableCell>
                      {client.type ? (
                        <Badge variant="outline">{client.type}</Badge>
                      ) : (
                        'N/A'
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
                        params={{ clientId: client.clientId ?? '' }}
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
