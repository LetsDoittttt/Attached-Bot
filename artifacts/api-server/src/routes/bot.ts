import { Router, type IRouter } from "express";
import { GetBotStatusResponse, StartBotResponse, StopBotResponse, TestBypassBody } from "@workspace/api-zod";
import { db, activityLogTable, botConfigTable } from "@workspace/db";
import { builtInBypass, isSupportedByBuiltIn, createAdmavenLink } from "../lib/bypass";

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
  res.json(StartBotResponse.parse({ running: true, startedAt: botStartedAt.toISOString(), uptime: 0 }));
});

router.post("/bot/stop", async (req, res): Promise<void> => {
  botRunning = false;
  botStartedAt = null;
  req.log.info("Bot stopped");
  res.json(StopBotResponse.parse({ running: false, startedAt: null, uptime: null }));
});

/**
 * Full pipeline:
 * 1. Bypass Linkvertise link → clean URL
 * 2. Upload clean URL to AdMaven → AdMaven link
 * 3. Return the AdMaven link for posting
 */
router.post("/bypass/test", async (req, res): Promise<void> => {
  const parsed = TestBypassBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url } = parsed.data;

  try {
    const configs = await db.select().from(botConfigTable).limit(1);
    const config = configs[0];
    const hasExternalBypassApi = Boolean(config?.bypassApiUrl);
    const hasAdmavenKey = Boolean(config?.admavenApiKey);

    // ── STEP 1: Bypass the Linkvertise link ──────────────────────────────────
    let cleanUrl: string | null = null;

    if (hasExternalBypassApi) {
      // Use configured external bypass API
      const params = new URLSearchParams({ url });
      const headers: Record<string, string> = {};
      if (config.bypassApiKey) headers["Authorization"] = `Bearer ${config.bypassApiKey}`;

      const response = await fetch(`${config.bypassApiUrl}?${params}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        await db.insert(activityLogTable).values({
          originalUrl: url, bypassedUrl: null, sourceChannel: "manual-test",
          status: "failed", errorMessage: `Bypass API returned ${response.status}`,
          postedToTelegram: false, postedToDiscord: false,
        });
        res.json({ originalUrl: url, bypassedUrl: null, success: false, error: `Bypass API returned ${response.status}` });
        return;
      }

      const data = await response.json() as Record<string, unknown>;
      cleanUrl = (data["url"] ?? data["bypassed"] ?? data["result"]) as string | null ?? null;

      if (!cleanUrl) {
        res.json({ originalUrl: url, bypassedUrl: null, success: false, error: "Could not parse clean URL from bypass API response" });
        return;
      }
    } else {
      // Use built-in bypass
      if (!isSupportedByBuiltIn(url)) {
        res.json({
          originalUrl: url, bypassedUrl: null, success: false,
          error: "No bypass API configured and this link type is not supported by the built-in bypass. The built-in bypass supports Linkvertise links.",
        });
        return;
      }

      req.log.info({ url }, "Using built-in Linkvertise bypass");
      const result = await builtInBypass(url);
      cleanUrl = result.url;

      if (!cleanUrl) {
        await db.insert(activityLogTable).values({
          originalUrl: url, bypassedUrl: null, sourceChannel: "manual-test",
          status: "failed", errorMessage: "Built-in bypass failed",
          postedToTelegram: false, postedToDiscord: false,
        });
        res.json({ originalUrl: url, bypassedUrl: null, success: false, error: "Built-in bypass could not retrieve the link. Try again or configure a bypass API." });
        return;
      }
    }

    // ── STEP 2: Upload to AdMaven ────────────────────────────────────────────
    let finalUrl = cleanUrl;

    if (hasAdmavenKey) {
      req.log.info({ cleanUrl }, "Uploading clean URL to AdMaven");
      const admavenResult = await createAdmavenLink(cleanUrl, config.admavenApiKey);

      if (admavenResult.admavenUrl) {
        finalUrl = admavenResult.admavenUrl;
        req.log.info({ admavenUrl: finalUrl }, "AdMaven link created");
      } else {
        req.log.warn({ error: admavenResult.error }, "AdMaven link creation failed — using clean URL as fallback");
        // Don't fail the whole thing, just log and use cleanUrl
      }
    }

    // ── STEP 3: Log and return ───────────────────────────────────────────────
    await db.insert(activityLogTable).values({
      originalUrl: url,
      bypassedUrl: finalUrl,
      sourceChannel: "manual-test",
      status: "success",
      errorMessage: null,
      postedToTelegram: false,
      postedToDiscord: false,
    });

    res.json({ originalUrl: url, bypassedUrl: finalUrl, success: true, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ originalUrl: url, bypassedUrl: null, success: false, error: message });
  }
});

export default router;
