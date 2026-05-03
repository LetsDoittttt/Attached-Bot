import React, { useEffect, useState } from "react";
import {
  useGetConfig,
  getGetConfigQueryKey,
  useUpdateConfig
} from "@workspace/api-client-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Save, CheckCircle2, Link2, Radio, Send, Megaphone, ArrowRight, Rss, ShieldCheck, Zap } from "lucide-react";

const formSchema = z.object({
  telegramBotToken: z.string(),
  bypassApiUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  bypassApiKey: z.string(),
  admavenApiKey: z.string(),
  sourceChannelsRaw: z.string().min(1, "Add at least one source channel"),
  destTelegramChannel: z.string().min(1, "Destination channel is required"),
  discordWebhookUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  postTemplate: z.string().min(1, "Post template is required"),
  telegramApiId: z.string(),
  telegramApiHash: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

export default function ConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdmavenKey, setShowAdmavenKey] = useState(false);
  const [showHash, setShowHash] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading } = useGetConfig({
    query: { queryKey: getGetConfigQueryKey() }
  });

  const updateConfig = useUpdateConfig({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetConfigQueryKey(), data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        toast({ title: "Saved", description: "Configuration updated successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save configuration.", variant: "destructive" });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      telegramBotToken: "",
      bypassApiUrl: "",
      bypassApiKey: "",
      admavenApiKey: "",
      sourceChannelsRaw: "",
      destTelegramChannel: "",
      discordWebhookUrl: "",
      postTemplate: "✅ Bypassed Link: {bypassed}",
      telegramApiId: "",
      telegramApiHash: "",
    }
  });

  useEffect(() => {
    if (config) {
      form.reset({
        telegramBotToken: config.telegramBotToken ?? "",
        bypassApiUrl: config.bypassApiUrl ?? "",
        bypassApiKey: config.bypassApiKey ?? "",
        admavenApiKey: config.admavenApiKey ?? "",
        sourceChannelsRaw: config.sourceChannels?.join("\n") ?? "",
        destTelegramChannel: config.destTelegramChannel ?? "",
        discordWebhookUrl: config.discordWebhookUrl ?? "",
        postTemplate: config.postTemplate ?? "✅ Bypassed Link: {bypassed}",
        telegramApiId: config.telegramApiId ?? "",
        telegramApiHash: config.telegramApiHash ?? "",
      });
    }
  }, [config]);

  const onSubmit = (data: FormValues) => {
    const sourceChannels = data.sourceChannelsRaw
      .split("\n")
      .map(c => c.trim())
      .filter(Boolean);

    updateConfig.mutate({
      data: {
        telegramBotToken: data.telegramBotToken,
        bypassApiUrl: data.bypassApiUrl,
        bypassApiKey: data.bypassApiKey,
        admavenApiKey: data.admavenApiKey,
        sourceChannels,
        destTelegramChannel: data.destTelegramChannel,
        discordWebhookUrl: data.discordWebhookUrl,
        postTemplate: data.postTemplate,
        telegramApiId: data.telegramApiId,
        telegramApiHash: data.telegramApiHash,
      }
    });
  };

  const watched = useWatch({ control: form.control });
  const hasSource = Boolean(watched.sourceChannelsRaw?.trim());
  const hasBypass = Boolean(watched.bypassApiUrl?.trim());
  const hasAdmaven = Boolean(watched.admavenApiKey?.trim());
  const hasBotToken = Boolean(watched.telegramBotToken?.trim());
  const hasDest = Boolean(watched.destTelegramChannel?.trim());

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  type StepStatus = "active" | "built-in" | "idle";
  const steps: { icon: React.ReactNode; label: string; sub: string; status: StepStatus }[] = [
    {
      icon: <Rss size={15} />,
      label: "Source",
      sub: hasSource ? "Channels set" : "No channels",
      status: hasSource ? "active" : "idle",
    },
    {
      icon: <ShieldCheck size={15} />,
      label: "Bypass",
      sub: hasBypass ? "Custom API" : "Built-in",
      status: hasBypass ? "active" : "built-in",
    },
    {
      icon: <Megaphone size={15} />,
      label: "AdMaven",
      sub: hasAdmaven ? "API key set" : "Not set",
      status: hasAdmaven ? "active" : "idle",
    },
    {
      icon: <Send size={15} />,
      label: "Post",
      sub: hasBotToken && hasDest ? "Bot ready" : !hasBotToken ? "No bot token" : "No channel",
      status: hasBotToken && hasDest ? "active" : "idle",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Setup</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure where to get links and where to post them</p>
      </div>

      {/* PIPELINE DIAGRAM */}
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-4">
        <p className="text-xs font-mono text-muted-foreground mb-3 uppercase tracking-widest">Pipeline</p>
        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((step, i) => (
            <React.Fragment key={step.label}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors ${
                step.status === "active"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : step.status === "built-in"
                  ? "border-yellow-500/30 bg-yellow-500/5 text-yellow-400"
                  : "border-border bg-background text-muted-foreground"
              }`}>
                <span className={step.status === "active" ? "text-primary" : step.status === "built-in" ? "text-yellow-400" : "text-muted-foreground"}>
                  {step.status === "built-in" ? <Zap size={15} /> : step.icon}
                </span>
                <div className="leading-tight">
                  <div className="font-medium text-xs">{step.label}</div>
                  <div className="text-[10px] opacity-70">{step.sub}</div>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight size={14} className="text-muted-foreground/40 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* TELEGRAM BOT */}
          <Card className={hasBotToken ? "border-primary/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-primary" />
                <CardTitle className="text-base">Telegram Bot</CardTitle>
              </div>
              <CardDescription>
                Your bot posts the AdMaven link to the destination channel. Create one at{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                  @BotFather
                </a>{" "}
                on Telegram, then <span className="text-foreground font-medium">add the bot as an admin</span> to your destination channel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="telegramBotToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bot Token</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="font-mono text-sm pr-10"
                          type={showApiKey ? "text" : "password"}
                          placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      From @BotFather — looks like <code className="bg-muted px-1 rounded">123456789:ABCdef...</code>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* BYPASS API */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-primary" />
                <CardTitle className="text-base">Bypass API</CardTitle>
                <span className="text-xs font-normal text-muted-foreground border border-border rounded px-1.5 py-0.5 ml-1">optional</span>
              </div>
              <CardDescription>
                Leave blank to use the <span className="text-foreground font-medium">built-in Linkvertise bypass</span> — no API key needed. Only fill this in if you're running your own custom bypass service.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="bypassApiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API URL</FormLabel>
                    <FormControl>
                      <Input
                        className="font-mono text-sm"
                        placeholder="https://your-bypass-site.com/api"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      The endpoint that accepts a <code className="bg-muted px-1 rounded">?url=</code> parameter and returns the bypassed link.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bypassApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API Key <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="font-mono text-sm pr-10"
                          type={showApiKey ? "text" : "password"}
                          placeholder="Leave blank if not needed"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* ADMAVEN API */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-primary" />
                <CardTitle className="text-base">AdMaven API</CardTitle>
              </div>
              <CardDescription>
                Paste your AdMaven API key here. This is separate from the bypass step — once the Linkvertise link is bypassed to a clean URL, that URL gets wrapped into your AdMaven link, and the AdMaven link is what gets posted to Telegram.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="admavenApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AdMaven API Key</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          className="font-mono text-sm pr-10"
                          type={showAdmavenKey ? "text" : "password"}
                          placeholder="Your AdMaven publisher API key"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdmavenKey(!showAdmavenKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showAdmavenKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Find your API key in the AdMaven publisher dashboard under API settings. Leave blank to post the clean bypassed URL directly instead.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* CHANNELS */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-primary" />
                <CardTitle className="text-base">Channels</CardTitle>
              </div>
              <CardDescription>
                Which channels to watch for links, and where to post the bypassed results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="sourceChannelsRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Channels <span className="text-muted-foreground font-normal">(where to get links from)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        className="font-mono text-sm min-h-[110px] resize-none"
                        placeholder={"@channel_username\nhttps://t.me/+AbCdEfGhIjKlMnOp\n-1001234567890"}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      One per line. Accepted formats:
                      <span className="block mt-1 space-y-0.5">
                        <span className="block"><code className="bg-muted px-1 rounded">@username</code> — public channel username</span>
                        <span className="block"><code className="bg-muted px-1 rounded">https://t.me/+AbCd...</code> — private invite link</span>
                        <span className="block"><code className="bg-muted px-1 rounded">-1001234567890</code> — numeric channel ID</span>
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destTelegramChannel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Post To (Telegram) <span className="text-muted-foreground font-normal">(where bypassed links are posted)</span></FormLabel>
                    <FormControl>
                      <Input
                        className="font-mono text-sm"
                        placeholder="@my_posting_channel"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="discordWebhookUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discord Webhook <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input
                        className="font-mono text-sm"
                        placeholder="https://discord.com/api/webhooks/..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* POST MESSAGE */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-primary" />
                <CardTitle className="text-base">Post Message</CardTitle>
              </div>
              <CardDescription>
                The message sent when a link is bypassed. Use <code className="bg-muted px-1 rounded text-primary text-xs">{"{bypassed}"}</code> where the link should appear.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="postTemplate"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        className="font-mono text-sm min-h-[90px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* TELEGRAM CREDENTIALS — collapsed/advanced */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2 select-none">
              <span className="text-xs border border-border rounded px-2 py-0.5 font-mono group-open:border-primary group-open:text-primary transition-colors">
                ADVANCED — Telegram API Credentials
              </span>
            </summary>
            <Card className="mt-3">
              <CardContent className="pt-5 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Get these from <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">my.telegram.org</a>. Required for the bot to connect to Telegram.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telegramApiId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API ID</FormLabel>
                        <FormControl>
                          <Input className="font-mono text-sm" placeholder="1234567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="telegramApiHash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Hash</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              className="font-mono text-sm pr-10"
                              type={showHash ? "text" : "password"}
                              placeholder="0123456789abcdef..."
                              {...field}
                            />
                            <button
                              type="button"
                              onClick={() => setShowHash(!showHash)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showHash ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </details>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={updateConfig.isPending}
              className="min-w-[140px] font-mono text-xs transition-all"
            >
              {updateConfig.isPending ? (
                "SAVING..."
              ) : saved ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={14} /> SAVED
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save size={14} /> SAVE SETTINGS
                </span>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
