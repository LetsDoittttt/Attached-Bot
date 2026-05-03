import React from "react";
import { 
  useGetStats, 
  getGetStatsQueryKey,
  useGetLogs,
  getGetLogsQueryKey
} from "@workspace/api-client-react";
import { Activity, CheckCircle, XCircle, SkipForward, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStats({
    query: {
      queryKey: getGetStatsQueryKey(),
      refetchInterval: 10000,
    }
  });

  const { data: logsData, isLoading: logsLoading } = useGetLogs(
    { limit: 10 },
    {
      query: {
        queryKey: getGetLogsQueryKey({ limit: 10 }),
        refetchInterval: 10000,
      }
    }
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">SYSTEM_STATS_AND_TELEMETRY</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats?.totalProcessed.toLocaleString() ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-primary mr-1">+{stats?.last24hCount.toLocaleString() ?? 0}</span>
                in last 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">
                {stats?.successRate != null ? stats.successRate.toFixed(1) : "0.0"}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.successCount.toLocaleString() ?? 0} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats?.failedCount.toLocaleString() ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Errors parsing or bypassing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Skipped</CardTitle>
              <SkipForward className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{stats?.skippedCount.toLocaleString() ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                No links found in message
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Recent Activity</h2>
          </div>
          
          <Card>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">URL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-4 w-48 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : logsData?.logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                        No activity logs found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logsData?.logs.map((log) => (
                      <TableRow key={log.id} className="group">
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{log.sourceChannel}</span>
                        </TableCell>
                        <TableCell>
                          {log.status === "success" && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-mono text-[10px]">SUCCESS</Badge>
                          )}
                          {log.status === "failed" && (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-[10px]">FAILED</Badge>
                          )}
                          {log.status === "skipped" && (
                            <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border font-mono text-[10px]">SKIPPED</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2 text-sm">
                            <span className="truncate max-w-[200px] text-muted-foreground" title={log.originalUrl}>
                              {log.originalUrl}
                            </span>
                            {log.bypassedUrl && (
                              <ArrowUpRight size={14} className="text-primary shrink-0" />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Top Sources</h2>
          </div>
          
          <Card>
            <CardContent className="p-0">
              {statsLoading ? (
                <div className="p-4 space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  ))}
                </div>
              ) : stats?.topSourceChannels.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No source data yet
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {stats?.topSourceChannels.map((source, i) => (
                    <div key={source.channel} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-6 text-center text-xs font-mono text-muted-foreground">
                          {i + 1}
                        </div>
                        <div className="font-medium text-sm">{source.channel}</div>
                      </div>
                      <div className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {source.count.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
