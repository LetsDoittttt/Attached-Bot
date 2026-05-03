import { Router, type IRouter } from "express";
import { db, activityLogTable } from "@workspace/db";
import { GetLogsQueryParams, GetLogsResponse } from "@workspace/api-zod";
import { desc, eq, count, and, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/logs", async (req, res): Promise<void> => {
  const parsed = GetLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { limit = 50, offset = 0, status } = parsed.data;

  const conditions = status ? [eq(activityLogTable.status, status)] : [];

  const [logsResult, totalResult] = await Promise.all([
    db
      .select()
      .from(activityLogTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(activityLogTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(activityLogTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  res.json(GetLogsResponse.parse({
    logs: logsResult,
    total: totalResult[0]?.count ?? 0,
  }));
});

export default router;
