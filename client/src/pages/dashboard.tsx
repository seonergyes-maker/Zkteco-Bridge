import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Cpu, CalendarClock, AlertTriangle, CheckCircle, Clock, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AttendanceEvent, Device, Client } from "@shared/schema";
import { ATTENDANCE_STATUS, VERIFY_MODE } from "@shared/schema";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DashboardStats {
  totalClients: number;
  totalDevices: number;
  onlineDevices: number;
  todayEvents: number;
  pendingForward: number;
  forwardedToday: number;
  forwardingActive: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, variant = "default" }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: any;
  variant?: "default" | "success" | "warning" | "destructive";
}) {
  const iconColors = {
    default: "text-muted-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    destructive: "text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColors[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function getStatusBadgeVariant(status: number): "default" | "secondary" | "destructive" | "outline" {
  if (status === 0 || status === 4) return "default";
  if (status === 1 || status === 5) return "secondary";
  return "outline";
}

function getStatusIcon(status: number) {
  if (status === 0 || status === 3 || status === 4) return ArrowDownLeft;
  return ArrowUpRight;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 15000,
  });

  const { data: recentEvents, isLoading: eventsLoading } = useQuery<AttendanceEvent[]>({
    queryKey: ["/api/events/recent"],
    refetchInterval: 10000,
  });

  const { data: devices, isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 30000,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dashboard</h1>
        <p className="text-muted-foreground">Vision general del sistema de fichaje</p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 ${stats?.forwardingActive ? 'xl:grid-cols-6' : 'xl:grid-cols-4'} gap-4`}>
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-16" /></CardContent>
            </Card>
          ))
        ) : stats ? (
          <>
            <StatCard title="Clientes" value={stats.totalClients} icon={Building2} subtitle="Total registrados" />
            <StatCard title="Dispositivos" value={stats.totalDevices} icon={Cpu} subtitle="Total registrados" />
            <StatCard title="En linea" value={stats.onlineDevices} icon={CheckCircle} variant="success" subtitle="Ultimos 5 min" />
            <StatCard title="Eventos hoy" value={stats.todayEvents} icon={CalendarClock} subtitle="Fichajes recibidos" />
            {stats.forwardingActive && (
              <>
                <StatCard title="Pendientes" value={stats.pendingForward} icon={AlertTriangle} variant={stats.pendingForward > 0 ? "warning" : "default"} subtitle="Sin reenviar" />
                <StatCard title="Reenviados" value={stats.forwardedToday} icon={CheckCircle} variant="success" subtitle="Hoy a Oracle" />
              </>
            )}
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ultimos eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {eventsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentEvents && recentEvents.length > 0 ? (
                <div className="space-y-1">
                  {recentEvents.map((event) => {
                    const StatusIcon = getStatusIcon(event.status);
                    return (
                      <div key={event.id} className="flex items-center gap-3 p-3 rounded-md hover-elevate" data-testid={`event-row-${event.id}`}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${event.status === 0 || event.status === 3 || event.status === 4 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}`}>
                          <StatusIcon className={`w-4 h-4 ${event.status === 0 || event.status === 3 || event.status === 4 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">PIN: {event.pin}</span>
                            <Badge variant={getStatusBadgeVariant(event.status)} className="text-xs">
                              {ATTENDANCE_STATUS[event.status] || `Estado ${event.status}`}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            <span>{event.deviceSerial}</span>
                            <span>{VERIFY_MODE[event.verify] || "Otro"}</span>
                            <span>{format(new Date(event.timestamp), "dd/MM HH:mm:ss")}</span>
                          </div>
                        </div>
                        {stats?.forwardingActive && (
                          <div>
                            {event.forwarded ? (
                              <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Enviado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400">
                                <Clock className="w-3 h-3 mr-1" />
                                Pendiente
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <CalendarClock className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No hay eventos recientes</p>
                  <p className="text-xs mt-1">Los eventos apareceran aqui cuando los dispositivos envien datos</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado de dispositivos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {devicesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-8 w-8 rounded-md" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : devices && devices.length > 0 ? (
                <div className="space-y-1">
                  {devices.map((device) => {
                    const isOnline = device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 5 * 60 * 1000;
                    return (
                      <div key={device.id} className="flex items-center gap-3 p-3 rounded-md hover-elevate" data-testid={`device-status-${device.id}`}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-md ${isOnline ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                          <Cpu className={`w-4 h-4 ${isOnline ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{device.alias || device.serialNumber}</span>
                            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            SN: {device.serialNumber}
                            {device.lastSeen && (
                              <span className="ml-2">
                                Visto: {format(new Date(device.lastSeen), "dd/MM HH:mm")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Cpu className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">No hay dispositivos registrados</p>
                  <p className="text-xs mt-1">Agrega dispositivos en la seccion de Dispositivos</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
