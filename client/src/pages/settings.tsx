import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertForwardingConfigSchema, type ForwardingConfig, type InsertForwardingConfig } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Settings, Database, Globe, Shield, Copy, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: config, isLoading } = useQuery<ForwardingConfig | null>({
    queryKey: ["/api/forwarding-config"],
  });

  const form = useForm<InsertForwardingConfig>({
    resolver: zodResolver(insertForwardingConfigSchema),
    defaultValues: {
      oracleApiUrl: "",
      oracleApiKey: "",
      enabled: false,
      retryAttempts: 3,
      retryDelayMs: 5000,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset({
        oracleApiUrl: config.oracleApiUrl,
        oracleApiKey: config.oracleApiKey || "",
        enabled: config.enabled,
        retryAttempts: config.retryAttempts,
        retryDelayMs: config.retryDelayMs,
      });
    }
  }, [config, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: InsertForwardingConfig) => {
      const res = await apiRequest("POST", "/api/forwarding-config", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forwarding-config"] });
      toast({ title: "Configuracion guardada correctamente" });
    },
    onError: (error: Error) => {
      toast({ title: "Error al guardar", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/forwarding-config/test");
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
      toast({ title: "Error al probar conexion", description: error.message, variant: "destructive" });
    },
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const pushEndpoint = `${baseUrl}/iclock/cdata`;

  function copyEndpoint() {
    navigator.clipboard.writeText(pushEndpoint);
    setCopied(true);
    toast({ title: "URL copiada al portapapeles" });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Configuracion</h1>
        <p className="text-muted-foreground">Configuracion del servidor PUSH SDK y reenvio a Oracle</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Endpoint PUSH SDK
            </CardTitle>
            <CardDescription>
              Configura este URL en tus dispositivos ZKTeco como servidor PUSH
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">URL del servidor</label>
              <div className="flex items-center gap-2">
                <Input value={pushEndpoint} readOnly className="font-mono text-xs" data-testid="input-push-endpoint" />
                <Button variant="outline" size="icon" onClick={copyEndpoint} data-testid="button-copy-endpoint">
                  {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="rounded-md bg-muted p-4 space-y-2">
              <h4 className="text-sm font-medium">Configuracion en el dispositivo ZKTeco:</h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Accede a la configuracion de red del dispositivo</li>
                <li>Activa el modo PUSH</li>
                <li>Introduce la URL del servidor indicada arriba</li>
                <li>Asegurate de que el numero de serie del dispositivo esta registrado en esta app</li>
                <li>El dispositivo se conectara automaticamente cada 30 segundos</li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Endpoints disponibles</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">GET</Badge>
                  <code className="text-muted-foreground">/iclock/cdata?SN=xxx&options=all</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">POST</Badge>
                  <code className="text-muted-foreground">/iclock/cdata?SN=xxx&table=ATTLOG</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">GET</Badge>
                  <code className="text-muted-foreground">/iclock/getrequest?SN=xxx</code>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">POST</Badge>
                  <code className="text-muted-foreground">/iclock/devicecmd?SN=xxx</code>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Reenvio a Oracle
            </CardTitle>
            <CardDescription>
              Configura la conexion con tu API de Oracle para reenviar los fichajes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
                  <FormField control={form.control} name="enabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <FormLabel>Reenvio activo</FormLabel>
                        <FormDescription className="text-xs">Los eventos se reenviaran automaticamente</FormDescription>
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
                        <Input placeholder="https://tu-api.com/api/fichajes" {...field} data-testid="input-oracle-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="oracleApiKey" render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="tu-api-key-secreta" type="password" {...field} value={field.value ?? ""} data-testid="input-oracle-key" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="retryAttempts" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reintentos</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={10} {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} data-testid="input-retry-attempts" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="retryDelayMs" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delay reintento (ms)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1000} max={60000} step={1000} {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} data-testid="input-retry-delay" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={saveMutation.isPending} data-testid="button-save-config">
                      {saveMutation.isPending ? "Guardando..." : "Guardar configuracion"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-test-connection">
                      {testMutation.isPending ? "Probando..." : "Probar conexion"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
