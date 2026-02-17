import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Globe, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

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
        <p className="text-muted-foreground">Configuracion del servidor PUSH SDK</p>
      </div>

      <div className="max-w-2xl">
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
            <div className="rounded-md bg-muted p-4 space-y-2">
              <h4 className="text-sm font-medium">Reenvio a Oracle</h4>
              <p className="text-xs text-muted-foreground">
                La configuracion de reenvio a Oracle se gestiona por cada cliente individualmente.
                Ve a la seccion de Clientes, edita un cliente y accede a la pestana "Reenvio Oracle" para configurar la URL, API Key y opciones de reenvio.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
