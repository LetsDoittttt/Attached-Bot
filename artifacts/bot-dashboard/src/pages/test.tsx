import React, { useState } from "react";
import { useTestBypass } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Terminal, ArrowRight, Activity, AlertCircle, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TestPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const testBypass = useTestBypass({
    mutation: {
      onError: (error: any) => {
        toast({
          title: "Test Failed",
          description: error?.message || "An error occurred while testing the bypass API.",
          variant: "destructive"
        });
      }
    }
  });

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    testBypass.mutate({ data: { url: url.trim() } });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Link Tester</h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">DIAGNOSTIC_UTILITY</p>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal size={18} className="text-primary" />
            Live Bypass Test
          </CardTitle>
          <CardDescription>
            Test the configured bypass API directly without sending through Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTest} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://short-link.example/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-primary/20 focus-visible:ring-primary"
                disabled={testBypass.isPending}
              />
            </div>
            <Button 
              type="submit" 
              disabled={!url.trim() || testBypass.isPending}
              className="font-mono w-[120px]"
            >
              {testBypass.isPending ? (
                <span className="flex items-center">
                  <Activity size={14} className="mr-2 animate-spin" />
                  TESTING...
                </span>
              ) : (
                "EXECUTE"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {testBypass.data && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h2 className="text-sm font-mono text-muted-foreground">EXECUTION_RESULT</h2>
          
          <Card className={`border ${testBypass.data.success ? 'border-emerald-500/30' : 'border-destructive/30'}`}>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className={`font-mono text-xs ${
                    testBypass.data.success 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {testBypass.data.success ? 'SUCCESS' : 'FAILED'}
                </Badge>
              </div>

              <div className="space-y-4 relative">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono">ORIGINAL_URL</Label>
                  <div className="p-3 bg-muted rounded-md font-mono text-sm text-foreground break-all">
                    {testBypass.data.originalUrl}
                  </div>
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-background p-2 rounded-full border border-border">
                    <ArrowRight size={16} className="text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono">BYPASSED_RESULT</Label>
                  {testBypass.data.success && testBypass.data.bypassedUrl ? (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-md font-mono text-sm text-primary break-all flex justify-between items-start gap-4">
                      <span>{testBypass.data.bypassedUrl}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-primary hover:text-primary hover:bg-primary/20 -mt-1 -mr-1"
                        onClick={() => handleCopy(testBypass.data.bypassedUrl!)}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md font-mono text-sm text-destructive flex items-start gap-3">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{testBypass.data.error || "Unknown error occurred"}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
