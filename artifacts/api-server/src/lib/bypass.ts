import { logger } from "./logger";

const LINKVERTISE_PATTERNS = [
  /linkvertise\.com/i,
  /link-to\.net/i,
  /up-to-down\.net/i,
  /direct-link\.net/i,
];

const ADMAVEN_PATTERNS = [
  /admaven\.com/i,
];

export function isLinkvertise(url: string): boolean {
  return LINKVERTISE_PATTERNS.some(p => p.test(url));
}

export function isAdMaven(url: string): boolean {
  return ADMAVEN_PATTERNS.some(p => p.test(url));
}

export function isSupportedByBuiltIn(url: string): boolean {
  return isLinkvertise(url);
}

async function bypassVip(url: string): Promise<string | null> {
  try {
    const endpoint = `https://api.bypass.vip/bypass?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, url }, "bypass.vip returned non-200");
      return null;
    }

    const data = await res.json() as Record<string, unknown>;
    if (data["status"] === "success" && typeof data["result"] === "string") {
      return data["result"];
    }

    logger.warn({ data, url }, "bypass.vip unexpected response shape");
    return null;
  } catch (err) {
    logger.error({ err, url }, "bypass.vip request failed");
    return null;
  }
}

async function bypassLinkvertieDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const listIdMatch = html.match(/"listId"\s*:\s*(\d+)/);
    if (!listIdMatch) {
      logger.warn({ url }, "Could not extract listId from Linkvertise page");
      return null;
    }

    const listId = listIdMatch[1];

    const apiRes = await fetch(
      `https://publisher.linkvertise.com/api/v1/redirect/links/${listId}/target`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "https://linkvertise.com",
          "Referer": url,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        body: JSON.stringify({ captcha_token: "bypass" }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!apiRes.ok) return null;

    const data = await apiRes.json() as Record<string, unknown>;
    const target = (data as Record<string, Record<string, Record<string, string>>>)?.["data"]?.["target"]?.["url"];
    return typeof target === "string" ? target : null;
  } catch (err) {
    logger.error({ err, url }, "Direct Linkvertise bypass failed");
    return null;
  }
}

export async function createAdmavenLink(cleanUrl: string, apiKey: string): Promise<{ admavenUrl: string | null; error: string | null }> {
  const MAX_ATTEMPTS = 3;
  const endpoint = "https://publishers.ad-maven.com/api/public/content_locker";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "Mozilla/5.0",
        },
        body: JSON.stringify({
          title: "Locked Content",
          url: cleanUrl,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const isRetryable = res.status >= 500;
        if (isRetryable && attempt < MAX_ATTEMPTS) {
          const delay = attempt * 1500;
          logger.warn({ status: res.status, attempt, delay }, "AdMaven returned 5xx — retrying");
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return { admavenUrl: null, error: `AdMaven API returned ${res.status}` };
      }

      const data = await res.json() as Record<string, unknown>;
      const message = data["message"] as Record<string, unknown> | undefined;
      const lockerUrl =
        (message && typeof message["desturl"] === "string" ? message["desturl"] : null) ??
        (message && typeof message["url"] === "string" ? message["url"] : null) ??
        (typeof data["desturl"] === "string" ? data["desturl"] : null) ??
        (typeof data["shortenedUrl"] === "string" ? data["shortenedUrl"] : null) ??
        (typeof data["short_url"] === "string" ? data["short_url"] : null);

      if (!lockerUrl) {
        logger.warn({ data, cleanUrl }, "AdMaven response did not contain a locker URL");
        return { admavenUrl: null, error: "AdMaven returned an unexpected response format" };
      }

      if (attempt > 1) logger.info({ attempt }, "AdMaven succeeded after retry");
      return { admavenUrl: lockerUrl, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (attempt < MAX_ATTEMPTS) {
        const delay = attempt * 1500;
        logger.warn({ err, attempt, delay }, "AdMaven request threw — retrying");
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      logger.error({ err, cleanUrl }, "AdMaven API call failed after all retries");
      return { admavenUrl: null, error: message };
    }
  }

  return { admavenUrl: null, error: "AdMaven failed after all retries" };
}

export async function builtInBypass(url: string): Promise<{ url: string | null; method: string }> {
  if (!isSupportedByBuiltIn(url)) {
    return { url: null, method: "unsupported" };
  }

  logger.info({ url }, "Attempting built-in bypass via bypass.vip");
  const vipResult = await bypassVip(url);
  if (vipResult) {
    return { url: vipResult, method: "bypass.vip" };
  }

  logger.info({ url }, "bypass.vip failed, trying direct scrape");
  const directResult = await bypassLinkvertieDirect(url);
  if (directResult) {
    return { url: directResult, method: "direct" };
  }

  return { url: null, method: "failed" };
}
