import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@voidhash/ui';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { authClient } from '../../../lib/auth-client';

const newClientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  redirect_uris: z.string().min(1, 'At least one redirect URI is required'),
  type: z.enum(['web', 'native', 'spa']),
  scope: z.string().default('openid profile email')
});

export const Route = createFileRoute('/admin/clients/new')({
  component: NewClientPage,
  validateSearch: zodValidator(newClientSchema.partial())
});

function NewClientPage() {
  const [loading, setLoading] = useState(false);
  const [createdClient, setCreatedClient] = useState<{
    clientId: string;
    clientSecret: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    redirect_uris: '',
    type: 'web' as 'web' | 'native' | 'spa',
    scope: 'openid profile email'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectUris = formData.redirect_uris
        .split(',')
        .map((uri) => uri.trim())
        .filter(Boolean);

      if (redirectUris.length === 0) {
        toast.error('At least one redirect URI is required');
        setLoading(false);
        return;
      }

      const { data, error } = await authClient.oauth2.register({
        client_name: formData.name,
        redirect_uris: redirectUris,
        type: formData.type,
        scope: formData.scope
      });

      if (error) {
        toast.error(error.message ?? 'Failed to create client');
        setLoading(false);
        return;
      }

      if (data?.client_id && data?.client_secret) {
        setCreatedClient({
          clientId: data.client_id,
          clientSecret: data.client_secret
        });
        toast.success('OAuth client created successfully');
      }
    } catch (error) {
      toast.error('An error occurred while creating the client');
    } finally {
      setLoading(false);
    }
  };

  if (createdClient) {
    return (
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <CardTitle>Client Created Successfully</CardTitle>
            </div>
            <CardDescription>
              Save these credentials securely. The client secret will not be
              shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="text-muted-foreground text-xs">Client ID</Label>
              <code className="mt-1 block break-all rounded bg-background px-3 py-2 font-mono text-sm">
                {createdClient.clientId}
              </code>
            </div>
            <div className="rounded-lg border bg-muted/50 p-4">
              <Label className="text-muted-foreground text-xs">
                Client Secret
              </Label>
              <code className="mt-1 block break-all rounded bg-background px-3 py-2 font-mono text-sm">
                {createdClient.clientSecret}
              </code>
            </div>
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600" />
                <div className="text-sm text-yellow-800">
                  <strong>Important:</strong> Copy the client secret now. You
                  won&apos;t be able to see it again after leaving this page.
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Link to="/admin">
              <Button variant="outline">Back to Clients</Button>
            </Link>
            <Button
              onClick={() => {
                setCreatedClient(null);
                setFormData({
                  name: '',
                  redirect_uris: '',
                  type: 'web',
                  scope: 'openid profile email'
                });
              }}
            >
              Create Another
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create New OAuth Client</CardTitle>
          <CardDescription>
            Register a new OAuth client for single sign-on
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Client Name</Label>
              <Input
                id="name"
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="My Application"
                required
                value={formData.name}
              />
              <p className="text-muted-foreground text-xs">
                A friendly name to identify this client
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="redirect_uris">Redirect URIs</Label>
              <Input
                id="redirect_uris"
                onChange={(e) =>
                  setFormData({ ...formData, redirect_uris: e.target.value })
                }
                placeholder="https://app.example.com/callback, https://app.example.com/auth/callback"
                required
                value={formData.redirect_uris}
              />
              <p className="text-muted-foreground text-xs">
                Comma-separated list of allowed redirect URIs
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Client Type</Label>
              <Select
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    type: value as 'web' | 'native' | 'spa'
                  })
                }
                value={formData.type}
              >
                <SelectTrigger className="w-full" id="type">
                  <SelectValue placeholder="Select client type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web">Web Application</SelectItem>
                  <SelectItem value="native">Native Application</SelectItem>
                  <SelectItem value="spa">Single Page Application</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                The type of application this client represents
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Scopes</Label>
              <Input
                id="scope"
                onChange={(e) =>
                  setFormData({ ...formData, scope: e.target.value })
                }
                placeholder="openid profile email"
                value={formData.scope}
              />
              <p className="text-muted-foreground text-xs">
                Space-separated list of OAuth scopes (default: openid profile
                email)
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Link to="/admin">
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button disabled={loading} type="submit">
              {loading ? 'Creating...' : 'Create Client'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
