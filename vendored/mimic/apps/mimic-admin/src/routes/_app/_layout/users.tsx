import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Schema } from "effect";
import { toast } from "sonner";

import { useMimicSdk } from "@/components/sdk-context";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { databasesQuery, grantsQuery, usersQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/_layout/users")({
  component: UsersPage,
});

const decodePermission = Schema.decodeUnknownSync(Schema.Literals(["read", "write", "admin"]));

/** Label for the create-user submit button. */
function createLabel(isPending: boolean): string {
  if (isPending) return "Creating...";
  return "Create";
}

function UsersPage() {
  const sdk = useMimicSdk();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery(usersQuery(sdk));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: () => sdk.createUser({ username, password }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setUsername("");
      setPassword("");
      setOpen(false);
      toast.success("User created");
    },
    onError: (err) => toast.error(`Failed to create user: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
    onError: (err) => toast.error(`Failed to delete user: ${err.message}`),
  });

  let content = <p className="text-muted-foreground">Loading...</p>;
  if (!isLoading) {
    content = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>ID</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users?.map((user) => (
            <UserRow key={user.id} user={user} onDelete={() => deleteMutation.mutate(user.id)} />
          ))}
          {users?.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No users yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Users</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="u-name">Username</Label>
                <Input
                  id="u-name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-pass">Password</Label>
                <Input
                  id="u-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createLabel(createMutation.isPending)}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {content}
    </div>
  );
}

function UserRow({
  user,
  onDelete,
}: {
  user: { id: string; username: string; isSuperuser: boolean };
  onDelete: () => void;
}) {
  const sdk = useMimicSdk();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const { data: grants } = useQuery({
    ...grantsQuery(sdk, user.id),
    enabled: expanded,
  });
  const { data: databases } = useQuery({
    ...databasesQuery(sdk),
    enabled: expanded,
  });

  const [grantDbId, setGrantDbId] = useState("");
  const [grantPerm, setGrantPerm] = useState<"read" | "write" | "admin">("read");

  const grantMutation = useMutation({
    mutationFn: () =>
      sdk.grantPermission({
        userId: user.id,
        databaseId: grantDbId,
        permission: grantPerm,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["grants", user.id] });
      setGrantDbId("");
      toast.success("Permission granted");
    },
    onError: (err) => toast.error(`Failed to grant: ${err.message}`),
  });

  const revokeMutation = useMutation({
    mutationFn: (databaseId: string) => sdk.revokePermission({ userId: user.id, databaseId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["grants", user.id] });
      toast.success("Permission revoked");
    },
    onError: (err) => toast.error(`Failed to revoke: ${err.message}`),
  });

  let expandIcon = <ChevronRight className="h-4 w-4" />;
  if (expanded) {
    expandIcon = <ChevronDown className="h-4 w-4" />;
  }

  let roleBadge = <Badge variant="secondary">User</Badge>;
  if (user.isSuperuser) {
    roleBadge = <Badge>Superuser</Badge>;
  }

  let grantList = <p className="text-sm text-muted-foreground">No grants.</p>;
  if (grants && grants.length > 0) {
    grantList = (
      <div className="space-y-2">
        {grants.map((g) => (
          <div key={g.id} className="flex items-center gap-4 text-sm">
            <span className="font-mono text-xs">{g.databaseId}</span>
            <Badge variant="outline">{g.permission}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => revokeMutation.mutate(g.databaseId)}
            >
              Revoke
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
            {expandIcon}
          </Button>
        </TableCell>
        <TableCell className="font-medium">{user.username}</TableCell>
        <TableCell>{roleBadge}</TableCell>
        <TableCell className="font-mono text-xs text-muted-foreground">{user.id}</TableCell>
        <TableCell>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4 text-destructive-foreground" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete user?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{user.username}".
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 px-8 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Grants</h4>
              {grantList}

              <div className="flex items-end gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Database</Label>
                  <Select value={grantDbId} onValueChange={setGrantDbId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select database" />
                    </SelectTrigger>
                    <SelectContent>
                      {databases?.map((db) => (
                        <SelectItem key={db.id} value={db.id}>
                          {db.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Permission</Label>
                  <Select
                    value={grantPerm}
                    onValueChange={(v) => setGrantPerm(decodePermission(v))}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">read</SelectItem>
                      <SelectItem value="write">write</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!grantDbId || grantMutation.isPending}
                  onClick={() => grantMutation.mutate()}
                >
                  Grant
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
