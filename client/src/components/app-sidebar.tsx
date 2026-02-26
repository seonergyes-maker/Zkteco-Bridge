import { LayoutDashboard, Building2, Cpu, CalendarClock, Settings, Activity, Terminal, Timer, ScrollText, Users } from "lucide-react";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { AttendanceEvent } from "@shared/schema";

const menuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clientes", url: "/clients", icon: Building2 },
  { title: "Dispositivos", url: "/devices", icon: Cpu },
  { title: "Usuarios", url: "/users", icon: Users },
  { title: "Eventos", url: "/events", icon: CalendarClock },
  { title: "Comandos", url: "/commands", icon: Terminal },
  { title: "Tareas", url: "/tasks", icon: Timer },
  { title: "Log protocolo", url: "/logs", icon: ScrollText },
  { title: "Configuracion", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("es-ES"));

  useEffect(() => {
    const interval = setInterval(() => {
      setClock(new Date().toLocaleTimeString("es-ES"));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: pendingCount } = useQuery<number>({
    queryKey: ["/api/events/pending-count"],
    refetchInterval: 10000,
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
            <Activity className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">DCrono Hub</h2>
            <p className="text-xs text-muted-foreground">PUSH SDK v2.0.2</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive} className={isActive ? "bg-sidebar-accent" : ""}>
                      <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                        {item.title === "Eventos" && pendingCount && pendingCount > 0 ? (
                          <Badge variant="destructive" className="ml-auto text-xs" data-testid="badge-pending-events">
                            {pendingCount}
                          </Badge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="text-xs text-muted-foreground space-y-0.5">
          <div>Middleware V2.0.2</div>
          <div className="font-mono" data-testid="text-system-clock">{clock}</div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
