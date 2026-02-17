import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type Client, type InsertClient } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Building2, Search, Cpu, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function Clients() {
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: { clientId: "", name: "", contactEmail: "", contactPhone: "", active: true },
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
      form.reset({ clientId: "", name: "", contactEmail: "", contactPhone: "", active: true });
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
      form.reset({ clientId: "", name: "", contactEmail: "", contactPhone: "", active: true });
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

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.clientId.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function openEdit(client: Client) {
    setEditingClient(client);
    form.reset({
      clientId: client.clientId,
      name: client.name,
      contactEmail: client.contactEmail || "",
      contactPhone: client.contactPhone || "",
      active: client.active,
    });
    setOpen(true);
  }

  function openNew() {
    setEditingClient(null);
    form.reset({ clientId: "", name: "", contactEmail: "", contactPhone: "", active: true });
    setOpen(true);
  }

  function onSubmit(data: InsertClient) {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <Badge variant={client.active ? "default" : "secondary"}>
                    {client.active ? "Activo" : "Inactivo"}
                  </Badge>
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
