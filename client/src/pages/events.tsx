import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock, Search, CheckCircle, Clock, Send, RefreshCw, ArrowDownLeft, ArrowUpRight, Building2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ATTENDANCE_STATUS, VERIFY_MODE, type AttendanceEvent, type Client, type Device, type DeviceUser } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Events() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [forwardFilter, setForwardFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const forwardingActive = clientsList?.some(c => c.forwardingEnabled) ?? false;

  const { data: devicesList } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: deviceUsers } = useQuery<DeviceUser[]>({
    queryKey: ["/api/device-users"],
  });

  const { data: events, isLoading } = useQuery<AttendanceEvent[]>({
    queryKey: ["/api/events", clientFilter],
    queryFn: async () => {
      const url = clientFilter !== "all" ? `/api/events?clientId=${clientFilter}` : "/api/events";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error al obtener eventos");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/events/retry-forward");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Reenvio iniciado", description: "Los eventos pendientes se estan reenviando" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al reenviar", description: error.message, variant: "destructive" });
    },
  });

  function getClientName(deviceSerial: string): string {
    const device = devicesList?.find(d => d.serialNumber === deviceSerial);
    if (!device) return "-";
    const client = clientsList?.find(c => c.id === device.clientId);
    return client?.name || "-";
  }

  function getUserName(deviceSerial: string, pin: string): string {
    const device = devicesList?.find(d => d.serialNumber === deviceSerial);
    if (!device) return "";
    const user = deviceUsers?.find(u => u.clientId === device.clientId && u.pin === pin);
    return user?.name || "";
  }

  const filtered = events?.filter(e => {
    const matchSearch = search === "" ||
      e.pin.toLowerCase().includes(search.toLowerCase()) ||
      e.deviceSerial.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || String(e.status) === statusFilter;
    const matchForward = forwardFilter === "all" ||
      (forwardFilter === "forwarded" && e.forwarded) ||
      (forwardFilter === "pending" && !e.forwarded) ||
      (forwardFilter === "error" && !e.forwarded && e.forwardError);
    return matchSearch && matchStatus && matchForward;
  }) ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Eventos de fichaje</h1>
          <p className="text-muted-foreground">Historial de todos los registros recibidos</p>
        </div>
        {forwardingActive && (
          <Button
            variant="outline"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
            data-testid="button-retry-forward"
          >
            <Send className="w-4 h-4 mr-2" />
            {retryMutation.isPending ? "Reenviando..." : "Reenviar pendientes"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-client-filter">
            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {clientsList?.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por PIN o dispositivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-events"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <SelectValue placeholder="Estado fichaje" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="0">Entrada</SelectItem>
            <SelectItem value="1">Salida</SelectItem>
            <SelectItem value="2">Salida temporal</SelectItem>
            <SelectItem value="3">Regreso</SelectItem>
            <SelectItem value="4">Entrada H.E.</SelectItem>
            <SelectItem value="5">Salida H.E.</SelectItem>
          </SelectContent>
        </Select>
        {forwardingActive && (
          <Select value={forwardFilter} onValueChange={setForwardFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-forward-filter">
              <SelectValue placeholder="Reenvio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="forwarded">Reenviados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="error">Con error</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="ghost" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/events", clientFilter] })} data-testid="button-refresh-events">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-0"><Skeleton className="h-96 w-full" /></CardContent></Card>
      ) : filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Fecha / Hora</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Verificacion</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  {forwardingActive && <TableHead>Reenvio</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((event) => {
                  const isEntry = event.status === 0 || event.status === 3 || event.status === 4;
                  return (
                    <TableRow key={event.id} data-testid={`row-event-${event.id}`}>
                      <TableCell className="text-sm font-medium">
                        {getUserName(event.deviceSerial, event.pin) || "-"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{getClientName(event.deviceSerial)}</TableCell>
                      <TableCell className="font-mono font-medium">{event.pin}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(event.timestamp), "dd/MM/yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isEntry ? "default" : "secondary"} className="text-xs">
                          {ATTENDANCE_STATUS[event.status] || `Estado ${event.status}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {VERIFY_MODE[event.verify] || "Otro"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{event.deviceSerial}</TableCell>
                      {forwardingActive && (
                        <TableCell>
                          {event.forwarded ? (
                            <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          ) : event.forwardError ? (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400">
                              <Clock className="w-3 h-3 mr-1" />
                              Pendiente
                            </Badge>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarClock className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No hay eventos {search || statusFilter !== "all" || forwardFilter !== "all" ? "que coincidan con los filtros" : ""}</p>
            <p className="text-xs text-muted-foreground mt-1">Los eventos apareceran cuando los dispositivos envien fichajes</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
