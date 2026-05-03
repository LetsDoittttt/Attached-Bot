import { Router, type IRouter } from "express";
import { db, botConfigTable } from "@workspace/db";
import { GetConfigResponse, UpdateConfigBody, UpdateConfigResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

async function getOrCreateConfig() {
  const existing = await db.select().from(botConfigTable).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(botConfigTable).values({}).returning();
  return created;
}

router.get("/config", async (_req, res): Promise<void> => {
  const config = await getOrCreateConfig();
  res.json(GetConfigResponse.parse(config));
});

router.put("/config", async (req, res): Promise<void> => {
  const parsed = UpdateConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const config = await getOrCreateConfig();

  const [updated] = await db
    .update(botConfigTable)
    .set(parsed.data)
    .where(sql`${botConfigTable.id} = ${config.id}`)
    .returning();

  res.json(UpdateConfigResponse.parse(updated));
});

export default router;
