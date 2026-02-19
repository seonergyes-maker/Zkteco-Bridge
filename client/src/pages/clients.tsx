import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type Client, type InsertClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Search, Pencil, Trash2, Database, Send, Wifi, WifiOff, ShieldCheck, Tag, X } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type IncidenceEntry = { code: string; label: string };

export default function Clients() {
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [maskedApiKey, setMaskedApiKey] = useState<string | null>(null);
  const [incidences, setIncidences] = useState<IncidenceEntry[]>([]);
  const [newIncCode, setNewIncCode] = useState("");
  const [newIncLabel, setNewIncLabel] = useState("");
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      clientId: "", name: "", contactEmail: "", contactPhone: "", active: true,
      oracleApiUrl: "", oracleApiKey: "", forwardingEnabled: false, retryAttempts: 3, retryDelayMs: 5000,
      usersApiUrl: "", usersApiKey: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setOpen(false);
      form.reset({ clientId: "", name: "", contactEmail: "", contactPhone: "", active: true, oracleApiUrl: "", oracleApiKey: "", forwardingEnabled: false, retryAttempts: 3, retryDelayMs: 5000, usersApiUrl: "", usersApiKey: "" });
      toast({ title: "Cliente creado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al crear cliente", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertClient> }) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditingClient(null);
      setOpen(false);
      form.reset({ clientId: "", name: "", contactEmail: "", contactPhone: "", active: true, oracleApiUrl: "", oracleApiKey: "", forwardingEnabled: false, retryAttempts: 3, retryDelayMs: 5000, usersApiUrl: "", usersApiKey: "" });
      toast({ title: "Cliente actualizado correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al actualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Cliente eliminado" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al eliminar", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/clients/${id}/test-forwarding`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Conexion exitosa", description: "La API de Oracle responde correctamente" });
      } else {
        toast({ title: "Error de conexion", description: data.error, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error al probar", description: error.message, variant: "destructive" });
    },
  });

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.clientId.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function parseIncidenceConfig(config: string | null): IncidenceEntry[] {
    if (!config) return [];
    try {
      const parsed = JSON.parse(config);
      return Object.entries(parsed).map(([code, label]) => ({ code, label: label as string }));
    } catch { return []; }
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setMaskedApiKey(client.oracleApiKey || null);
    setIncidences(parseIncidenceConfig(client.incidenceConfig));
    setNewIncCode("");
    setNewIncLabel("");
    form.reset({
      clientId: client.clientId,
      name: client.name,
      contactEmail: client.contactEmail || "",
      contactPhone: client.contactPhone || "",
      active: client.active,
      oracleApiUrl: client.oracleApiUrl || "",
      oracleApiKey: "",
      forwardingEnabled: client.forwardingEnabled,
      retryAttempts: client.retryAttempts,
      retryDelayMs: client.retryDelayMs,
      usersApiUrl: client.usersApiUrl || "",
      usersApiKey: "",
    });
    setOpen(true);
  }

  function openNew() {
    setEditingClient(null);
    setMaskedApiKey(null);
    setIncidences([]);
    setNewIncCode("");
    setNewIncLabel("");
    form.reset({ clientId: "", name: "", contactEmail: "", contactPhone: "", active: true, oracleApiUrl: "", oracleApiKey: "", forwardingEnabled: false, retryAttempts: 3, retryDelayMs: 5000, usersApiUrl: "", usersApiKey: "" });
    setOpen(true);
  }

  function buildIncidenceConfigJson(): string | null {
    if (incidences.length === 0) return null;
    const config: Record<string, string> = {};
    for (const inc of incidences) {
      config[inc.code] = inc.label;
    }
    return JSON.stringify(config);
  }

  function addIncidence() {
    const code = newIncCode.trim();
    const label = newIncLabel.trim();
    if (!code || !label) return;
    if (code === "0") {
      toast({ title: "El codigo 0 es fichaje normal", variant: "destructive" });
      return;
    }
    if (incidences.some(i => i.code === code)) {
      toast({ title: "Ese codigo ya existe", variant: "destructive" });
      return;
    }
    setIncidences([...incidences, { code, label }]);
    setNewIncCode("");
    setNewIncLabel("");
  }

  function removeIncidence(code: string) {
    setIncidences(incidences.filter(i => i.code !== code));
  }

  function onSubmit(data: InsertClient) {
    const incidenceConfig = buildIncidenceConfigJson();
    if (editingClient) {
      const updateData = { ...data, incidenceConfig };
      if (!updateData.oracleApiKey || updateData.oracleApiKey.trim() === "") {
        delete (updateData as any).oracleApiKey;
      }
      if (!updateData.usersApiKey || updateData.usersApiKey.trim() === "") {
        delete (updateData as any).usersApiKey;
      }
      updateMutation.mutate({ id: editingClient.id, data: updateData });
    } else {
      createMutation.mutate({ ...data, incidenceConfig });
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Clientes</h1>
          <p className="text-muted-foreground">Gestiona tus clientes y sus fichadores</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingClient(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} data-testid="button-add-client">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Tabs defaultValue="general">
                  <TabsList className="w-full">
                    <TabsTrigger value="general" className="flex-1" data-testid="tab-general">General</TabsTrigger>
                    <TabsTrigger value="oracle" className="flex-1" data-testid="tab-oracle">Reenvio Oracle</TabsTrigger>
                    <TabsTrigger value="incidences" className="flex-1" data-testid="tab-incidences">Incidencias</TabsTrigger>
                    <TabsTrigger value="users-api" className="flex-1" data-testid="tab-users-api">API Usuarios</TabsTrigger>
                  </TabsList>
                  <TabsContent value="general" className="space-y-4 mt-4">
                    <FormField control={form.control} name="clientId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID Cliente</FormLabel>
                        <FormControl>
                          <Input placeholder="CLI-001" {...field} data-testid="input-client-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Empresa S.L." {...field} data-testid="input-client-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email de contacto</FormLabel>
                        <FormControl>
                          <Input placeholder="contacto@empresa.com" {...field} value={field.value ?? ""} data-testid="input-client-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefono</FormLabel>
                        <FormControl>
                          <Input placeholder="+34 600 000 000" {...field} value={field.value ?? ""} data-testid="input-client-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </TabsContent>
                  <TabsContent value="oracle" className="space-y-4 mt-4">
                    <FormField control={form.control} name="forwardingEnabled" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <FormLabel>Reenvio activo</FormLabel>
                          <FormDescription className="text-xs">Los fichajes de este cliente se reenviaran a Oracle</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-forwarding-enabled" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="oracleApiUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de la API Oracle</FormLabel>
                        <FormControl>
                          <Input placeholder="https://tu-api.com/api/fichajes" {...field} value={field.value ?? ""} data-testid="input-oracle-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="oracleApiKey" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          API Key (opcional)
                          <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                          <span className="text-xs font-normal text-muted-foreground">Cifrada AES-256</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={editingClient && maskedApiKey ? `Clave actual: ${maskedApiKey}` : "tu-api-key-secreta"}
                            type="password"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-oracle-key"
                          />
                        </FormControl>
                        {editingClient && maskedApiKey && (
                          <FormDescription className="text-xs">
                            Dejar vacio para mantener la clave actual. Escribir una nueva clave para reemplazarla.
                          </FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="retryAttempts" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reintentos</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} max={10} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 3)} data-testid="input-retry-attempts" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="retryDelayMs" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delay reintento (ms)</FormLabel>
                          <FormControl>
                            <Input type="number" min={1000} max={60000} step={1000} {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 5000)} data-testid="input-retry-delay" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    {editingClient && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => testMutation.mutate(editingClient.id)}
                        disabled={testMutation.isPending}
                        data-testid="button-test-connection"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {testMutation.isPending ? "Probando..." : "Probar conexion"}
                      </Button>
                    )}
                  </TabsContent>
                  <TabsContent value="incidences" className="space-y-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Configura los codigos de incidencia para este cliente. El codigo 0 siempre es fichaje normal.
                    </p>
                    <div className="space-y-2">
                      {incidences.length > 0 && (
                        <div className="space-y-1">
                          {incidences.map((inc) => (
                            <div key={inc.code} className="flex items-center gap-2 rounded-md border p-2" data-testid={`incidence-row-${inc.code}`}>
                              <Badge variant="secondary" className="font-mono">{inc.code}</Badge>
                              <span className="flex-1 text-sm">{inc.label}</span>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeIncidence(inc.code)} data-testid={`button-remove-incidence-${inc.code}`}>
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="w-20">
                          <label className="text-xs text-muted-foreground">Codigo</label>
                          <Input
                            type="number"
                            min={1}
                            placeholder="1"
                            value={newIncCode}
                            onChange={(e) => setNewIncCode(e.target.value)}
                            data-testid="input-incidence-code"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-muted-foreground">Descripcion</label>
                          <Input
                            placeholder="Ej: Vacaciones, Baja medica..."
                            value={newIncLabel}
                            onChange={(e) => setNewIncLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIncidence(); } }}
                            data-testid="input-incidence-label"
                          />
                        </div>
                        <Button type="button" variant="outline" onClick={addIncidence} data-testid="button-add-incidence">
                          <Plus className="w-4 h-4 mr-1" />
                          Anadir
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-md border p-3 bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-medium">Fichaje normal (codigo 0)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Los fichajes con codigo 0 se consideran entradas/salidas normales. Los codigos 1 en adelante representan las incidencias configuradas arriba.
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="users-api" className="space-y-4 mt-4">
                    <FormField control={form.control} name="usersApiUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL de la API de Usuarios</FormLabel>
                        <FormControl>
                          <Input placeholder="https://tu-api.com/api/usuarios" {...field} value={field.value ?? ""} data-testid="input-users-api-url" />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Endpoint que devuelve un JSON con los usuarios (array con pin, name, card, privilege)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="usersApiKey" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          API Key (opcional)
                          <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="tu-api-key"
                            type="password"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-users-api-key"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Se enviara como Bearer token en la cabecera Authorization
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </TabsContent>
                </Tabs>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-client">
                  {(createMutation.isPending || updateMutation.isPending) ? "Guardando..." : editingClient ? "Actualizar" : "Crear cliente"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-clients"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Card key={client.id} className="hover-elevate" data-testid={`card-client-${client.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{client.name}</h3>
                      <p className="text-xs text-muted-foreground">ID: {client.clientId}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={client.active ? "default" : "secondary"}>
                      {client.active ? "Activo" : "Inactivo"}
                    </Badge>
                    {client.forwardingEnabled ? (
                      <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400">
                        <Wifi className="w-3 h-3 mr-1" />
                        Oracle
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <WifiOff className="w-3 h-3 mr-1" />
                        Sin reenvio
                      </Badge>
                    )}
                  </div>
                </div>
                {(client.contactEmail || client.contactPhone) && (
                  <div className="mt-3 pt-3 border-t space-y-1">
                    {client.contactEmail && <p className="text-xs text-muted-foreground">{client.contactEmail}</p>}
                    {client.contactPhone && <p className="text-xs text-muted-foreground">{client.contactPhone}</p>}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(client)} data-testid={`button-edit-client-${client.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-delete-client-${client.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminara el cliente "{client.name}" y todos sus dispositivos asociados. Esta accion no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(client.id)} data-testid="button-confirm-delete">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="w-16 h-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No hay clientes {search ? "que coincidan con tu busqueda" : "registrados"}</p>
            {!search && <p className="text-xs text-muted-foreground mt-1">Haz clic en "Nuevo cliente" para empezar</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
