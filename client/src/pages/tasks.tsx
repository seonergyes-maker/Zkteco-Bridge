import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertScheduledTaskSchema, type ScheduledTask, type InsertScheduledTask, type Device, type Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarClock, Pencil, Trash2, Clock, Play, Pause, RotateCcw, Info, ClipboardCheck, FileText, Trash, Settings, CalendarSearch, UserPlus, UserMinus, DoorOpen, ImageMinus, BellOff, RefreshCw, Camera, Fingerprint, ScanLine, Lock, MessageSquare, Image, Download, Upload, Terminal, Search } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const COMMAND_TYPES = [
  { value: "REBOOT", label: "Reiniciar dispositivo", icon: RotateCcw },
  { value: "INFO", label: "Solicitar informacion", icon: Info },
  { value: "CHECK", label: "Verificar datos nuevos", icon: ClipboardCheck },
  { value: "LOG", label: "Subir registros", icon: FileText },
  { value: "CLEAR_LOG", label: "Borrar registros", icon: Trash },
  { value: "CLEAR_DATA", label: "Borrar todos los datos", icon: Trash2 },
  { value: "CLEAR_PHOTO", label: "Borrar fotos", icon: ImageMinus },
  { value: "SET_OPTION", label: "Configurar opcion", icon: Settings },
  { value: "QUERY_ATTLOG", label: "Consultar fichajes", icon: CalendarSearch },
  { value: "QUERY_ATTPHOTO", label: "Consultar fotos de fichaje", icon: Camera },
  { value: "QUERY_USERINFO", label: "Consultar info de usuario", icon: Search },
  { value: "QUERY_FINGERTMP", label: "Consultar huella digital", icon: Fingerprint },
  { value: "DATA_USER", label: "Enviar usuario", icon: UserPlus },
  { value: "DATA_DEL_USER", label: "Eliminar usuario", icon: UserMinus },
  { value: "DATA_FP", label: "Enviar huella digital", icon: Fingerprint },
  { value: "DATA_DEL_FP", label: "Eliminar huella digital", icon: Fingerprint },
  { value: "ENROLL_FP", label: "Registrar huella en dispositivo", icon: ScanLine },
  { value: "AC_UNLOCK", label: "Abrir puerta", icon: DoorOpen },
  { value: "AC_UNALARM", label: "Desactivar alarma", icon: BellOff },
  { value: "RELOAD_OPTIONS", label: "Recargar opciones", icon: RefreshCw },
  { value: "UPDATE_TIMEZONE", label: "Configurar zona horaria", icon: Clock },
  { value: "DELETE_TIMEZONE", label: "Eliminar zona horaria", icon: Clock },
  { value: "UPDATE_GLOCK", label: "Configurar combinacion apertura", icon: Lock },
  { value: "DELETE_GLOCK", label: "Eliminar combinacion apertura", icon: Lock },
  { value: "UPDATE_SMS", label: "Enviar mensaje SMS", icon: MessageSquare },
  { value: "UPDATE_USER_SMS", label: "Asignar SMS a usuario", icon: MessageSquare },
  { value: "UPDATE_USERPIC", label: "Actualizar foto de usuario", icon: Image },
  { value: "DELETE_USERPIC", label: "Eliminar foto de usuario", icon: ImageMinus },
  { value: "SHELL", label: "Ejecutar comando del sistema", icon: Terminal },
  { value: "GETFILE", label: "Descargar archivo del dispositivo", icon: Download },
  { value: "PUTFILE", label: "Subir archivo al dispositivo", icon: Upload },
];

const SCHEDULE_TYPES = [
  { value: "one_time", label: "Una sola vez" },
  { value: "interval", label: "Cada X minutos" },
  { value: "daily", label: "Diario" },
  { value: "weekly", label: "Semanal" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
];

export default function Tasks() {
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const { toast } = useToast();

  const { data: tasks, isLoading } = useQuery<ScheduledTask[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: devices } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const form = useForm<InsertScheduledTask>({
    resolver: zodResolver(insertScheduledTaskSchema),
    defaultValues: {
      name: "",
      deviceSerial: "",
      commandType: "",
      commandParams: "",
      scheduleType: "one_time",
      enabled: true,
      intervalMinutes: 60,
      timeOfDay: "08:00",
    },
  });

  const scheduleType = form.watch("scheduleType");
  const commandType = form.watch("commandType");

  const createMutation = useMutation({
    mutationFn: async (data: InsertScheduledTask) => {
      const payload: any = { ...data };
      if (selectedDays.length > 0 && data.scheduleType === "weekly") {
        payload.daysOfWeek = selectedDays.join(",");
      }
      if (data.scheduleType === "one_time" && data.runAt) {
        payload.runAt = new Date(data.runAt).toISOString();
      }
      const res = await apiRequest("POST", "/api/tasks", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setOpen(false);
      resetForm();
      toast({ title: "Tarea creada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear tarea", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertScheduledTask> }) => {
      const payload: any = { ...data };
      if (selectedDays.length > 0 && data.scheduleType === "weekly") {
        payload.daysOfWeek = selectedDays.join(",");
      }
      if (data.scheduleType === "one_time" && data.runAt) {
        payload.runAt = new Date(data.runAt).toISOString();
      }
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setEditingTask(null);
      setOpen(false);
      resetForm();
      toast({ title: "Tarea actualizada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Tarea eliminada" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  function resetForm() {
    form.reset({
      name: "",
      deviceSerial: "",
      commandType: "",
      commandParams: "",
      scheduleType: "one_time",
      enabled: true,
      intervalMinutes: 60,
      timeOfDay: "08:00",
    });
    setSelectedDays([]);
  }

  function openEdit(task: ScheduledTask) {
    setEditingTask(task);
    form.reset({
      name: task.name,
      deviceSerial: task.deviceSerial,
      commandType: task.commandType,
      commandParams: task.commandParams || "",
      scheduleType: task.scheduleType as any,
      enabled: task.enabled,
      runAt: task.runAt ? (task.runAt as any) : undefined,
      intervalMinutes: task.intervalMinutes || 60,
      timeOfDay: task.timeOfDay || "08:00",
      daysOfWeek: task.daysOfWeek || "",
    });
    setSelectedDays(task.daysOfWeek ? task.daysOfWeek.split(",").map(Number) : []);
    setOpen(true);
  }

  function openNew() {
    setEditingTask(null);
    resetForm();
    setOpen(true);
  }

  function onSubmit(data: InsertScheduledTask) {
    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function toggleDay(day: number) {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  function getCommandLabel(type: string) {
    return COMMAND_TYPES.find(c => c.value === type)?.label || type;
  }

  function getScheduleLabel(task: ScheduledTask) {
    switch (task.scheduleType) {
      case "one_time":
        return task.runAt ? `Una vez: ${format(new Date(task.runAt), "dd/MM/yyyy HH:mm")}` : "Una vez";
      case "interval":
        return `Cada ${task.intervalMinutes} min`;
      case "daily":
        return `Diario a las ${task.timeOfDay}`;
      case "weekly": {
        const dayLabels = task.daysOfWeek
          ? task.daysOfWeek.split(",").map(Number).map(d => DAYS_OF_WEEK.find(dw => dw.value === d)?.label || d).join(", ")
          : "";
        return `Semanal: ${dayLabels} a las ${task.timeOfDay}`;
      }
      default:
        return task.scheduleType;
    }
  }

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
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

  function needsParams(cmd: string) {
    const cmdsWithParams = [
      "SET_OPTION", "QUERY_ATTLOG", "QUERY_ATTPHOTO", "QUERY_USERINFO", "QUERY_FINGERTMP",
      "DATA_USER", "DATA_DEL_USER", "DATA_FP", "DATA_DEL_FP", "ENROLL_FP",
      "SHELL", "UPDATE_TIMEZONE", "DELETE_TIMEZONE", "UPDATE_GLOCK", "DELETE_GLOCK",
      "UPDATE_SMS", "UPDATE_USER_SMS", "UPDATE_USERPIC", "DELETE_USERPIC", "GETFILE", "PUTFILE",
    ];
    return cmdsWithParams.includes(cmd);
  }

  function getParamPlaceholder(cmd: string): string {
    const placeholders: Record<string, string> = {
      SET_OPTION: '{"item":"Delay","value":"30"}',
      QUERY_ATTLOG: '{"startTime":"2025-01-01 00:00:00","endTime":"2025-01-31 23:59:59"}',
      QUERY_ATTPHOTO: '{"startTime":"2025-01-01 00:00:00","endTime":"2025-01-31 23:59:59"}',
      QUERY_USERINFO: '{"pin":"101"}',
      QUERY_FINGERTMP: '{"pin":"101","fingerId":0}',
      DATA_USER: '{"pin":"101","name":"Juan"}',
      DATA_DEL_USER: '{"pin":"101"}',
      DATA_FP: '{"pin":"101","fid":0,"size":1024,"valid":1,"tmp":"..."}',
      DATA_DEL_FP: '{"pin":"101","fid":0}',
      ENROLL_FP: '{"pin":"101","fid":0,"retry":3,"overwrite":1}',
      SHELL: '{"cmdString":"ls"}',
      UPDATE_TIMEZONE: '{"tzid":1,"itime":"08:00-17:00"}',
      DELETE_TIMEZONE: '{"tzid":1}',
      UPDATE_GLOCK: '{"glid":1,"groupIds":"1,2","memberCount":2}',
      DELETE_GLOCK: '{"glid":1}',
      UPDATE_SMS: '{"msg":"Mensaje","tag":253,"uid":1}',
      UPDATE_USER_SMS: '{"pin":"101","uid":1}',
      UPDATE_USERPIC: '{"pin":"101","picFile":"photo.jpg"}',
      DELETE_USERPIC: '{"pin":"101"}',
      GETFILE: '{"filePath":"/mnt/mtdblock/config.ini"}',
      PUTFILE: '{"url":"http://server/file.dat","filePath":"/mnt/mtdblock/file.dat"}',
    };
    return placeholders[cmd] || "{}";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Tareas programadas</h1>
          <p className="text-muted-foreground">Programa comandos para ejecutarse automaticamente</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingTask(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="button-add-task">
              <Plus className="w-4 h-4 mr-2" />
              Nueva tarea
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la tarea</FormLabel>
                    <FormControl>
                      <Input placeholder="Reinicio diario oficina" {...field} data-testid="input-task-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="deviceSerial" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispositivo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-device">
                          <SelectValue placeholder="Seleccionar dispositivo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {devices?.map((device) => (
                          <SelectItem key={device.id} value={device.serialNumber}>
                            {deviceLabel(device)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="commandType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comando</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-command">
                          <SelectValue placeholder="Seleccionar comando" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COMMAND_TYPES.map((cmd) => (
                          <SelectItem key={cmd.value} value={cmd.value}>
                            {cmd.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {needsParams(commandType) && (
                  <FormField control={form.control} name="commandParams" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parametros (JSON)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={getParamPlaceholder(commandType)}
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-task-params"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">Formato JSON con los parametros del comando</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="scheduleType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de programacion</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-schedule-type">
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SCHEDULE_TYPES.map((st) => (
                          <SelectItem key={st.value} value={st.value}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {scheduleType === "one_time" && (
                  <FormField control={form.control} name="runAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha y hora</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          value={field.value ? String(field.value).substring(0, 16) : ""}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          data-testid="input-task-run-at"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {scheduleType === "interval" && (
                  <FormField control={form.control} name="intervalMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo (minutos)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={1440}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 60)}
                          data-testid="input-task-interval"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {(scheduleType === "daily" || scheduleType === "weekly") && (
                  <FormField control={form.control} name="timeOfDay" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hora</FormLabel>
                      <FormControl>
                        <Input
                          type="time"
                          {...field}
                          value={field.value ?? "08:00"}
                          data-testid="input-task-time"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                {scheduleType === "weekly" && (
                  <div>
                    <FormLabel>Dias de la semana</FormLabel>
                    <div className="flex gap-1 mt-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          size="sm"
                          variant={selectedDays.includes(day.value) ? "default" : "outline"}
                          className="toggle-elevate"
                          onClick={() => toggleDay(day.value)}
                          data-testid={`button-day-${day.value}`}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <FormField control={form.control} name="enabled" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel>Tarea activa</FormLabel>
                      <FormDescription className="text-xs">La tarea se ejecutara segun la programacion</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-task-enabled" />
                    </FormControl>
                  </FormItem>
                )} />

                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-task">
                  {(createMutation.isPending || updateMutation.isPending) ? "Guardando..." : editingTask ? "Actualizar" : "Crear tarea"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
      ) : tasks && tasks.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Comando</TableHead>
                  <TableHead>Programacion</TableHead>
                  <TableHead>Proxima ejecucion</TableHead>
                  <TableHead>Ultima ejecucion</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                    <TableCell>
                      <Switch
                        checked={task.enabled}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: task.id, enabled: checked })}
                        data-testid={`switch-toggle-task-${task.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{task.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getDeviceAlias(task.deviceSerial)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getCommandLabel(task.commandType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{getScheduleLabel(task)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {task.nextRunAt ? format(new Date(task.nextRunAt), "dd/MM/yyyy HH:mm") : "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {task.lastRunAt ? format(new Date(task.lastRunAt), "dd/MM/yyyy HH:mm") : "Nunca"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(task)} data-testid={`button-edit-task-${task.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-delete-task-${task.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar tarea</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminara la tarea "{task.name}". Esta accion no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(task.id)} data-testid="button-confirm-delete-task">
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarClock className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No hay tareas programadas</p>
            <p className="text-xs text-muted-foreground mt-1">Haz clic en "Nueva tarea" para crear una</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
