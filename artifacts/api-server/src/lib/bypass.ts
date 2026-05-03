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

/**
 * Built-in Linkvertise bypass using bypass.vip public API.
 * No API key required. Free service for Linkvertise/AdMaven links.
 */
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

    // bypass.vip response shape: { status: "success", result: "https://..." }
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

/**
 * Direct Linkvertise page scrape — fallback if bypass.vip is down.
 * Extracts destination URL from page metadata.
 */
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

    // Try to find the list ID from the page source
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

/**
 * Upload a clean URL to AdMaven and return the AdMaven short link.
 * AdMaven API: https://api.ad-maven.com/v1/links/create?key={key}&url={url}
 * Retries up to 3 times on 5xx / network errors with exponential backoff.
 */
export async function createAdmavenLink(cleanUrl: string, apiKey: string): Promise<{ admavenUrl: string | null; error: string | null }> {
  const MAX_ATTEMPTS = 3;
  const endpoint = `https://api.ad-maven.com/v1/links/create?key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(cleanUrl)}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
      });

      // Retry on server-side errors (5xx) — client errors (4xx) are final
      if (!res.ok) {
        const isRetryable = res.status >= 500;
        if (isRetryable && attempt < MAX_ATTEMPTS) {
          const delay = attempt * 1500; // 1.5s, 3s
          logger.warn({ status: res.status, attempt, delay }, "AdMaven returned 5xx — retrying");
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return { admavenUrl: null, error: `AdMaven API returned ${res.status}` };
      }

      const data = await res.json() as Record<string, unknown>;

      // AdMaven response shapes: { status: 1, shortenedUrl: "..." } or { data: { url: "..." } }
      const link =
        (typeof data["shortenedUrl"] === "string" ? data["shortenedUrl"] : null) ??
        (typeof data["short_url"] === "string" ? data["short_url"] : null) ??
        (typeof (data["data"] as Record<string, unknown> | undefined)?.["url"] === "string"
          ? (data["data"] as Record<string, string>)["url"]
          : null);

      if (!link) {
        logger.warn({ data, cleanUrl }, "AdMaven response did not contain a link");
        return { admavenUrl: null, error: "AdMaven returned an unexpected response format" };
      }

      if (attempt > 1) logger.info({ attempt }, "AdMaven succeeded after retry");
      return { admavenUrl: link, error: null };
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

/**
 * Main built-in bypass function. Tries bypass.vip first, then direct scrape.
 */
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
