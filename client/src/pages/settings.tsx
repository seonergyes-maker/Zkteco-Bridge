import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Globe, Copy, CheckCircle, Shield, Key, Eye, EyeOff, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AccessLogEntry {
  id: number;
  username: string;
  ip: string;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const pushEndpoint = `${baseUrl}`;

  function copyEndpoint() {
    navigator.clipboard.writeText(pushEndpoint);
    setCopied(true);
    toast({ title: "URL copiada al portapapeles" });
    setTimeout(() => setCopied(false), 2000);
  }

  const { data: accessLogs, isLoading: logsLoading } = useQuery<AccessLogEntry[]>({
    queryKey: ["/api/auth/access-logs"],
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword }),
    onSuccess: () => {
      toast({ title: "Contrasena actualizada correctamente" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: "Las contrasenas no coinciden", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "La contrasena debe tener al menos 6 caracteres", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate();
  }

  function formatLogDate(ts: string): string {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    const secs = String(d.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Configuracion</h1>
        <p className="text-muted-foreground">Configuracion del servidor y seguridad</p>
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
              <Label>URL del servidor</Label>
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
              <Key className="w-4 h-4" />
              Cambiar contrasena
            </CardTitle>
            <CardDescription>
              Actualiza tu contrasena de acceso al panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Contrasena actual</Label>
                <div className="relative">
                  <Input
                    type={showPasswords ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    data-testid="input-current-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nueva contrasena</Label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar nueva contrasena</Label>
                <Input
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  data-testid="input-confirm-password"
                />
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  data-testid="button-toggle-passwords"
                >
                  {showPasswords ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                  {showPasswords ? "Ocultar" : "Mostrar"}
                </Button>
                <Button type="submit" disabled={changePasswordMutation.isPending} data-testid="button-change-password">
                  <Shield className="w-4 h-4 mr-2" />
                  {changePasswordMutation.isPending ? "Cambiando..." : "Cambiar contrasena"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Log de accesos
              </CardTitle>
              <CardDescription>Registro de intentos de inicio de sesion</CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/auth/access-logs"] })}
              data-testid="button-refresh-access-logs"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !accessLogs || accessLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No hay registros de acceso</p>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accessLogs.map((log) => (
                    <TableRow key={log.id} data-testid={`access-log-${log.id}`}>
                      <TableCell className="font-mono text-xs">{formatLogDate(log.createdAt)}</TableCell>
                      <TableCell className="font-medium text-sm">{log.username}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <Badge variant="default" className="text-xs">
                            <ShieldCheck className="w-3 h-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Fallido
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.reason || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
