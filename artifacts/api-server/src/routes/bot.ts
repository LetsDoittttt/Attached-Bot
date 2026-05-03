import { Router, type IRouter } from "express";
import { GetBotStatusResponse, StartBotResponse, StopBotResponse, TestBypassBody } from "@workspace/api-zod";
import { db, activityLogTable } from "@workspace/db";

const router: IRouter = Router();

let botRunning = false;
let botStartedAt: Date | null = null;

router.get("/bot/status", async (_req, res): Promise<void> => {
  const uptime = botRunning && botStartedAt
    ? Math.floor((Date.now() - botStartedAt.getTime()) / 1000)
    : null;

  res.json(GetBotStatusResponse.parse({
    running: botRunning,
    startedAt: botStartedAt?.toISOString() ?? null,
    uptime,
  }));
});

router.post("/bot/start", async (req, res): Promise<void> => {
  botRunning = true;
  botStartedAt = new Date();
  req.log.info("Bot started");

  res.json(StartBotResponse.parse({
    running: true,
    startedAt: botStartedAt.toISOString(),
    uptime: 0,
  }));
});

router.post("/bot/stop", async (req, res): Promise<void> => {
  botRunning = false;
  botStartedAt = null;
  req.log.info("Bot stopped");

  res.json(StopBotResponse.parse({
    running: false,
    startedAt: null,
    uptime: null,
  }));
});

router.post("/bypass/test", async (req, res): Promise<void> => {
  const parsed = TestBypassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url } = parsed.data;

  try {
    const { db: dbClient, botConfigTable: configTable } = await import("@workspace/db");
    const configs = await dbClient.select().from(configTable).limit(1);
    const config = configs[0];

    if (!config?.bypassApiUrl) {
      res.json({ originalUrl: url, bypassedUrl: null, success: false, error: "Bypass API URL not configured" });
      return;
    }

    const params = new URLSearchParams({ url });
    const headers: Record<string, string> = {};
    if (config.bypassApiKey) {
      headers["Authorization"] = `Bearer ${config.bypassApiKey}`;
    }

    const response = await fetch(`${config.bypassApiUrl}?${params}`, { headers, signal: AbortSignal.timeout(15000) });

    if (!response.ok) {
      const logEntry = {
        originalUrl: url,
        bypassedUrl: null,
        sourceChannel: "manual-test",
        status: "failed" as const,
        errorMessage: `API returned ${response.status}`,
        postedToTelegram: false,
        postedToDiscord: false,
      };
      await db.insert(activityLogTable).values(logEntry);
      res.json({ originalUrl: url, bypassedUrl: null, success: false, error: `API returned ${response.status}` });
      return;
    }

    const data = await response.json() as Record<string, unknown>;
    const bypassedUrl = (data["url"] ?? data["bypassed"] ?? data["result"]) as string | undefined;

    if (!bypassedUrl) {
      res.json({ originalUrl: url, bypassedUrl: null, success: false, error: "Could not parse bypassed URL from response" });
      return;
    }

    const logEntry = {
      originalUrl: url,
      bypassedUrl,
      sourceChannel: "manual-test",
      status: "success" as const,
      errorMessage: null,
      postedToTelegram: false,
      postedToDiscord: false,
    };
    await db.insert(activityLogTable).values(logEntry);

    res.json({ originalUrl: url, bypassedUrl, success: true, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ originalUrl: url, bypassedUrl: null, success: false, error: message });
  }
});

export default router;
