import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Devices from "@/pages/devices";
import Events from "@/pages/events";
import SettingsPage from "@/pages/settings";
import Commands from "@/pages/commands";
import Tasks from "@/pages/tasks";
import Logs from "@/pages/logs";
import DeviceUsersPage from "@/pages/users";
import Login from "@/pages/login";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clients" component={Clients} />
      <Route path="/devices" component={Devices} />
      <Route path="/users" component={DeviceUsersPage} />
      <Route path="/events" component={Events} />
      <Route path="/commands" component={Commands} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/logs" component={Logs} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp({ username, onLogout }: { username: string; onLogout: () => void }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    onLogout();
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground" data-testid="text-current-user">{username}</span>
              <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout" title="Cerrar sesion">
                <LogOut className="w-4 h-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { data: session, isLoading } = useQuery<{ authenticated: boolean; username?: string }>({
    queryKey: ["/api/auth/session"],
  });

  function handleAuthChange() {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return <Login onLogin={handleAuthChange} />;
  }

  return <AuthenticatedApp username={session.username || ""} onLogout={handleAuthChange} />;
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
