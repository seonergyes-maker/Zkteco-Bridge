import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Device, DeviceCommand } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Send, RotateCcw, Info, ClipboardCheck, FileText, Trash2, Settings,
  CalendarSearch, UserPlus, UserMinus, DoorOpen, Terminal, Clock,
  CheckCircle2, XCircle, Loader2, ImageMinus, BellOff, RefreshCw,
  Camera, UserSearch, Fingerprint, ScanLine, Lock, MessageSquare,
  Image, Download, Upload, Code,
} from "lucide-react";
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
  { value: "REBOOT", label: "Reiniciar dispositivo", icon: RotateCcw, description: "Reinicia el equipo", hasParams: false, group: "Basico" },
  { value: "INFO", label: "Solicitar informacion", icon: Info, description: "Solicita informacion del equipo (modelo, firmware, etc.)", hasParams: false, group: "Basico" },
  { value: "CHECK", label: "Verificar datos nuevos", icon: ClipboardCheck, description: "Fuerza al equipo a verificar y enviar datos nuevos", hasParams: false, group: "Basico" },
  { value: "LOG", label: "Subir registros", icon: FileText, description: "Fuerza al equipo a subir registros pendientes", hasParams: false, group: "Basico" },
  { value: "RELOAD_OPTIONS", label: "Recargar opciones", icon: RefreshCw, description: "Recarga las opciones de configuracion del equipo", hasParams: false, group: "Basico" },

  { value: "CLEAR_LOG", label: "Borrar registros", icon: Trash2, description: "Borra los registros de asistencia del dispositivo", hasParams: false, group: "Datos" },
  { value: "CLEAR_DATA", label: "Borrar todos los datos", icon: Trash2, description: "Borra todos los datos del dispositivo", hasParams: false, group: "Datos" },
  { value: "CLEAR_PHOTO", label: "Borrar fotos", icon: ImageMinus, description: "Borra todas las fotos del dispositivo", hasParams: false, group: "Datos" },

  { value: "DATA_USER", label: "Agregar/modificar usuario", icon: UserPlus, description: "Agrega o modifica un usuario en el dispositivo", hasParams: true, group: "Usuarios" },
  { value: "DATA_DEL_USER", label: "Eliminar usuario", icon: UserMinus, description: "Elimina un usuario del dispositivo", hasParams: true, group: "Usuarios" },
  { value: "QUERY_USERINFO", label: "Consultar info de usuario", icon: UserSearch, description: "Consulta usuarios del dispositivo (PIN opcional, sin PIN consulta todos)", hasParams: true, group: "Usuarios" },

  { value: "DATA_FP", label: "Enviar huella digital", icon: Fingerprint, description: "Envia datos de huella digital al dispositivo", hasParams: true, group: "Huellas" },
  { value: "DATA_DEL_FP", label: "Eliminar huella digital", icon: Fingerprint, description: "Elimina una huella digital del dispositivo", hasParams: true, group: "Huellas" },
  { value: "QUERY_FINGERTMP", label: "Consultar huella digital", icon: Fingerprint, description: "Consulta datos de huella digital de un usuario", hasParams: true, group: "Huellas" },
  { value: "ENROLL_FP", label: "Registrar huella en dispositivo", icon: ScanLine, description: "Inicia el proceso de registro de huella en el dispositivo", hasParams: true, group: "Huellas" },

  { value: "QUERY_ATTLOG", label: "Consultar asistencia", icon: CalendarSearch, description: "Consulta registros de asistencia en un rango de fechas", hasParams: true, group: "Consultas" },
  { value: "QUERY_ATTPHOTO", label: "Consultar fotos de fichaje", icon: Camera, description: "Consulta fotos de fichaje en un rango de fechas", hasParams: true, group: "Consultas" },

  { value: "AC_UNLOCK", label: "Abrir puerta", icon: DoorOpen, description: "Envia senal de apertura de puerta", hasParams: false, group: "Control de acceso" },
  { value: "AC_UNALARM", label: "Desactivar alarma", icon: BellOff, description: "Desactiva la alarma del dispositivo", hasParams: false, group: "Control de acceso" },
  { value: "UPDATE_TIMEZONE", label: "Configurar zona horaria", icon: Clock, description: "Configura una zona horaria en el dispositivo", hasParams: true, group: "Control de acceso" },
  { value: "DELETE_TIMEZONE", label: "Eliminar zona horaria", icon: Clock, description: "Elimina una zona horaria del dispositivo", hasParams: true, group: "Control de acceso" },
  { value: "UPDATE_GLOCK", label: "Configurar combinacion de apertura", icon: Lock, description: "Configura una combinacion de apertura en grupo", hasParams: true, group: "Control de acceso" },
  { value: "DELETE_GLOCK", label: "Eliminar combinacion de apertura", icon: Lock, description: "Elimina una combinacion de apertura en grupo", hasParams: true, group: "Control de acceso" },

  { value: "SET_OPTION", label: "Configurar opcion", icon: Settings, description: "Cambia una opcion de configuracion del equipo", hasParams: true, group: "Configuracion" },
  { value: "UPDATE_SMS", label: "Enviar mensaje SMS", icon: MessageSquare, description: "Envia un mensaje SMS al dispositivo", hasParams: true, group: "Configuracion" },
  { value: "UPDATE_USER_SMS", label: "Asignar SMS a usuario", icon: MessageSquare, description: "Asigna un SMS a un usuario especifico", hasParams: true, group: "Configuracion" },
  { value: "UPDATE_USERPIC", label: "Actualizar foto de usuario", icon: Image, description: "Actualiza la foto de un usuario en el dispositivo", hasParams: true, group: "Configuracion" },
  { value: "DELETE_USERPIC", label: "Eliminar foto de usuario", icon: ImageMinus, description: "Elimina la foto de un usuario del dispositivo", hasParams: true, group: "Configuracion" },
  { value: "SHELL", label: "Ejecutar comando del sistema", icon: Terminal, description: "Ejecuta un comando en el sistema operativo del dispositivo", hasParams: true, group: "Configuracion" },
  { value: "GETFILE", label: "Descargar archivo del dispositivo", icon: Download, description: "Descarga un archivo desde el dispositivo", hasParams: true, group: "Configuracion" },
  { value: "PUTFILE", label: "Subir archivo al dispositivo", icon: Upload, description: "Sube un archivo al dispositivo desde una URL", hasParams: true, group: "Configuracion" },
];

const COMMAND_GROUPS = ["Basico", "Datos", "Usuarios", "Huellas", "Consultas", "Control de acceso", "Configuracion"];

export default function Commands() {
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [commandType, setCommandType] = useState<string>("");
  const [filterDevice, setFilterDevice] = useState<string>("all");
  const { toast } = useToast();

  const [rawCommand, setRawCommand] = useState("");
  const [rawDevice, setRawDevice] = useState("");
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

  const [shellCmd, setShellCmd] = useState("");
  const [queryPin, setQueryPin] = useState("");
  const [fingerId, setFingerId] = useState("");
  const [fpPin, setFpPin] = useState("");
  const [fpSize, setFpSize] = useState("");
  const [fpValid, setFpValid] = useState("1");
  const [fpTmp, setFpTmp] = useState("");
  const [enrollRetry, setEnrollRetry] = useState("3");
  const [enrollOverwrite, setEnrollOverwrite] = useState("0");
  const [tzId, setTzId] = useState("");
  const [tzItime, setTzItime] = useState("");
  const [tzReserve, setTzReserve] = useState("");
  const [glockId, setGlockId] = useState("");
  const [glockGroupIds, setGlockGroupIds] = useState("");
  const [glockMemberCount, setGlockMemberCount] = useState("");
  const [glockReserve, setGlockReserve] = useState("");
  const [smsMsg, setSmsMsg] = useState("");
  const [smsTag, setSmsTag] = useState("253");
  const [smsUid, setSmsUid] = useState("");
  const [smsMin, setSmsMin] = useState("");
  const [smsStartTime, setSmsStartTime] = useState("");
  const [userSmsPin, setUserSmsPin] = useState("");
  const [userSmsUid, setUserSmsUid] = useState("");
  const [userpicPin, setUserpicPin] = useState("");
  const [userpicFile, setUserpicFile] = useState("");
  const [getFilePath, setGetFilePath] = useState("");
  const [putFileUrl, setPutFileUrl] = useState("");
  const [putFilePath, setPutFilePath] = useState("");
  const [photoStartTime, setPhotoStartTime] = useState("");
  const [photoEndTime, setPhotoEndTime] = useState("");

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

  const rawMutation = useMutation({
    mutationFn: async (data: { deviceSerial: string; rawCommand: string }) => {
      const res = await apiRequest("POST", "/api/commands/raw", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      toast({ title: "Comando personalizado enviado", description: "Se ha encolado para el dispositivo." });
      setRawCommand("");
    },
    onError: (error: Error) => {
      toast({ title: "Error al enviar comando", description: error.message, variant: "destructive" });
    },
  });

  function handleSendRaw() {
    if (!rawDevice || !rawCommand.trim()) return;
    rawMutation.mutate({ deviceSerial: rawDevice, rawCommand: rawCommand.trim() });
  }

  function resetParams() {
    setOptionItem(""); setOptionValue("");
    setStartTime(""); setEndTime("");
    setUserPin(""); setUserName(""); setUserPassword(""); setUserCard(""); setUserPrivilege("0");
    setDelUserPin("");
    setShellCmd("");
    setQueryPin("");
    setFingerId(""); setFpPin("");
    setFpSize(""); setFpValid("1"); setFpTmp("");
    setEnrollRetry("3"); setEnrollOverwrite("0");
    setTzId(""); setTzItime(""); setTzReserve("");
    setGlockId(""); setGlockGroupIds(""); setGlockMemberCount(""); setGlockReserve("");
    setSmsMsg(""); setSmsTag("253"); setSmsUid(""); setSmsMin(""); setSmsStartTime("");
    setUserSmsPin(""); setUserSmsUid("");
    setUserpicPin(""); setUserpicFile("");
    setGetFilePath("");
    setPutFileUrl(""); setPutFilePath("");
    setPhotoStartTime(""); setPhotoEndTime("");
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
      case "QUERY_ATTPHOTO":
        if (!photoStartTime || !photoEndTime) {
          toast({ title: "Faltan parametros", description: "Debes indicar fecha de inicio y fin.", variant: "destructive" });
          return;
        }
        params = { startTime: formatDateTimeLocal(photoStartTime), endTime: formatDateTimeLocal(photoEndTime) };
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
      case "QUERY_USERINFO":
        params = queryPin.trim() ? { pin: queryPin.trim() } : {};
        break;
      case "QUERY_FINGERTMP":
        params = {};
        if (fpPin.trim()) params.pin = fpPin.trim();
        if (fingerId !== "") params.fingerId = parseInt(fingerId);
        break;
      case "DATA_FP":
        if (!fpPin.trim() || fingerId === "" || !fpSize.trim() || !fpTmp.trim()) {
          toast({ title: "Faltan parametros", description: "PIN, ID de dedo, tamano y datos de huella son obligatorios.", variant: "destructive" });
          return;
        }
        params = { pin: fpPin.trim(), fid: parseInt(fingerId), size: parseInt(fpSize), valid: parseInt(fpValid), tmp: fpTmp.trim() };
        break;
      case "DATA_DEL_FP":
        if (!fpPin.trim() || fingerId === "") {
          toast({ title: "Faltan parametros", description: "Debes indicar el PIN y el ID de dedo.", variant: "destructive" });
          return;
        }
        params = { pin: fpPin.trim(), fid: parseInt(fingerId) };
        break;
      case "ENROLL_FP":
        if (!fpPin.trim() || fingerId === "") {
          toast({ title: "Faltan parametros", description: "Debes indicar el PIN y el ID de dedo.", variant: "destructive" });
          return;
        }
        params = { pin: fpPin.trim(), fid: parseInt(fingerId), retry: parseInt(enrollRetry) || 3, overwrite: parseInt(enrollOverwrite) };
        break;
      case "SHELL":
        if (!shellCmd.trim()) {
          toast({ title: "Falta comando", description: "Debes indicar el comando a ejecutar.", variant: "destructive" });
          return;
        }
        params = { cmdString: shellCmd.trim() };
        break;
      case "UPDATE_TIMEZONE":
        if (!tzId.trim() || !tzItime.trim()) {
          toast({ title: "Faltan parametros", description: "El ID de zona horaria y el intervalo de tiempo son obligatorios.", variant: "destructive" });
          return;
        }
        params = { tzid: tzId.trim(), itime: tzItime.trim(), reserve: tzReserve.trim() || undefined };
        break;
      case "DELETE_TIMEZONE":
        if (!tzId.trim()) {
          toast({ title: "Falta parametro", description: "Debes indicar el ID de la zona horaria a eliminar.", variant: "destructive" });
          return;
        }
        params = { tzid: tzId.trim() };
        break;
      case "UPDATE_GLOCK":
        if (!glockId.trim() || !glockGroupIds.trim() || !glockMemberCount.trim()) {
          toast({ title: "Faltan parametros", description: "ID, IDs de grupo y cantidad de miembros son obligatorios.", variant: "destructive" });
          return;
        }
        params = { glid: glockId.trim(), groupIds: glockGroupIds.trim(), memberCount: parseInt(glockMemberCount), reserve: glockReserve.trim() || undefined };
        break;
      case "DELETE_GLOCK":
        if (!glockId.trim()) {
          toast({ title: "Falta parametro", description: "Debes indicar el ID de la combinacion a eliminar.", variant: "destructive" });
          return;
        }
        params = { glid: glockId.trim() };
        break;
      case "UPDATE_SMS":
        if (!smsMsg.trim() || !smsUid.trim()) {
          toast({ title: "Faltan parametros", description: "El mensaje y el ID de usuario son obligatorios.", variant: "destructive" });
          return;
        }
        params = {
          msg: smsMsg.trim(),
          tag: parseInt(smsTag),
          uid: smsUid.trim(),
          min: smsMin.trim() || undefined,
          startTime: smsStartTime ? formatDateTimeLocal(smsStartTime) : undefined,
        };
        break;
      case "UPDATE_USER_SMS":
        if (!userSmsPin.trim() || !userSmsUid.trim()) {
          toast({ title: "Faltan parametros", description: "El PIN y el ID de SMS son obligatorios.", variant: "destructive" });
          return;
        }
        params = { pin: userSmsPin.trim(), uid: userSmsUid.trim() };
        break;
      case "UPDATE_USERPIC":
        if (!userpicPin.trim() || !userpicFile.trim()) {
          toast({ title: "Faltan parametros", description: "El PIN y el archivo de foto son obligatorios.", variant: "destructive" });
          return;
        }
        params = { pin: userpicPin.trim(), picFile: userpicFile.trim() };
        break;
      case "DELETE_USERPIC":
        if (!queryPin.trim()) {
          toast({ title: "Falta PIN", description: "Debes indicar el PIN del usuario.", variant: "destructive" });
          return;
        }
        params = { pin: queryPin.trim() };
        break;
      case "GETFILE":
        if (!getFilePath.trim()) {
          toast({ title: "Falta ruta", description: "Debes indicar la ruta del archivo a descargar.", variant: "destructive" });
          return;
        }
        params = { filePath: getFilePath.trim() };
        break;
      case "PUTFILE":
        if (!putFileUrl.trim() || !putFilePath.trim()) {
          toast({ title: "Faltan parametros", description: "La URL y la ruta de destino son obligatorios.", variant: "destructive" });
          return;
        }
        params = { url: putFileUrl.trim(), filePath: putFilePath.trim() };
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
    if (returnValue === "0") {
      return <Badge variant="default" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>;
    }
    const errorLabels: Record<string, string> = {
      "-1": "Error de parametros",
      "-3": "Error de acceso",
      "-1002": "No Soportado",
    };
    const label = errorLabels[returnValue] || `Error: ${returnValue}`;
    return <Badge variant="destructive" className="text-xs"><XCircle className="w-3 h-3 mr-1" />{label}</Badge>;
  }

  function renderFingerIdSelect(value: string, onChange: (v: string) => void, testId: string) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={testId}>
          <SelectValue placeholder="Selecciona dedo" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 10 }, (_, i) => (
            <SelectItem key={i} value={String(i)}>{i}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Comandos</h1>
        <p className="text-muted-foreground">Envia comandos a los dispositivos ZKTeco</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
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
                  {COMMAND_GROUPS.map((group) => {
                    const groupCmds = COMMAND_TYPES.filter(c => c.group === group);
                    if (groupCmds.length === 0) return null;
                    return (
                      <SelectGroup key={group}>
                        <SelectLabel>{group}</SelectLabel>
                        {groupCmds.map((cmd) => (
                          <SelectItem key={cmd.value} value={cmd.value}>
                            <div className="flex items-center gap-2">
                              <cmd.icon className="w-3.5 h-3.5" />
                              {cmd.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
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
                  <Select value={optionItem} onValueChange={(val) => {
                    setOptionItem(val);
                    if (val === "MainTime") {
                      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
                      const y = now.getFullYear();
                      const m = String(now.getMonth() + 1).padStart(2, "0");
                      const d = String(now.getDate()).padStart(2, "0");
                      const hh = String(now.getHours()).padStart(2, "0");
                      const mm = String(now.getMinutes()).padStart(2, "0");
                      const ss = String(now.getSeconds()).padStart(2, "0");
                      setOptionValue(`${y}-${m}-${d} ${hh}:${mm}:${ss}`);
                    }
                  }}>
                    <SelectTrigger data-testid="input-option-item">
                      <SelectValue placeholder="Seleccionar opcion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Red y Comunicacion</SelectLabel>
                        <SelectItem value="ServerURL">ServerURL - URL del servidor PUSH</SelectItem>
                        <SelectItem value="Delay">Delay - Intervalo de ping (seg)</SelectItem>
                        <SelectItem value="TransInterval">TransInterval - Intervalo de transmision</SelectItem>
                        <SelectItem value="TransTimes">TransTimes - Hora de transmision</SelectItem>
                        <SelectItem value="Realtime">Realtime - Envio en tiempo real (1/0)</SelectItem>
                        <SelectItem value="Encrypt">Encrypt - Encriptar comunicacion (1/0)</SelectItem>
                        <SelectItem value="IPAddress">IPAddress - Direccion IP</SelectItem>
                        <SelectItem value="GATEIPAddress">GATEIPAddress - Puerta de enlace</SelectItem>
                        <SelectItem value="NetMask">NetMask - Mascara de red</SelectItem>
                        <SelectItem value="DHCP">DHCP - Activar DHCP (1/0)</SelectItem>
                        <SelectItem value="DNS">DNS - Servidor DNS</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Fecha y Hora</SelectLabel>
                        <SelectItem value="MainTime">MainTime - Sincronizar fecha/hora</SelectItem>
                        <SelectItem value="DtFmt">DtFmt - Formato de fecha (0-10)</SelectItem>
                        <SelectItem value="DSTF">DSTF - Horario de verano (1/0)</SelectItem>
                        <SelectItem value="TimeZone">TimeZone - Zona horaria</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Pantalla y Sonido</SelectLabel>
                        <SelectItem value="Language">Language - Idioma (num.)</SelectItem>
                        <SelectItem value="VOLUME">VOLUME - Volumen (0-100)</SelectItem>
                        <SelectItem value="Brightness">Brightness - Brillo pantalla</SelectItem>
                        <SelectItem value="IdleDisplay">IdleDisplay - Mostrar en reposo</SelectItem>
                        <SelectItem value="VoiceOn">VoiceOn - Voz activada (1/0)</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Seguridad y Acceso</SelectLabel>
                        <SelectItem value="LockCount">LockCount - Intentos antes de bloqueo</SelectItem>
                        <SelectItem value="DoorSensorDelay">DoorSensorDelay - Retardo sensor puerta</SelectItem>
                        <SelectItem value="DoorAlarmDelay">DoorAlarmDelay - Retardo alarma puerta</SelectItem>
                        <SelectItem value="AutoOpenDoor">AutoOpenDoor - Apertura automatica (1/0)</SelectItem>
                        <SelectItem value="DoorCloseDelay">DoorCloseDelay - Retardo cierre puerta</SelectItem>
                        <SelectItem value="AntiPassback">AntiPassback - Anti-passback (1/0)</SelectItem>
                        <SelectItem value="InterLock">InterLock - Interlock (1/0)</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Verificacion</SelectLabel>
                        <SelectItem value="MThreshold">MThreshold - Umbral 1:N</SelectItem>
                        <SelectItem value="EThreshold">EThreshold - Umbral 1:1</SelectItem>
                        <SelectItem value="VThreshold">VThreshold - Umbral verificacion</SelectItem>
                        <SelectItem value="ShowScore">ShowScore - Mostrar puntuacion (1/0)</SelectItem>
                        <SelectItem value="UnlockPerson">UnlockPerson - Personas para multi-user (num.)</SelectItem>
                        <SelectItem value="OnlyPINCard">OnlyPINCard - Solo PIN/tarjeta</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Registro y Fotos</SelectLabel>
                        <SelectItem value="PhotoStamp">PhotoStamp - Marca en foto (1/0)</SelectItem>
                        <SelectItem value="ATTPhotoFunOn">ATTPhotoFunOn - Foto en fichaje (1/0)</SelectItem>
                        <SelectItem value="MaxAttLogCount">MaxAttLogCount - Max registros fichaje</SelectItem>
                        <SelectItem value="AutoClearAttLog">AutoClearAttLog - Borrar logs automatico (1/0)</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Tarjetas</SelectLabel>
                        <SelectItem value="CardProtFormat">CardProtFormat - Formato lectura tarjeta</SelectItem>
                        <SelectItem value="WiegandFmt">WiegandFmt - Formato Wiegand</SelectItem>
                        <SelectItem value="CardBitOrder">CardBitOrder - Orden de bits tarjeta</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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

            {commandType === "QUERY_ATTPHOTO" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input type="datetime-local" value={photoStartTime} onChange={(e) => setPhotoStartTime(e.target.value)} data-testid="input-photo-start" />
                </div>
                <div className="space-y-2">
                  <Label>Fecha fin</Label>
                  <Input type="datetime-local" value={photoEndTime} onChange={(e) => setPhotoEndTime(e.target.value)} data-testid="input-photo-end" />
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

            {commandType === "QUERY_USERINFO" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario (opcional, vacio = todos)</Label>
                  <Input placeholder="Vacio para consultar todos" value={queryPin} onChange={(e) => setQueryPin(e.target.value)} data-testid="input-query-pin" />
                </div>
              </>
            )}

            {commandType === "DELETE_USERPIC" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={queryPin} onChange={(e) => setQueryPin(e.target.value)} data-testid="input-query-pin-userpic" />
                </div>
              </>
            )}

            {commandType === "QUERY_FINGERTMP" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={fpPin} onChange={(e) => setFpPin(e.target.value)} data-testid="input-fp-pin" />
                </div>
                <div className="space-y-2">
                  <Label>ID de dedo (0-9) *</Label>
                  {renderFingerIdSelect(fingerId, setFingerId, "select-finger-id")}
                </div>
              </>
            )}

            {commandType === "DATA_FP" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={fpPin} onChange={(e) => setFpPin(e.target.value)} data-testid="input-fp-pin-data" />
                </div>
                <div className="space-y-2">
                  <Label>ID de dedo (0-9) *</Label>
                  {renderFingerIdSelect(fingerId, setFingerId, "select-finger-id-data")}
                </div>
                <div className="space-y-2">
                  <Label>Tamano *</Label>
                  <Input placeholder="Tamano de los datos" value={fpSize} onChange={(e) => setFpSize(e.target.value)} data-testid="input-fp-size" />
                </div>
                <div className="space-y-2">
                  <Label>Valido</Label>
                  <Select value={fpValid} onValueChange={setFpValid}>
                    <SelectTrigger data-testid="select-fp-valid">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Si (1)</SelectItem>
                      <SelectItem value="0">No (0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Datos de huella (base64) *</Label>
                  <Input placeholder="Datos en base64" value={fpTmp} onChange={(e) => setFpTmp(e.target.value)} data-testid="input-fp-tmp" />
                </div>
              </>
            )}

            {commandType === "DATA_DEL_FP" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={fpPin} onChange={(e) => setFpPin(e.target.value)} data-testid="input-fp-pin-del" />
                </div>
                <div className="space-y-2">
                  <Label>ID de dedo (0-9) *</Label>
                  {renderFingerIdSelect(fingerId, setFingerId, "select-finger-id-del")}
                </div>
              </>
            )}

            {commandType === "ENROLL_FP" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={fpPin} onChange={(e) => setFpPin(e.target.value)} data-testid="input-fp-pin-enroll" />
                </div>
                <div className="space-y-2">
                  <Label>ID de dedo (0-9) *</Label>
                  {renderFingerIdSelect(fingerId, setFingerId, "select-finger-id-enroll")}
                </div>
                <div className="space-y-2">
                  <Label>Reintentos</Label>
                  <Input placeholder="3" value={enrollRetry} onChange={(e) => setEnrollRetry(e.target.value)} data-testid="input-enroll-retry" />
                </div>
                <div className="space-y-2">
                  <Label>Sobrescribir</Label>
                  <Select value={enrollOverwrite} onValueChange={setEnrollOverwrite}>
                    <SelectTrigger data-testid="select-enroll-overwrite">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No (0)</SelectItem>
                      <SelectItem value="1">Si (1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {commandType === "SHELL" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Comando del sistema *</Label>
                  <Input placeholder="Ej: ls /mnt/mtdblock" value={shellCmd} onChange={(e) => setShellCmd(e.target.value)} data-testid="input-shell-cmd" />
                </div>
              </>
            )}

            {commandType === "UPDATE_TIMEZONE" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>ID de zona horaria *</Label>
                  <Input placeholder="Ej: 1" value={tzId} onChange={(e) => setTzId(e.target.value)} data-testid="input-tz-id" />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo de tiempo *</Label>
                  <Input placeholder="Ej: 0000-2359" value={tzItime} onChange={(e) => setTzItime(e.target.value)} data-testid="input-tz-itime" />
                </div>
                <div className="space-y-2">
                  <Label>Reserva</Label>
                  <Input placeholder="Opcional" value={tzReserve} onChange={(e) => setTzReserve(e.target.value)} data-testid="input-tz-reserve" />
                </div>
              </>
            )}

            {commandType === "DELETE_TIMEZONE" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>ID de zona horaria a eliminar *</Label>
                  <Input placeholder="Ej: 1" value={tzId} onChange={(e) => setTzId(e.target.value)} data-testid="input-tz-id-del" />
                </div>
              </>
            )}

            {commandType === "UPDATE_GLOCK" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>ID de combinacion *</Label>
                  <Input placeholder="Ej: 1" value={glockId} onChange={(e) => setGlockId(e.target.value)} data-testid="input-glock-id" />
                </div>
                <div className="space-y-2">
                  <Label>IDs de grupo *</Label>
                  <Input placeholder="Ej: 1,2,3" value={glockGroupIds} onChange={(e) => setGlockGroupIds(e.target.value)} data-testid="input-glock-group-ids" />
                </div>
                <div className="space-y-2">
                  <Label>Cantidad de miembros *</Label>
                  <Input placeholder="Ej: 3" value={glockMemberCount} onChange={(e) => setGlockMemberCount(e.target.value)} data-testid="input-glock-member-count" />
                </div>
                <div className="space-y-2">
                  <Label>Reserva</Label>
                  <Input placeholder="Opcional" value={glockReserve} onChange={(e) => setGlockReserve(e.target.value)} data-testid="input-glock-reserve" />
                </div>
              </>
            )}

            {commandType === "DELETE_GLOCK" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>ID de combinacion a eliminar *</Label>
                  <Input placeholder="Ej: 1" value={glockId} onChange={(e) => setGlockId(e.target.value)} data-testid="input-glock-id-del" />
                </div>
              </>
            )}

            {commandType === "UPDATE_SMS" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Mensaje *</Label>
                  <Input placeholder="Texto del mensaje" value={smsMsg} onChange={(e) => setSmsMsg(e.target.value)} data-testid="input-sms-msg" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo (tag)</Label>
                  <Select value={smsTag} onValueChange={setSmsTag}>
                    <SelectTrigger data-testid="select-sms-tag">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="253">Notificacion (253)</SelectItem>
                      <SelectItem value="254">Usuario (254)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ID de usuario *</Label>
                  <Input placeholder="Ej: 1" value={smsUid} onChange={(e) => setSmsUid(e.target.value)} data-testid="input-sms-uid" />
                </div>
                <div className="space-y-2">
                  <Label>Minutos</Label>
                  <Input placeholder="Opcional" value={smsMin} onChange={(e) => setSmsMin(e.target.value)} data-testid="input-sms-min" />
                </div>
                <div className="space-y-2">
                  <Label>Fecha inicio</Label>
                  <Input type="datetime-local" value={smsStartTime} onChange={(e) => setSmsStartTime(e.target.value)} data-testid="input-sms-start-time" />
                </div>
              </>
            )}

            {commandType === "UPDATE_USER_SMS" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={userSmsPin} onChange={(e) => setUserSmsPin(e.target.value)} data-testid="input-user-sms-pin" />
                </div>
                <div className="space-y-2">
                  <Label>ID de SMS *</Label>
                  <Input placeholder="Ej: 1" value={userSmsUid} onChange={(e) => setUserSmsUid(e.target.value)} data-testid="input-user-sms-uid" />
                </div>
              </>
            )}

            {commandType === "UPDATE_USERPIC" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>PIN del usuario *</Label>
                  <Input placeholder="Ej: 101" value={userpicPin} onChange={(e) => setUserpicPin(e.target.value)} data-testid="input-userpic-pin" />
                </div>
                <div className="space-y-2">
                  <Label>Archivo de foto *</Label>
                  <Input placeholder="Ej: /mnt/user/photo.jpg" value={userpicFile} onChange={(e) => setUserpicFile(e.target.value)} data-testid="input-userpic-file" />
                </div>
              </>
            )}

            {commandType === "GETFILE" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Ruta del archivo *</Label>
                  <Input placeholder="Ej: /mnt/mtdblock/data.dat" value={getFilePath} onChange={(e) => setGetFilePath(e.target.value)} data-testid="input-getfile-path" />
                </div>
              </>
            )}

            {commandType === "PUTFILE" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>URL de origen *</Label>
                  <Input placeholder="Ej: https://example.com/file.dat" value={putFileUrl} onChange={(e) => setPutFileUrl(e.target.value)} data-testid="input-putfile-url" />
                </div>
                <div className="space-y-2">
                  <Label>Ruta de destino *</Label>
                  <Input placeholder="Ej: /mnt/mtdblock/file.dat" value={putFilePath} onChange={(e) => setPutFilePath(e.target.value)} data-testid="input-putfile-path" />
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Code className="w-4 h-4" />
              Comando personalizado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              {devicesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select value={rawDevice} onValueChange={setRawDevice}>
                  <SelectTrigger data-testid="select-raw-device">
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
              <Label>Comando raw</Label>
              <Input
                placeholder="Ej: REBOOT, INFO, SET OPTION TimeZone=1"
                value={rawCommand}
                onChange={(e) => setRawCommand(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendRaw(); }}
                data-testid="input-raw-command"
              />
              <p className="text-xs text-muted-foreground">
                Escribe el comando exacto tal como lo recibiria el dispositivo. Se enviara directamente sin procesar.
              </p>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={handleSendRaw}
              disabled={!rawDevice || !rawCommand.trim() || rawMutation.isPending}
              data-testid="button-send-raw"
            >
              {rawMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {rawMutation.isPending ? "Enviando..." : "Enviar comando raw"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
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
