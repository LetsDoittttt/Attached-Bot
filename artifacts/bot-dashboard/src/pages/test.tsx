import React, { useState } from "react";
import { useGetConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Terminal, Activity, AlertCircle, Copy, Check, Zap, Link, ShieldCheck, Megaphone, Send, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PipelineResult {
  originalUrl: string;
  cleanUrl: string | null;
  finalUrl: string | null;
  bypassed: boolean;
  bypassError: string | null;
  admavenWrapped: boolean;
  admavenError: string | null;
  postedToTelegram: boolean;
  telegramError: string | null;
  success: boolean;
  error: string | null;
}

export default function TestPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data: config } = useGetConfig();
  const hasExternalApi = Boolean(config?.bypassApiUrl);
  const hasAdmaven = Boolean(config?.admavenApiKey);
  const hasBotToken = Boolean(config?.telegramBotToken);
  const hasDestChannel = Boolean(config?.destTelegramChannel);

  const handleTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsTesting(true);
    setResult(null);
    fetch("/api/bypass/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() }),
    })
      .then(async (res) => {
        const data = await res.json() as PipelineResult;
        setResult(data);
        if (!data.success) {
          toast({ title: "Pipeline failed", description: data.error ?? "Unknown error", variant: "destructive" });
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "An error occurred.";
        toast({ title: "Request failed", description: msg, variant: "destructive" });
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
        <p className="text-muted-foreground text-sm font-mono mt-1">BYPASS → ADMAVEN → TELEGRAM</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-2 py-1 rounded-full border font-mono flex items-center gap-1.5 ${hasExternalApi ? "border-primary/40 bg-primary/10 text-primary" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"}`}>
          <ShieldCheck size={11} />
          {hasExternalApi ? "Custom bypass API" : "Built-in bypass"}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full border font-mono flex items-center gap-1.5 ${hasAdmaven ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          <Megaphone size={11} />
          {hasAdmaven ? "AdMaven active" : "AdMaven not configured"}
        </span>
        <span className={`text-xs px-2 py-1 rounded-full border font-mono flex items-center gap-1.5 ${hasBotToken && hasDestChannel ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          <Send size={11} />
          {hasBotToken && hasDestChannel ? `Post to ${config?.destTelegramChannel}` : "Telegram not configured"}
        </span>
      </div>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal size={18} className="text-primary" />
            Live Pipeline Test
          </CardTitle>
          <CardDescription>
            Paste any link — Linkvertise links will be bypassed first, all other links (Mega, GDrive, etc.) skip straight to AdMaven and Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTest} className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://mega.nz/... or https://linkvertise.com/..."
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
                <span className="flex items-center gap-2">
                  <Activity size={14} className="animate-spin" />
                  RUNNING...
                </span>
              ) : (
                "RUN PIPELINE"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <h2 className="text-sm font-mono text-muted-foreground">PIPELINE_RESULT</h2>
          <div className="space-y-2">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
              <p className="text-xs font-mono text-muted-foreground">INPUT</p>
              <p className="font-mono text-sm break-all text-foreground">{result.originalUrl}</p>
            </div>

            <div className="flex justify-center">
              <ArrowDown size={16} className="text-muted-foreground" />
            </div>

            <div className={`rounded-lg border p-4 space-y-1 ${
              result.bypassed
                ? "border-emerald-500/30 bg-emerald-500/5"
                : result.bypassError
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-muted/20"
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck size={11} />
                  STEP 1 — BYPASS
                </p>
                <Badge variant="outline" className={`text-xs font-mono ${
                  result.bypassed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : result.bypassError
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground"
                }`}>
                  {result.bypassed ? "BYPASSED" : result.bypassError ? "FAILED" : "SKIPPED"}
                </Badge>
              </div>
              {result.bypassed && result.cleanUrl && <p className="font-mono text-sm break-all text-emerald-400">{result.cleanUrl}</p>}
              {result.bypassError && (
                <p className="font-mono text-sm text-destructive flex items-start gap-2">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {result.bypassError}
                </p>
              )}
              {!result.bypassed && !result.bypassError && <p className="text-xs text-muted-foreground">Not a Linkvertise link — using URL directly.</p>}
            </div>

            <div className="flex justify-center">
              <ArrowDown size={16} className="text-muted-foreground" />
            </div>

            <div className={`rounded-lg border p-4 space-y-1 ${
              result.admavenWrapped
                ? "border-emerald-500/30 bg-emerald-500/5"
                : result.admavenError
                ? "border-yellow-500/30 bg-yellow-500/5"
                : "border-border bg-muted/20"
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                  <Megaphone size={11} />
                  STEP 2 — ADMAVEN
                </p>
                <Badge variant="outline" className={`text-xs font-mono ${
                  result.admavenWrapped
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : result.admavenError
                    ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                    : "border-border text-muted-foreground"
                }`}>
                  {result.admavenWrapped ? "WRAPPED" : result.admavenError ? "FAILED" : "SKIPPED"}
                </Badge>
              </div>
              {result.admavenWrapped && result.finalUrl && <p className="font-mono text-sm break-all text-emerald-400">{result.finalUrl}</p>}
              {result.admavenError && (
                <p className="font-mono text-sm text-yellow-400 flex items-start gap-2">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {result.admavenError}
                </p>
              )}
              {!result.admavenWrapped && !result.admavenError && <p className="text-xs text-muted-foreground">No AdMaven API key configured.</p>}
            </div>

            <div className="flex justify-center">
              <ArrowDown size={16} className="text-muted-foreground" />
            </div>

            <div className={`rounded-lg border p-4 space-y-1 ${
              result.postedToTelegram
                ? "border-emerald-500/30 bg-emerald-500/5"
                : result.telegramError
                ? "border-destructive/30 bg-destructive/5"
                : "border-border bg-muted/20"
            }`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                  <Send size={11} />
                  STEP 3 — TELEGRAM POST
                </p>
                <Badge variant="outline" className={`text-xs font-mono ${
                  result.postedToTelegram
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : result.telegramError
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground"
                }`}>
                  {result.postedToTelegram ? "POSTED" : result.telegramError ? "FAILED" : "SKIPPED"}
                </Badge>
              </div>
              {result.postedToTelegram && <p className="text-xs text-emerald-400">Message posted to {config?.destTelegramChannel ?? "channel"}.</p>}
              {result.telegramError && (
                <p className="font-mono text-sm text-destructive flex items-start gap-2">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  {result.telegramError}
                </p>
              )}
              {!result.postedToTelegram && !result.telegramError && <p className="text-xs text-muted-foreground">Bot token or destination channel not configured.</p>}
            </div>
          </div>

          {result.finalUrl && (
            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-muted-foreground mb-1 flex items-center gap-1.5">
                    <Link size={10} />
                    FINAL URL
                  </p>
                  <p className="font-mono text-sm text-primary break-all">{result.finalUrl}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-primary hover:bg-primary/20"
                  onClick={() => handleCopy(result.finalUrl!)}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
