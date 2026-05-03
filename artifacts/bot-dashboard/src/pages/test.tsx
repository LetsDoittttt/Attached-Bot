import React, { useState } from "react";
import { useGetConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Terminal, ArrowRight, Activity, AlertCircle, Copy, Check, Zap, Link } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TestPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: config } = useGetConfig();
  const hasExternalApi = Boolean(config?.bypassApiUrl);

  const [testResult, setTestResult] = useState<{
    originalUrl: string;
    bypassedUrl: string | null;
    success: boolean;
    error: string | null;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsTesting(true);
    setTestResult(null);
    fetch("/api/bypass/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "An error occurred while testing the pipeline.");
        setTestResult(data);
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : "An error occurred while testing the pipeline.";
        toast({ title: "Test Failed", description: msg, variant: "destructive" });
      })
      .finally(() => setIsTesting(false));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline Tester</h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">DIAGNOSTIC_UTILITY</p>
      </div>

      {/* Pipeline mode banner */}
      <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
        hasExternalApi
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"
      }`}>
        {hasExternalApi ? <Link size={16} className="mt-0.5 shrink-0" /> : <Zap size={16} className="mt-0.5 shrink-0" />}
        <div>
          {hasExternalApi ? (
            <>
              <span className="font-semibold">External API active</span>
              <span className="text-muted-foreground ml-2 font-mono text-xs">{config?.bypassApiUrl}</span>
            </>
          ) : (
            <>
              <span className="font-semibold">Built-in Linkvertise bypass active</span>
              <span className="text-muted-foreground block mt-0.5">
                No external API configured. Paste a link below to test the full pipeline. Configure your own API in Setup when you have one.
              </span>
            </>
          )}
        </div>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal size={18} className="text-primary" />
            Live Pipeline Test
          </CardTitle>
          <CardDescription>
            {hasExternalApi
              ? "Test your configured bypass API, AdMaven upload, and Telegram post."
              : "Paste a link to test the built-in bypass, AdMaven upload, and Telegram post."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTest} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder={hasExternalApi ? "https://short-link.example/..." : "https://linkvertise.com/..."}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="font-mono text-sm bg-muted/50 border-primary/20 focus-visible:ring-primary"
                disabled={isTesting}
              />
            </div>
            <Button
              type="submit"
              disabled={!url.trim() || isTesting}
              className="font-mono w-[120px]"
            >
              {isTesting ? (
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

      {testResult && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h2 className="text-sm font-mono text-muted-foreground">EXECUTION_RESULT</h2>

          <Card className={`border ${testResult.success ? 'border-emerald-500/30' : 'border-destructive/30'}`}>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${
                    testResult.success
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      : 'bg-destructive/10 text-destructive border-destructive/20'
                  }`}
                >
                  {testResult.success ? 'SUCCESS' : 'FAILED'}
                </Badge>
              </div>

              <div className="space-y-4 relative">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono">ORIGINAL_URL</Label>
                  <div className="p-3 bg-muted rounded-md font-mono text-sm text-foreground break-all">
                    {testResult.originalUrl}
                  </div>
                </div>

                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-background p-2 rounded-full border border-border">
                    <ArrowRight size={16} className="text-primary" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-mono">BYPASSED_RESULT</Label>
                  {testResult.success && testResult.bypassedUrl ? (
                    <div className="p-3 bg-primary/10 border border-primary/20 rounded-md font-mono text-sm text-primary break-all flex justify-between items-start gap-4">
                      <span>{testResult.bypassedUrl}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-primary hover:text-primary hover:bg-primary/20 -mt-1 -mr-1"
                        onClick={() => handleCopy(testResult.bypassedUrl!)}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md font-mono text-sm text-destructive flex items-start gap-3">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{testResult.error || "Unknown error occurred"}</span>
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
