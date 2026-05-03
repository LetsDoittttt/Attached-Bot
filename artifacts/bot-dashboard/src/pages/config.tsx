import React, { useEffect, useState } from "react";
import { 
  useGetConfig, 
  getGetConfigQueryKey,
  useUpdateConfig
} from "@workspace/api-client-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Eye, EyeOff, Save } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  telegramApiId: z.string().min(1, "Telegram API ID is required"),
  telegramApiHash: z.string().min(1, "Telegram API Hash is required"),
  sourceChannels: z.array(z.object({ value: z.string().min(1, "Channel name is required") })).min(1, "At least one source channel is required"),
  destTelegramChannel: z.string().min(1, "Destination channel is required"),
  discordWebhookUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  bypassApiUrl: z.string().url("Must be a valid URL"),
  bypassApiKey: z.string().min(1, "Bypass API Key is required"),
  postTemplate: z.string().min(1, "Post template is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function ConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showHash, setShowHash] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: config, isLoading } = useGetConfig({
    query: {
      queryKey: getGetConfigQueryKey(),
    }
  });

  const updateConfig = useUpdateConfig({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Configuration Saved",
          description: "Bot configuration has been updated successfully.",
        });
        queryClient.setQueryData(getGetConfigQueryKey(), data);
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to save configuration.",
          variant: "destructive"
        });
      }
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      telegramApiId: "",
      telegramApiHash: "",
      sourceChannels: [{ value: "" }],
      destTelegramChannel: "",
      discordWebhookUrl: "",
      bypassApiUrl: "",
      bypassApiKey: "",
      postTemplate: "",
    }
  });

  const { fields, append, remove } = useFieldArray({
    name: "sourceChannels",
    control: form.control,
  });

  useEffect(() => {
    if (config) {
      form.reset({
        telegramApiId: config.telegramApiId,
        telegramApiHash: config.telegramApiHash,
        sourceChannels: config.sourceChannels.length 
          ? config.sourceChannels.map(c => ({ value: c }))
          : [{ value: "" }],
        destTelegramChannel: config.destTelegramChannel,
        discordWebhookUrl: config.discordWebhookUrl || "",
        bypassApiUrl: config.bypassApiUrl,
        bypassApiKey: config.bypassApiKey,
        postTemplate: config.postTemplate,
      });
    }
  }, [config, form]);

  const onSubmit = (data: FormValues) => {
    updateConfig.mutate({
      data: {
        ...data,
        sourceChannels: data.sourceChannels.map(c => c.value),
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">BOT_PARAMETERS</p>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">BOT_PARAMETERS</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Telegram Credentials</CardTitle>
              <CardDescription>Authentication for the Telegram client</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            placeholder="0123456789abcdef0123456789abcdef" 
                            {...field} 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowHash(!showHash)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showHash ? <EyeOff size={16} /> : <Eye size={16} />}
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

          <Card>
            <CardHeader>
              <CardTitle>Routing</CardTitle>
              <CardDescription>Where to listen and where to post</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Source Channels</label>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <FormField
                      key={field.id}
                      control={form.control}
                      name={`sourceChannels.${index}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex gap-2 items-start">
                            <FormControl>
                              <Input className="font-mono text-sm" placeholder="@channel_name or id" {...field} />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              onClick={() => remove(index)}
                              disabled={fields.length === 1}
                              className="shrink-0"
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 text-xs font-mono"
                    onClick={() => append({ value: "" })}
                  >
                    <Plus size={14} className="mr-2" /> ADD CHANNEL
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                <FormField
                  control={form.control}
                  name="destTelegramChannel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Telegram Channel</FormLabel>
                      <FormControl>
                        <Input className="font-mono text-sm" placeholder="@my_dest_channel" {...field} />
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
                      <FormLabel>Discord Webhook (Optional)</FormLabel>
                      <FormControl>
                        <Input className="font-mono text-sm" placeholder="https://discord.com/api/webhooks/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bypass API & Formatting</CardTitle>
              <CardDescription>Configuration for the link bypass service</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bypassApiUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Endpoint URL</FormLabel>
                      <FormControl>
                        <Input className="font-mono text-sm" placeholder="https://api.bypasser.ext/v1/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bypassApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            className="font-mono text-sm pr-10" 
                            type={showApiKey ? "text" : "password"} 
                            placeholder="sk_..." 
                            {...field} 
                          />
                          <button 
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="postTemplate"
                render={({ field }) => (
                  <FormItem className="pt-2">
                    <FormLabel>Post Template</FormLabel>
                    <FormControl>
                      <Textarea 
                        className="font-mono text-sm min-h-[120px] resize-y" 
                        placeholder="Here is your link: {bypassed}"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Use <code className="bg-muted px-1 py-0.5 rounded text-primary">{"{bypassed}"}</code> to inject the final bypassed URL.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="bg-muted/20 flex justify-end p-4 border-t border-border">
              <Button 
                type="submit" 
                disabled={updateConfig.isPending}
                className="font-mono text-xs"
              >
                {updateConfig.isPending ? "SAVING..." : (
                  <>
                    <Save size={14} className="mr-2" /> SAVE CONFIGURATION
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
