import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { Activity, Database, FileText, LogOut, Users } from "lucide-react";

import { useAuth } from "@/components/auth-context";
import { useDatabase } from "@/components/database-context";
import { useMimicSdk } from "@/components/sdk-context";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { collectionsQuery, databasesQuery } from "@/lib/queries";

export function AppSidebar() {
  const { credentials, logout } = useAuth();
  const sdk = useMimicSdk();
  const { selectedDatabaseId, setSelectedDatabaseId } = useDatabase();
  const matchRoute = useMatchRoute();

  const { data: databases } = useQuery(databasesQuery(sdk));
  const { data: collections } = useQuery(collectionsQuery(sdk, selectedDatabaseId ?? ""));

  const navItems = [
    { to: "/databases" as const, label: "Databases", icon: Database },
    { to: "/users" as const, label: "Users", icon: Users },
    { to: "/observability" as const, label: "Observability", icon: Activity },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Mimic Admin</h1>
        <Button variant="ghost" size="icon" onClick={logout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      <div className="p-4">
        <Select
          value={selectedDatabaseId ?? ""}
          onValueChange={(v) => setSelectedDatabaseId(v || null)}
        >
          <SelectTrigger className="w-full">
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

      <nav className="flex flex-col gap-1 px-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = !!matchRoute({ to });
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {selectedDatabaseId && collections && collections.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="px-4 py-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">Collections</span>
          </div>
          <ScrollArea className="flex-1 px-2">
            <div className="flex flex-col gap-1">
              {collections.map((col) => {
                const isActive = !!matchRoute({
                  to: "/collections/$collectionId",
                  params: { collectionId: col.id },
                });
                return (
                  <Link
                    key={col.id}
                    to="/collections/$collectionId"
                    params={{ collectionId: col.id }}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    {col.name}
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        </>
      )}

      <div className="mt-auto border-t p-4">
        <div className="text-xs text-muted-foreground">
          <div className="truncate">{credentials.serverUrl}</div>
          <div className="mt-1 truncate font-medium">{credentials.username}</div>
        </div>
      </div>
    </div>
  );
}
