import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Device, DeviceCommand } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Send, RotateCcw, Info, ClipboardCheck, FileText, Trash2, Settings, CalendarSearch, UserPlus, UserMinus, DoorOpen, Terminal, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COMMAND_TYPES = [
  { value: "REBOOT", label: "Reiniciar dispositivo", icon: RotateCcw, description: "Reinicia el equipo", hasParams: false },
  { value: "INFO", label: "Solicitar informacion", icon: Info, description: "Solicita informacion del equipo (modelo, firmware, etc.)", hasParams: false },
  { value: "CHECK", label: "Verificar datos nuevos", icon: ClipboardCheck, description: "Fuerza al equipo a verificar y enviar datos nuevos", hasParams: false },
  { value: "LOG", label: "Subir registros", icon: FileText, description: "Fuerza al equipo a subir registros pendientes", hasParams: false },
  { value: "CLEAR_LOG", label: "Borrar registros", icon: Trash2, description: "Borra los registros de asistencia del dispositivo", hasParams: false },
  { value: "SET_OPTION", label: "Configurar opcion", icon: Settings, description: "Cambia una opcion de configuracion del equipo", hasParams: true },
  { value: "QUERY_ATTLOG", label: "Consultar asistencia", icon: CalendarSearch, description: "Consulta registros de asistencia en un rango de fechas", hasParams: true },
  { value: "DATA_USER", label: "Agregar/modificar usuario", icon: UserPlus, description: "Agrega o modifica un usuario en el dispositivo", hasParams: true },
  { value: "DATA_DEL_USER", label: "Eliminar usuario", icon: UserMinus, description: "Elimina un usuario del dispositivo", hasParams: true },
  { value: "AC_UNLOCK", label: "Abrir puerta", icon: DoorOpen, description: "Envia senal de apertura de puerta", hasParams: false },
];

export default function Commands() {
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [commandType, setCommandType] = useState<string>("");
  const [filterDevice, setFilterDevice] = useState<string>("all");
  const { toast } = useToast();

  const [optionItem, setOptionItem] = useState("");
  const [optionValue, setOptionValue] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [userPin, setUserPin] = useState("");
  const [userName, setUserName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userCard, setUserCard] = useState("");
  const [userPrivilege, setUserPrivilege] = useState("0");
  const [delUserPin, setDelUserPin] = useState("");

  const { data: devices, isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: commands, isLoading: commandsLoading } = useQuery<DeviceCommand[]>({
    queryKey: ["/api/commands", filterDevice],
    queryFn: async () => {
      const url = filterDevice && filterDevice !== "all" ? `/api/commands?serial=${filterDevice}` : "/api/commands";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar comandos");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { deviceSerial: string; commandType: string; params?: any }) => {
      const res = await apiRequest("POST", "/api/commands", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      toast({ title: "Comando enviado", description: "El comando se ha encolado y sera ejecutado cuando el dispositivo se conecte." });
      resetParams();
    },
    onError: (error: Error) => {
      toast({ title: "Error al enviar comando", description: error.message, variant: "destructive" });
    },
  });

  function resetParams() {
    setOptionItem(""); setOptionValue("");
    setStartTime(""); setEndTime("");
    setUserPin(""); setUserName(""); setUserPassword(""); setUserCard(""); setUserPrivilege("0");
    setDelUserPin("");
  }

  function formatDateTimeLocal(dtLocal: string): string {
    return dtLocal.replace("T", " ") + ":00";
  }

  function handleSend() {
    if (!selectedDevice || !commandType) return;

    let params: any = undefined;

    switch (commandType) {
      case "SET_OPTION":
        if (!optionItem.trim() || optionValue.trim() === "") {
          toast({ title: "Faltan parametros", description: "Debes indicar el nombre de la opcion y su valor.", variant: "destructive" });
          return;
        }
        params = { item: optionItem.trim(), value: optionValue.trim() };
        break;
      case "QUERY_ATTLOG":
        if (!startTime || !endTime) {
          toast({ title: "Faltan parametros", description: "Debes indicar fecha de inicio y fin.", variant: "destructive" });
          return;
        }
        params = { startTime: formatDateTimeLocal(startTime), endTime: formatDateTimeLocal(endTime) };
        break;
      case "DATA_USER":
        if (!userPin.trim()) {
          toast({ title: "Falta PIN", description: "El PIN del empleado es obligatorio.", variant: "destructive" });
          return;
        }
        params = {
          pin: userPin.trim(),
          name: userName.trim() || undefined,
          password: userPassword.trim() || undefined,
          card: userCard.trim() || undefined,
          privilege: userPrivilege ? parseInt(userPrivilege) : 0,
        };
        break;
      case "DATA_DEL_USER":
        if (!delUserPin.trim()) {
          toast({ title: "Falta PIN", description: "Debes indicar el PIN del usuario a eliminar.", variant: "destructive" });
          return;
        }
        params = { pin: delUserPin.trim() };
        break;
    }

    sendMutation.mutate({ deviceSerial: selectedDevice, commandType, params });
  }

  const selectedCmd = COMMAND_TYPES.find(c => c.value === commandType);

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" data-testid="badge-status-pending"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case "executed":
        return <Badge variant="default" data-testid="badge-status-executed"><CheckCircle2 className="w-3 h-3 mr-1" />Ejecutado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  function getReturnBadge(returnValue: string | null) {
    if (!returnValue) return null;
    const isSuccess = returnValue === "0";
    return isSuccess
      ? <Badge variant="default" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>
      : <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />Error: {returnValue}</Badge>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Comandos</h1>
        <p className="text-muted-foreground">Envia comandos a los dispositivos ZKTeco</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="w-4 h-4" />
              Enviar comando
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              {devicesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger data-testid="select-command-device">
                    <SelectValue placeholder="Selecciona un dispositivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices?.map((d) => (
                      <SelectItem key={d.serialNumber} value={d.serialNumber}>
                        {d.alias || d.serialNumber} ({d.serialNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tipo de comando</Label>
              <Select value={commandType} onValueChange={(v) => { setCommandType(v); resetParams(); }}>
                <SelectTrigger data-testid="select-command-type">
                  <SelectValue placeholder="Selecciona un comando" />
                </SelectTrigger>
                <SelectContent>
                  {COMMAND_TYPES.map((cmd) => (
                    <SelectItem key={cmd.value} value={cmd.value}>
                      <div className="flex items-center gap-2">
                        <cmd.icon className="w-3.5 h-3.5" />
                        {cmd.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCmd && (
              <p className="text-xs text-muted-foreground">{selectedCmd.description}</p>
            )}

            {commandType === "SET_OPTION" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Nombre de la opcion</Label>
                  <Input placeholder="Ej: Delay" value={optionItem} onChange={(e) => setOptionItem(e.target.value)} data-testid="input-option-item" />
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input placeholder="Ej: 60" value={optionValue} onChange={(e) => setOptionValue(e.target.value)} data-testid="input-option-value" />
                </div>
              </>
            )}

            {commandType === "QUERY_ATTLOG" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="input-query-start" />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="input-query-end" />
                </div>
              </>
            )}

            {commandType === "DATA_USER" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN (ID del empleado) *</Label>
                  <Input placeholder="Ej: 101" value={userPin} onChange={(e) => setUserPin(e.target.value)} data-testid="input-user-pin" />
                </div>
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input placeholder="Ej: Juan Perez" value={userName} onChange={(e) => setUserName(e.target.value)} data-testid="input-user-name" />
                </div>
                <div className="space-y-2">
                  <Label>Contrasena</Label>
                  <Input placeholder="Contrasena (opcional)" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} data-testid="input-user-password" />
                </div>
                <div className="space-y-2">
                  <Label>Tarjeta</Label>
                  <Input placeholder="ID de tarjeta (opcional)" value={userCard} onChange={(e) => setUserCard(e.target.value)} data-testid="input-user-card" />
                </div>
                <div className="space-y-2">
                  <Label>Privilegio</Label>
                  <Select value={userPrivilege} onValueChange={setUserPrivilege}>
                    <SelectTrigger data-testid="select-user-privilege">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Usuario normal</SelectItem>
                      <SelectItem value="2">Enrolador</SelectItem>
                      <SelectItem value="6">Administrador</SelectItem>
                      <SelectItem value="14">Super administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {commandType === "DATA_DEL_USER" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario a eliminar *</Label>
                  <Input placeholder="Ej: 101" value={delUserPin} onChange={(e) => setDelUserPin(e.target.value)} data-testid="input-del-user-pin" />
                </div>
              </>
            )}

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={!selectedDevice || !commandType || sendMutation.isPending}
              data-testid="button-send-command"
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {sendMutation.isPending ? "Enviando..." : "Enviar comando"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">Historial de comandos</CardTitle>
              <Select value={filterDevice} onValueChange={setFilterDevice}>
                <SelectTrigger className="w-[220px]" data-testid="select-filter-device">
                  <SelectValue placeholder="Filtrar por dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los dispositivos</SelectItem>
                  {devices?.map((d) => (
                    <SelectItem key={d.serialNumber} value={d.serialNumber}>
                      {d.alias || d.serialNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {commandsLoading ? (
              <div className="p-6"><Skeleton className="h-48 w-full" /></div>
            ) : commands && commands.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    <TableHead>Comando</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Ejecutado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commands.map((cmd) => (
                    <TableRow key={cmd.id} data-testid={`row-command-${cmd.id}`}>
                      <TableCell>{getStatusBadge(cmd.status)}</TableCell>
                      <TableCell className="font-mono text-xs">{cmd.deviceSerial}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate" title={cmd.command}>{cmd.command}</TableCell>
                      <TableCell>{getReturnBadge(cmd.returnValue)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(cmd.createdAt), "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {cmd.executedAt ? format(new Date(cmd.executedAt), "dd/MM HH:mm:ss") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Terminal className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground">No hay comandos enviados</p>
                <p className="text-xs text-muted-foreground mt-1">Selecciona un dispositivo y un comando para empezar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
