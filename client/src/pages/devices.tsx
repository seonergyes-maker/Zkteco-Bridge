import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDeviceSchema, type Device, type InsertDevice, type Client } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Cpu, Search, Pencil, Trash2, Wifi, WifiOff, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

export default function Devices() {
  const [open, setOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertDevice>({
    resolver: zodResolver(insertDeviceSchema),
    defaultValues: { serialNumber: "", clientId: 0, alias: "", active: true },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDevice) => {
      const res = await apiRequest("POST", "/api/devices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setOpen(false);
      form.reset();
      toast({ title: "Dispositivo creado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear dispositivo", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDevice> }) => {
      const res = await apiRequest("PATCH", `/api/devices/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setEditingDevice(null);
      setOpen(false);
      form.reset();
      toast({ title: "Dispositivo actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Dispositivo eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const recoverUsersMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/devices/${id}/recover-users`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Comando enviado", description: "Se ha solicitado la lista de usuarios al dispositivo. Los usuarios se guardaran cuando el dispositivo responda." });
    },
    onError: (error: Error) => {
      toast({ title: "Error al recuperar usuarios", description: error.message, variant: "destructive" });
    },
  });

  const filtered = devices?.filter(d =>
    (d.alias || "").toLowerCase().includes(search.toLowerCase()) ||
    d.serialNumber.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function getClientName(clientId: number) {
    return clients?.find(c => c.id === clientId)?.name || "Desconocido";
  }

  function openEdit(device: Device) {
    setEditingDevice(device);
    form.reset({
      serialNumber: device.serialNumber,
      clientId: device.clientId,
      alias: device.alias || "",
      active: device.active,
    });
    setOpen(true);
  }

  function openNew() {
    setEditingDevice(null);
    form.reset({ serialNumber: "", clientId: 0, alias: "", active: true });
    setOpen(true);
  }

  function onSubmit(data: InsertDevice) {
    if (editingDevice) {
      updateMutation.mutate({ id: editingDevice.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Dispositivos</h1>
          <p className="text-muted-foreground">Fichadores ZKTeco conectados al sistema</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingDevice(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="button-add-device">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo dispositivo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDevice ? "Editar dispositivo" : "Nuevo dispositivo"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="serialNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numero de serie</FormLabel>
                    <FormControl>
                      <Input placeholder="ABCD123456" {...field} data-testid="input-device-serial" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={field.value ? String(field.value) : ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-device-client">
                          <SelectValue placeholder="Selecciona un cliente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={String(client.id)}>
                            {client.name} ({client.clientId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="alias" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alias</FormLabel>
                    <FormControl>
                      <Input placeholder="Entrada principal" {...field} value={field.value ?? ""} data-testid="input-device-alias" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {editingDevice && (editingDevice.model || editingDevice.ipAddress) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <FormLabel>Modelo</FormLabel>
                      <Input value={editingDevice.model || "-"} disabled className="bg-muted" data-testid="input-device-model" />
                      <p className="text-xs text-muted-foreground">Auto-detectado</p>
                    </div>
                    <div className="space-y-1">
                      <FormLabel>IP</FormLabel>
                      <Input value={editingDevice.ipAddress || "-"} disabled className="bg-muted" data-testid="input-device-ip" />
                      <p className="text-xs text-muted-foreground">Auto-detectada</p>
                    </div>
                  </div>
                )}
                {!editingDevice && (
                  <p className="text-xs text-muted-foreground">El modelo y la IP se detectan automaticamente cuando el dispositivo se conecta al servidor.</p>
                )}
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-device">
                  {(createMutation.isPending || updateMutation.isPending) ? "Guardando..." : editingDevice ? "Actualizar" : "Crear dispositivo"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar dispositivos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-devices"
        />
      </div>

      {isLoading ? (
        <Card><CardContent className="p-0"><Skeleton className="h-64 w-full" /></CardContent></Card>
      ) : filtered.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>N. Serie</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Ultima conexion</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((device) => {
                  const isOnline = device.lastSeen && (Date.now() - new Date(device.lastSeen).getTime()) < 5 * 60 * 1000;
                  return (
                    <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isOnline ? (
                            <Wifi className="w-4 h-4 text-green-500" />
                          ) : (
                            <WifiOff className="w-4 h-4 text-muted-foreground/40" />
                          )}
                          <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
                            {isOnline ? "Online" : "Offline"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{device.serialNumber}</TableCell>
                      <TableCell>{device.alias || "-"}</TableCell>
                      <TableCell>{getClientName(device.clientId)}</TableCell>
                      <TableCell className="text-muted-foreground">{device.model || "-"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{device.ipAddress || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {device.lastSeen ? format(new Date(device.lastSeen), "dd/MM/yyyy HH:mm:ss") : "Nunca"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => recoverUsersMutation.mutate(device.id)}
                                disabled={recoverUsersMutation.isPending}
                                data-testid={`button-recover-users-${device.id}`}
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Recuperar usuarios del dispositivo</TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(device)} data-testid={`button-edit-device-${device.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" data-testid={`button-delete-device-${device.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar dispositivo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminara el dispositivo "{device.alias || device.serialNumber}". Esta accion no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(device.id)}>Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
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
            <Cpu className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No hay dispositivos {search ? "que coincidan" : "registrados"}</p>
            {!search && <p className="text-xs text-muted-foreground mt-1">Haz clic en "Nuevo dispositivo" para agregar uno</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
