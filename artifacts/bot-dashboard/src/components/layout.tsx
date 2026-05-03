import React from "react";
import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Settings, 
  List, 
  Play, 
  Square,
  TerminalSquare,
  Power
} from "lucide-react";
import { 
  useGetBotStatus, 
  getGetBotStatusQueryKey,
  useStartBot,
  useStopBot 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const { data: status } = useGetBotStatus({
    query: {
      queryKey: getGetBotStatusQueryKey(),
      refetchInterval: 5000,
    }
  });

  const startBot = useStartBot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      }
    }
  });

  const stopBot = useStopBot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBotStatusQueryKey() });
      }
    }
  });

  const navItems = [
    { href: "/", icon: Activity, label: "Dashboard" },
    { href: "/config", icon: Settings, label: "Configuration" },
    { href: "/logs", icon: List, label: "Activity Logs" },
    { href: "/test", icon: TerminalSquare, label: "Test Link" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background text-foreground">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
            <Power size={18} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight">BYPASS BOT</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${status?.running ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground font-mono">
                {status?.running ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        <nav className="p-2 space-y-1 flex-1">
          {navItems.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                    active 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon size={16} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground">UPTIME</span>
              <span className="text-foreground">
                {status?.running && status.uptime != null ? formatUptime(status.uptime) : "0s"}
              </span>
            </div>
            
            {status?.running ? (
              <Button 
                variant="destructive" 
                className="w-full font-mono text-xs h-8"
                onClick={() => stopBot.mutate()}
                disabled={stopBot.isPending}
              >
                <Square size={14} className="mr-2" />
                STOP PROCESS
              </Button>
            ) : (
              <Button 
                className="w-full font-mono text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => startBot.mutate()}
                disabled={startBot.isPending}
              >
                <Play size={14} className="mr-2" />
                START PROCESS
              </Button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
