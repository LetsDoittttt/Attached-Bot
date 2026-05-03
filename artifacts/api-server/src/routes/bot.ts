import { Router, type IRouter } from "express";
import { GetBotStatusResponse, StartBotResponse, StopBotResponse, TestBypassBody } from "@workspace/api-zod";
import { db, activityLogTable, botConfigTable } from "@workspace/db";
import { builtInBypass, isSupportedByBuiltIn, createAdmavenLink } from "../lib/bypass";
import { sendTelegramMessage } from "../lib/telegram";

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
 * Full pipeline test:
 * 1. Bypass (Linkvertise only) → clean URL  |  skip for non-Linkvertise links
 * 2. Wrap in AdMaven → monetised link
 * 3. Post to destination Telegram channel via bot token
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
    const hasBotToken = Boolean(config?.telegramBotToken);
    const hasDestChannel = Boolean(config?.destTelegramChannel);

    // ── STEP 1: Bypass ────────────────────────────────────────────────────────
    // • If an external bypass API is configured → always call it
    // • Else if the URL is a Linkvertise link → use built-in bypass
    // • Otherwise → skip bypass entirely (Mega, GDrive, etc. are already clean)
    let cleanUrl: string = url;
    let bypassed = false;
    let bypassError: string | null = null;

    if (hasExternalBypassApi) {
      const params = new URLSearchParams({ url });
      const headers: Record<string, string> = {};
      if (config.bypassApiKey) headers["Authorization"] = `Bearer ${config.bypassApiKey}`;

      const response = await fetch(`${config.bypassApiUrl}?${params}`, {
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errMsg = `Bypass API returned ${response.status}`;
        await db.insert(activityLogTable).values({
          originalUrl: url, bypassedUrl: null, sourceChannel: "manual-test",
          status: "failed", errorMessage: errMsg,
          postedToTelegram: false, postedToDiscord: false,
        });
        res.json({
          originalUrl: url, cleanUrl: null, finalUrl: null,
          bypassed: false, bypassError: errMsg,
          admavenWrapped: false, admavenError: null,
          postedToTelegram: false, telegramError: null,
          success: false, error: errMsg,
        });
        return;
      }

      const data = await response.json() as Record<string, unknown>;
      const extracted = (data["url"] ?? data["bypassed"] ?? data["result"]) as string | null ?? null;

      if (!extracted) {
        const errMsg = "Could not parse clean URL from bypass API response";
        res.json({
          originalUrl: url, cleanUrl: null, finalUrl: null,
          bypassed: false, bypassError: errMsg,
          admavenWrapped: false, admavenError: null,
          postedToTelegram: false, telegramError: null,
          success: false, error: errMsg,
        });
        return;
      }

      cleanUrl = extracted;
      bypassed = true;
    } else if (isSupportedByBuiltIn(url)) {
      req.log.info({ url }, "Using built-in Linkvertise bypass");
      const result = await builtInBypass(url);

      if (!result.url) {
        const errMsg = "Built-in bypass could not retrieve the link. Try again or configure a bypass API.";
        await db.insert(activityLogTable).values({
          originalUrl: url, bypassedUrl: null, sourceChannel: "manual-test",
          status: "failed", errorMessage: errMsg,
          postedToTelegram: false, postedToDiscord: false,
        });
        res.json({
          originalUrl: url, cleanUrl: null, finalUrl: null,
          bypassed: false, bypassError: errMsg,
          admavenWrapped: false, admavenError: null,
          postedToTelegram: false, telegramError: null,
          success: false, error: errMsg,
        });
        return;
      }

      cleanUrl = result.url;
      bypassed = true;
    } else {
      // Non-Linkvertise direct link (Mega, GDrive, etc.) — skip bypass
      req.log.info({ url }, "Non-Linkvertise link — skipping bypass, using URL as-is");
      bypassError = null;
    }

    // ── STEP 2: Wrap in AdMaven ──────────────────────────────────────────────
    let finalUrl = cleanUrl;
    let admavenWrapped = false;
    let admavenError: string | null = null;

    if (hasAdmavenKey) {
      req.log.info({ cleanUrl }, "Uploading to AdMaven");
      const admavenResult = await createAdmavenLink(cleanUrl, config.admavenApiKey);
      if (admavenResult.admavenUrl) {
        finalUrl = admavenResult.admavenUrl;
        admavenWrapped = true;
      } else {
        admavenError = admavenResult.error ?? "AdMaven failed";
        req.log.warn({ error: admavenError }, "AdMaven failed — using clean URL");
        finalUrl = cleanUrl;
      }
    }

    // ── STEP 3: Post to Telegram via bot token ───────────────────────────────
    let postedToTelegram = false;
    let telegramError: string | null = null;

    if (hasBotToken && hasDestChannel) {
      const template = config.postTemplate || "{bypassed}";
      const message = template.replace("{bypassed}", finalUrl);

      const tgResult = await sendTelegramMessage(
        config.telegramBotToken,
        config.destTelegramChannel,
        message
      );

      postedToTelegram = tgResult.ok;
      if (!tgResult.ok) {
        telegramError = tgResult.error;
        req.log.warn({ error: tgResult.error }, "Telegram post failed");
      }
    }

    // ── STEP 4: Log and return ───────────────────────────────────────────────
    await db.insert(activityLogTable).values({
      originalUrl: url,
      bypassedUrl: finalUrl,
      sourceChannel: "manual-test",
      status: "success",
      errorMessage: telegramError ?? admavenError,
      postedToTelegram,
      postedToDiscord: false,
    });

    res.json({
      originalUrl: url,
      cleanUrl,
      finalUrl,
      bypassed,
      bypassError,
      admavenWrapped,
      admavenError,
      postedToTelegram,
      telegramError,
      success: true,
      // backwards-compatible field used by old UI
      bypassedUrl: finalUrl,
      error: telegramError ?? admavenError ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({
      originalUrl: url, cleanUrl: null, finalUrl: null,
      bypassed: false, bypassError: message,
      admavenWrapped: false, admavenError: null,
      postedToTelegram: false, telegramError: null,
      success: false, error: message,
    });
  }
});

export default router;
