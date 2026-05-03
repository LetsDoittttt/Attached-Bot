import { Router, type IRouter } from "express";
import { db, activityLogTable } from "@workspace/db";
import { GetStatsResponse } from "@workspace/api-zod";
import { count, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [totalResult, successResult, failedResult, skippedResult, last24hResult, last7dResult, byChannelResult] =
    await Promise.all([
      db.select({ count: count() }).from(activityLogTable),
      db.select({ count: count() }).from(activityLogTable).where(eq(activityLogTable.status, "success")),
      db.select({ count: count() }).from(activityLogTable).where(eq(activityLogTable.status, "failed")),
      db.select({ count: count() }).from(activityLogTable).where(eq(activityLogTable.status, "skipped")),
      db.select({ count: count() }).from(activityLogTable)
        .where(sql`${activityLogTable.createdAt} > NOW() - INTERVAL '24 hours'`),
      db.select({ count: count() }).from(activityLogTable)
        .where(sql`${activityLogTable.createdAt} > NOW() - INTERVAL '7 days'`),
      db.select({ channel: activityLogTable.sourceChannel, count: count() })
        .from(activityLogTable)
        .groupBy(activityLogTable.sourceChannel)
        .orderBy(sql`count(*) DESC`)
        .limit(5),
    ]);

  const total = Number(totalResult[0]?.count ?? 0);
  const success = Number(successResult[0]?.count ?? 0);
  const failed = Number(failedResult[0]?.count ?? 0);
  const skipped = Number(skippedResult[0]?.count ?? 0);
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;

  res.json(GetStatsResponse.parse({
    totalProcessed: total,
    successCount: success,
    failedCount: failed,
    skippedCount: skipped,
    successRate,
    last24hCount: Number(last24hResult[0]?.count ?? 0),
    last7dCount: Number(last7dResult[0]?.count ?? 0),
    topSourceChannels: byChannelResult.map(r => ({ channel: r.channel, count: Number(r.count) })),
  }));
});

export default router;
