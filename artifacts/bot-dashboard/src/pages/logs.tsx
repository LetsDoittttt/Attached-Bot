import React, { useState } from "react";
import { 
  useGetLogs, 
  getGetLogsQueryKey,
  GetLogsStatus
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle, SkipForward } from "lucide-react";

export default function LogsPage() {
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<GetLogsStatus | "all">("all");
  const limit = 20;
  
  const params = {
    limit,
    offset: page * limit,
    ...(statusFilter !== "all" && { status: statusFilter as GetLogsStatus }),
  };

  const { data, isLoading } = useGetLogs(params, {
    query: {
      queryKey: getGetLogsQueryKey(params),
      keepPreviousData: true,
    }
  });

  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground text-sm font-mono mt-1">OPERATION_HISTORY</p>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-muted/10">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={16} className="text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(val: any) => {
                setStatusFilter(val);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-[180px] font-mono text-xs">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ALL_STATUSES</SelectItem>
                <SelectItem value="success">SUCCESS</SelectItem>
                <SelectItem value="failed">FAILED</SelectItem>
                <SelectItem value="skipped">SKIPPED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-muted-foreground font-mono">
            {data ? `TOTAL: ${data.total}` : '...'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Timestamp</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[140px]">Source</TableHead>
                <TableHead>Original URL</TableHead>
                <TableHead>Bypassed URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(10)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  </TableRow>
                ))
              ) : data?.logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <List size={32} className="mb-2 opacity-20" />
                      <p>No logs match the current criteria.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data?.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      {log.status === "success" && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-mono text-[10px] w-fit flex items-center gap-1">
                          <CheckCircle2 size={10} /> SUCCESS
                        </Badge>
                      )}
                      {log.status === "failed" && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 font-mono text-[10px] w-fit flex items-center gap-1" title={log.errorMessage || "Unknown error"}>
                          <XCircle size={10} /> FAILED
                        </Badge>
                      )}
                      {log.status === "skipped" && (
                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border font-mono text-[10px] w-fit flex items-center gap-1">
                          <SkipForward size={10} /> SKIPPED
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {log.sourceChannel}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[250px] truncate text-sm font-mono text-muted-foreground" title={log.originalUrl}>
                        {log.originalUrl}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.bypassedUrl ? (
                        <div className="max-w-[250px] truncate text-sm font-mono text-primary" title={log.bypassedUrl}>
                          {log.bypassedUrl}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs font-mono">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-mono">
              PAGE {page + 1} OF {totalPages}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || isLoading}
                className="font-mono text-xs"
              >
                <ChevronLeft size={14} className="mr-1" /> PREV
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || isLoading}
                className="font-mono text-xs"
              >
                NEXT <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// Needed to avoid unused import error
import { List } from "lucide-react";