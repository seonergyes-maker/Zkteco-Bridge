import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Trash2, ArrowDownLeft, ArrowUpRight, ScrollText, Filter } from "lucide-react";
import { useState } from "react";
import type { Device, Client } from "@shared/schema";

interface ProtocolLogEntry {
  id: number;
  timestamp: string;
  direction: "IN" | "OUT";
  deviceSerial: string;
  endpoint: string;
  method: string;
  summary: string;
  details: string;
  ip: string;
  logType: string;
}

export default function Logs() {
  const { toast } = useToast();
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const params = new URLSearchParams({ limit: "200" });
  if (deviceFilter !== "all") params.set("device", deviceFilter);
  if (typeFilter !== "all") params.set("type", typeFilter);
  const logsUrl = `/api/protocol-logs?${params.toString()}`;

  const { data: logs, isLoading } = useQuery<ProtocolLogEntry[]>({
    queryKey: ["/api/protocol-logs", deviceFilter, typeFilter],
    queryFn: async () => {
      const res = await fetch(logsUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
    refetchInterval: 3000,
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: logTypes } = useQuery<string[]>({
    queryKey: ["/api/protocol-log-types"],
    refetchInterval: 5000,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/protocol-logs"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/protocol-logs"] });
      toast({ title: "Logs borrados" });
    },
  });

  function deviceLabel(d: Device): string {
    const client = clientsList?.find(c => c.id === d.clientId);
    const clientName = client?.name || "";
    const alias = d.alias || d.serialNumber;
    return clientName ? `${clientName} - ${alias} (${d.serialNumber})` : `${alias} (${d.serialNumber})`;
  }

  function getDeviceAlias(serial: string) {
    const device = devices?.find(d => d.serialNumber === serial);
    if (!device) return serial;
    return deviceLabel(device);
  }

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
      "." + String(d.getMilliseconds()).padStart(3, "0");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Log de protocolo</h1>
          <p className="text-muted-foreground">Comunicacion en tiempo real con dispositivos ZKTeco</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-[220px]" data-testid="select-device-filter">
              <SelectValue placeholder="Todos los dispositivos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los dispositivos</SelectItem>
              {devices?.map((d) => (
                <SelectItem key={d.serialNumber} value={d.serialNumber}>
                  {deviceLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
              <Filter className="w-4 h-4 mr-2 shrink-0" />
              <SelectValue placeholder="Todos los tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {logTypes?.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/protocol-logs"] })} data-testid="button-refresh-logs">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending} data-testid="button-clear-logs">
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <ScrollText className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground">No hay logs de protocolo todavia</p>
            <p className="text-xs text-muted-foreground">Los logs apareceran cuando un dispositivo se comunique con el servidor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {logs.map((entry) => (
            <Card
              key={entry.id}
              className="hover-elevate cursor-pointer"
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              data-testid={`log-entry-${entry.id}`}
            >
              <CardContent className="py-2 px-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono w-[90px] shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                  {entry.direction === "IN" ? (
                    <Badge variant="default" className="shrink-0">
                      <ArrowDownLeft className="w-3 h-3 mr-1" />
                      RX
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">
                      <ArrowUpRight className="w-3 h-3 mr-1" />
                      TX
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono text-xs shrink-0">
                    {entry.logType || entry.method}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {entry.endpoint}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {getDeviceAlias(entry.deviceSerial)}
                  </span>
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {entry.summary}
                  </span>
                  {entry.ip && (
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {entry.ip}
                    </span>
                  )}
                </div>
                {expandedId === entry.id && (
                  <div className="mt-3 p-3 rounded-md bg-muted">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-[400px] overflow-auto" data-testid={`log-details-${entry.id}`}>
                      {entry.details}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
