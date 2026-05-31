/**
 * ============================================================
 *  PIPELINE — edit everything here
 *  1. Linkvertise bypass
 *  2. AdMaven content locker
 *  3. Telegram posting
 *  4. Bot routes (start/stop/test)
 * ============================================================
 */

import { Router, type IRouter } from "express";
import { GetBotStatusResponse, StartBotResponse, StopBotResponse, TestBypassBody } from "@workspace/api-zod";
import { db, activityLogTable, botConfigTable } from "@workspace/db";
import pino from "pino";

const logger = pino({ level: "info" });

// ── 1. LINKVERTISE BYPASS ─────────────────────────────────────────────────────

const LINKVERTISE_PATTERNS = [
  /linkvertise\.com/i,
  /link-to\.net/i,
  /up-to-down\.net/i,
  /direct-link\.net/i,
];

function isLinkvertise(url: string): boolean {
  return LINKVERTISE_PATTERNS.some(p => p.test(url));
}

async function bypassVip(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    return data["status"] === "success" && typeof data["result"] === "string" ? data["result"] : null;
  } catch {
    return null;
  }
}

async function bypassLinkvertieDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/"listId"\s*:\s*(\d+)/);
    if (!match) return null;
    const apiRes = await fetch(`https://publisher.linkvertise.com/api/v1/redirect/links/${match[1]}/target`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://linkvertise.com", "Referer": url },
      body: JSON.stringify({ captcha_token: "bypass" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!apiRes.ok) return null;
    const data = await apiRes.json() as Record<string, Record<string, Record<string, string>>>;
    return data?.["data"]?.["target"]?.["url"] ?? null;
  } catch {
    return null;
  }
}

async function runBypass(url: string): Promise<string | null> {
  const vip = await bypassVip(url);
  if (vip) return vip;
  return bypassLinkvertieDirect(url);
}

// ── 2. ADMAVEN CONTENT LOCKER ─────────────────────────────────────────────────
// Docs: POST https://publishers.ad-maven.com/api/public/content_locker
// Auth: Bearer token in Authorization header
// Body: { title, url }
// Response: { message: { desturl } }

async function createAdmavenLink(cleanUrl: string, apiKey: string): Promise<{ admavenUrl: string | null; error: string | null }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("https://publishers.ad-maven.com/api/public/content_locker", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ title: "Locked Content", url: cleanUrl }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        if (res.status >= 500 && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 1500));
          continue;
        }
        return { admavenUrl: null, error: `AdMaven API returned ${res.status}` };
      }

      const data = await res.json() as Record<string, unknown>;
      logger.info({ data }, "AdMaven raw response");

      // Try every known field name across response shapes
      const msg = data["message"] as Record<string, unknown> | undefined;
      const url =
        (msg && typeof msg["desturl"] === "string" ? msg["desturl"] : null) ??
        (msg && typeof msg["url"] === "string" ? msg["url"] : null) ??
        (msg && typeof msg["short"] === "string" ? msg["short"] : null) ??
        (msg && typeof msg["link"] === "string" ? msg["link"] : null) ??
        (typeof data["desturl"] === "string" ? data["desturl"] : null) ??
        (typeof data["url"] === "string" ? data["url"] : null) ??
        (typeof data["shortenedUrl"] === "string" ? data["shortenedUrl"] : null) ??
        (typeof data["short_url"] === "string" ? data["short_url"] : null) ??
        (typeof data["link"] === "string" ? data["link"] : null);

      if (!url) {
        return { admavenUrl: null, error: `AdMaven unexpected format: ${JSON.stringify(data)}` };
      }

      return { admavenUrl: url, error: null };
    } catch (err) {
      if (attempt < 3) { await new Promise(r => setTimeout(r, attempt * 1500)); continue; }
      return { admavenUrl: null, error: err instanceof Error ? err.message : "Unknown error" };
    }
  }
  return { admavenUrl: null, error: "AdMaven failed after all retries" };
}

// ── 3. TELEGRAM POSTING ───────────────────────────────────────────────────────

async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok || data["ok"] !== true) {
      const description = typeof data["description"] === "string" ? data["description"] : `HTTP ${res.status}`;
      if (description.toLowerCase().includes("chat not found")) {
        return { ok: false, error: `Chat not found — use @username or numeric ID (e.g. -1001234567890) for: ${chatId}` };
      }
      return { ok: false, error: description };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function verifyBotToken(botToken: string): Promise<{ valid: boolean; username: string | null; error: string | null }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, { signal: AbortSignal.timeout(8000) });
    const data = await res.json() as Record<string, unknown>;
    if (data["ok"] === true) {
      const result = data["result"] as Record<string, unknown>;
      return { valid: true, username: typeof result["username"] === "string" ? result["username"] : null, error: null };
    }
    return { valid: false, username: null, error: typeof data["description"] === "string" ? data["description"] : "Invalid token" };
  } catch (err) {
    return { valid: false, username: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── 4. BOT ROUTES ─────────────────────────────────────────────────────────────

const router: IRouter = Router();

let botRunning = false;
let botStartedAt: Date | null = null;

router.get("/bot/status", async (_req, res): Promise<void> => {
  const uptime = botRunning && botStartedAt ? Math.floor((Date.now() - botStartedAt.getTime()) / 1000) : null;
  res.json(GetBotStatusResponse.parse({ running: botRunning, startedAt: botStartedAt?.toISOString() ?? null, uptime }));
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

router.post("/bypass/test", async (req, res): Promise<void> => {
  const parsed = TestBypassBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { url } = parsed.data;

  try {
    const configs = await db.select().from(botConfigTable).limit(1);
    const config = configs[0];
    const hasExternalBypassApi = Boolean(config?.bypassApiUrl);
    const hasAdmavenKey = Boolean(config?.admavenApiKey);
    const hasBotToken = Boolean(config?.telegramBotToken);
    const hasDestChannel = Boolean(config?.destTelegramChannel);

    // Step 1: Bypass
    let cleanUrl = url;
    let bypassed = false;
    let bypassError: string | null = null;

    if (hasExternalBypassApi) {
      const response = await fetch(`${config.bypassApiUrl}?${new URLSearchParams({ url })}`, {
        headers: config.bypassApiKey ? { "Authorization": `Bearer ${config.bypassApiKey}` } : {},
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const errMsg = `Bypass API returned ${response.status}`;
        await db.insert(activityLogTable).values({ originalUrl: url, bypassedUrl: null, sourceChannel: "manual-test", status: "failed", errorMessage: errMsg, postedToTelegram: false, postedToDiscord: false });
        res.json({ originalUrl: url, cleanUrl: null, finalUrl: null, bypassed: false, bypassError: errMsg, admavenWrapped: false, admavenError: null, postedToTelegram: false, telegramError: null, success: false, error: errMsg });
        return;
      }
      const data = await response.json() as Record<string, unknown>;
      const extracted = (data["url"] ?? data["bypassed"] ?? data["result"]) as string | null ?? null;
      if (!extracted) {
        res.json({ originalUrl: url, cleanUrl: null, finalUrl: null, bypassed: false, bypassError: "Could not parse bypass API response", admavenWrapped: false, admavenError: null, postedToTelegram: false, telegramError: null, success: false, error: "Could not parse bypass API response" });
        return;
      }
      cleanUrl = extracted; bypassed = true;
    } else if (isLinkvertise(url)) {
      const result = await runBypass(url);
      if (!result) {
        const errMsg = "Built-in bypass could not retrieve the link.";
        await db.insert(activityLogTable).values({ originalUrl: url, bypassedUrl: null, sourceChannel: "manual-test", status: "failed", errorMessage: errMsg, postedToTelegram: false, postedToDiscord: false });
        res.json({ originalUrl: url, cleanUrl: null, finalUrl: null, bypassed: false, bypassError: errMsg, admavenWrapped: false, admavenError: null, postedToTelegram: false, telegramError: null, success: false, error: errMsg });
        return;
      }
      cleanUrl = result; bypassed = true;
    }

    // Step 2: AdMaven
    let finalUrl = cleanUrl;
    let admavenWrapped = false;
    let admavenError: string | null = null;

    if (hasAdmavenKey) {
      const admavenResult = await createAdmavenLink(cleanUrl, config.admavenApiKey);
      if (admavenResult.admavenUrl) {
        finalUrl = admavenResult.admavenUrl; admavenWrapped = true;
      } else {
        admavenError = admavenResult.error ?? "AdMaven failed";
        req.log.warn({ error: admavenError }, "AdMaven failed — using clean URL");
      }
    }

    // Step 3: Telegram
    let postedToTelegram = false;
    let telegramError: string | null = null;

    if (hasBotToken && hasDestChannel) {
      const template = config.postTemplate || "{bypassed}";
      const tgResult = await sendTelegramMessage(config.telegramBotToken, config.destTelegramChannel, template.replace("{bypassed}", finalUrl));
      postedToTelegram = tgResult.ok;
      if (!tgResult.ok) telegramError = tgResult.error;
    }

    await db.insert(activityLogTable).values({ originalUrl: url, bypassedUrl: finalUrl, sourceChannel: "manual-test", status: "success", errorMessage: telegramError ?? admavenError, postedToTelegram, postedToDiscord: false });
    res.json({ originalUrl: url, cleanUrl, finalUrl, bypassed, bypassError, admavenWrapped, admavenError, postedToTelegram, telegramError, success: true, bypassedUrl: finalUrl, error: telegramError ?? admavenError ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({ originalUrl: url, cleanUrl: null, finalUrl: null, bypassed: false, bypassError: message, admavenWrapped: false, admavenError: null, postedToTelegram: false, telegramError: null, success: false, error: message });
  }
});

export default router;
