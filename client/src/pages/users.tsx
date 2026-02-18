import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDeviceUserSchema, type Client, type Device, type DeviceUser, type InsertDeviceUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users as UsersIcon, RefreshCw, Send, Loader2, Plus, Trash2, Search, Pencil, Download, Upload,
} from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PRIVILEGES: Record<number, string> = {
  0: "Usuario normal",
  2: "Grabador",
  6: "Administrador",
  14: "Super Admin",
};

export default function DeviceUsersPage() {
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [syncDevice, setSyncDevice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DeviceUser | null>(null);
  const { toast } = useToast();

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: devices, isLoading: devicesLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const clientIdNum = selectedClient !== "all" ? parseInt(selectedClient) : undefined;

  const { data: users, isLoading: usersLoading } = useQuery<DeviceUser[]>({
    queryKey: ["/api/device-users", clientIdNum],
    queryFn: async () => {
      const url = clientIdNum ? `/api/device-users?clientId=${clientIdNum}` : "/api/device-users";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar usuarios");
      return res.json();
    },
  });

  const clientDevices = devices?.filter(d => {
    if (clientIdNum) return d.clientId === clientIdNum;
    return true;
  }) ?? [];

  const form = useForm<InsertDeviceUser>({
    resolver: zodResolver(insertDeviceUserSchema),
    defaultValues: {
      clientId: 0,
      pin: "",
      name: "",
      password: "",
      card: "",
      privilege: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDeviceUser) => {
      const res = await apiRequest("POST", "/api/device-users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-users"] });
      setDialogOpen(false);
      form.reset({ clientId: 0, pin: "", name: "", password: "", card: "", privilege: 0 });
      toast({ title: "Usuario creado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear usuario", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDeviceUser> }) => {
      const res = await apiRequest("PATCH", `/api/device-users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-users"] });
      setDialogOpen(false);
      setEditingUser(null);
      form.reset({ clientId: 0, pin: "", name: "", password: "", card: "", privilege: 0 });
      toast({ title: "Usuario actualizado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/device-users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-users"] });
      toast({ title: "Usuario eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const syncFromApiMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const res = await apiRequest("POST", "/api/device-users/sync-from-api", { clientId });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-users"] });
      toast({ title: "Sincronizacion completada", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Error al sincronizar", description: error.message, variant: "destructive" });
    },
  });

  const syncToDeviceMutation = useMutation({
    mutationFn: async (data: { userIds: number[]; deviceSerial: string }) => {
      const res = await apiRequest("POST", "/api/device-users/sync-to-device", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      setSelectedUsers([]);
      setSyncDevice("");
      toast({ title: "Usuarios enviados", description: data.message });
    },
    onError: (error: Error) => {
      toast({ title: "Error al enviar usuarios", description: error.message, variant: "destructive" });
    },
  });

  const filtered = users?.filter(u => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (u.pin.toLowerCase().includes(term)) ||
      (u.name?.toLowerCase().includes(term));
  }) ?? [];

  function getClientName(cId: number) {
    return clients?.find(c => c.id === cId)?.name || `Cliente ${cId}`;
  }

  function getSyncedDevices(u: DeviceUser): string[] {
    if (!u.syncedToDevices) return [];
    try { return JSON.parse(u.syncedToDevices); } catch { return []; }
  }

  function openNew() {
    setEditingUser(null);
    form.reset({
      clientId: clientIdNum || (clients?.[0]?.id || 0),
      pin: "", name: "", password: "", card: "", privilege: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(user: DeviceUser) {
    setEditingUser(user);
    form.reset({
      clientId: user.clientId,
      pin: user.pin,
      name: user.name || "",
      password: user.password || "",
      card: user.card || "",
      privilege: user.privilege,
    });
    setDialogOpen(true);
  }

  function onSubmit(data: InsertDeviceUser) {
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function toggleSelect(id: number) {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedUsers.length === filtered.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filtered.map(u => u.id));
    }
  }

  function handleSyncToDevice() {
    if (!syncDevice || selectedUsers.length === 0) return;
    syncToDeviceMutation.mutate({ userIds: selectedUsers, deviceSerial: syncDevice });
  }

  const selectedClientObj = clientIdNum ? clients?.find(c => c.id === clientIdNum) : null;
  const canSyncFromApi = selectedClientObj?.usersApiUrl;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Usuarios de dispositivos</h1>
          <p className="text-muted-foreground">Gestiona los usuarios que se envian a los dispositivos ZKTeco</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canSyncFromApi && (
            <Button
              variant="outline"
              onClick={() => syncFromApiMutation.mutate(clientIdNum!)}
              disabled={syncFromApiMutation.isPending}
              data-testid="button-sync-from-api"
            >
              {syncFromApiMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Importar desde API
            </Button>
          )}
          <Button onClick={openNew} data-testid="button-new-user">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo usuario
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-[220px]">
          <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedUsers([]); }}>
            <SelectTrigger data-testid="select-filter-client">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por PIN o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search-users"
          />
        </div>
      </div>

      {selectedUsers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">{selectedUsers.length} usuario(s) seleccionado(s)</span>
              <div className="flex items-center gap-2 flex-wrap">
                {devicesLoading ? (
                  <Skeleton className="h-9 w-[200px]" />
                ) : (
                  <Select value={syncDevice} onValueChange={setSyncDevice}>
                    <SelectTrigger className="w-[220px]" data-testid="select-sync-device">
                      <SelectValue placeholder="Dispositivo destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientDevices.map((d) => (
                        <SelectItem key={d.serialNumber} value={d.serialNumber}>
                          {d.alias || d.serialNumber} ({d.serialNumber})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  onClick={handleSyncToDevice}
                  disabled={!syncDevice || syncToDeviceMutation.isPending}
                  data-testid="button-sync-to-device"
                >
                  {syncToDeviceMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Enviar a dispositivo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <UsersIcon className="w-4 h-4" />
              Usuarios ({filtered.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {usersLoading || clientsLoading ? (
            <div className="p-6"><Skeleton className="h-48 w-full" /></div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedUsers.length === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead>PIN</TableHead>
                  <TableHead>Nombre</TableHead>
                  {selectedClient === "all" && <TableHead>Cliente</TableHead>}
                  <TableHead>Privilegio</TableHead>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead>Sincronizado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const synced = getSyncedDevices(u);
                  return (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedUsers.includes(u.id)}
                          onCheckedChange={() => toggleSelect(u.id)}
                          data-testid={`checkbox-user-${u.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{u.pin}</TableCell>
                      <TableCell>{u.name || "-"}</TableCell>
                      {selectedClient === "all" && (
                        <TableCell>
                          <Badge variant="outline">{getClientName(u.clientId)}</Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="secondary">{PRIVILEGES[u.privilege] || `Nivel ${u.privilege}`}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{u.card || "-"}</TableCell>
                      <TableCell>
                        {synced.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {synced.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No sincronizado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-delete-user-${u.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Se eliminara el usuario {u.pin} ({u.name}). Esta accion no se puede deshacer.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(u.id)}>Eliminar</AlertDialogAction>
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
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <UsersIcon className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground">No hay usuarios</p>
              <p className="text-xs text-muted-foreground mt-1">
                {canSyncFromApi ? "Importa usuarios desde la API o crea uno manualmente" : "Crea un usuario manualmente o configura la API de usuarios en el cliente"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="clientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(parseInt(v))}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-user-client">
                        <SelectValue placeholder="Selecciona un cliente" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients?.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pin" render={({ field }) => (
                <FormItem>
                  <FormLabel>PIN</FormLabel>
                  <FormControl>
                    <Input placeholder="1001" {...field} data-testid="input-user-pin" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Perez" {...field} value={field.value ?? ""} data-testid="input-user-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contrasena</FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} value={field.value ?? ""} data-testid="input-user-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="card" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarjeta</FormLabel>
                    <FormControl>
                      <Input placeholder="1234567890" {...field} value={field.value ?? ""} data-testid="input-user-card" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="privilege" render={({ field }) => (
                <FormItem>
                  <FormLabel>Privilegio</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(parseInt(v))}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-user-privilege">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(PRIVILEGES).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-user">
                {(createMutation.isPending || updateMutation.isPending) ? "Guardando..." : editingUser ? "Actualizar" : "Crear usuario"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
