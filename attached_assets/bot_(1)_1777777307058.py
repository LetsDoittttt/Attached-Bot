"""
Auto-Poster Bot
Scrapes Linkvertise/AdMaven links from your own Telegram channels,
bypasses them via your API, then posts to Telegram + Discord.
"""

import asyncio
import re
import logging
import aiohttp
from telethon import TelegramClient, events
from telethon.tl.types import Message
from discord_webhook import DiscordWebhook

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
# Fill these in (or move to config.py / .env)
TELEGRAM_API_ID       = 0                        # from my.telegram.org
TELEGRAM_API_HASH     = ""                       # from my.telegram.org
TELEGRAM_SESSION      = "scraper_session"        # session file name

SOURCE_CHANNELS       = [                        # channels you own to scrape from
    "@your_source_channel_1",
    "@your_source_channel_2",
]
DEST_TELEGRAM_CHANNEL = "@your_dest_channel"     # where to post on Telegram
DISCORD_WEBHOOK_URL   = ""                       # Discord webhook URL (or leave "" to skip)

BYPASS_API_URL        = "https://your-bypass-site.com/api"   # your bypass API endpoint
BYPASS_API_KEY        = ""                       # your API key if required

# Post template — {original} and {bypassed} are replaced automatically
POST_TEMPLATE = """
🔗 New Link Posted!

✅ Bypassed Link: {bypassed}
"""

# ── Link Detection ─────────────────────────────────────────────────────────────
LINK_PATTERNS = [
    # Linkvertise
    re.compile(r"https?://linkvertise\.com/\S+", re.IGNORECASE),
    re.compile(r"https?://link-to\.net/\S+", re.IGNORECASE),
    re.compile(r"https?://up-to-down\.net/\S+", re.IGNORECASE),
    re.compile(r"https?://direct-link\.net/\S+", re.IGNORECASE),
    # AdMaven / similar ad-link networks
    re.compile(r"https?://admaven\.com/\S+", re.IGNORECASE),
    re.compile(r"https?://[a-z0-9-]+\.admaven\.com/\S+", re.IGNORECASE),
    # Generic shortlinks (optional — comment out if too broad)
    # re.compile(r"https?://bit\.ly/\S+", re.IGNORECASE),
]

def extract_links(text: str) -> list[str]:
    """Return all matching links found in a message."""
    found = []
    for pattern in LINK_PATTERNS:
        found.extend(pattern.findall(text or ""))
    return list(dict.fromkeys(found))  # deduplicate, preserve order


# ── Bypass API ─────────────────────────────────────────────────────────────────
async def bypass_link(session: aiohttp.ClientSession, url: str) -> str | None:
    """
    Call your bypass API and return the bypassed URL.
    Adjust the request params/body to match your API's spec.
    """
    try:
        params = {"url": url}
        headers = {}
        if BYPASS_API_KEY:
            headers["Authorization"] = f"Bearer {BYPASS_API_KEY}"
            # or: params["api_key"] = BYPASS_API_KEY

        async with session.get(BYPASS_API_URL, params=params, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status != 200:
                log.warning("Bypass API returned %s for %s", resp.status, url)
                return None
            data = await resp.json()

            # ── Adjust this line to match your API's response shape ──
            # Common patterns:
            #   data["url"]        data["bypassed"]      data["result"]
            bypassed = data.get("url") or data.get("bypassed") or data.get("result")
            if not bypassed:
                log.warning("Could not parse bypassed URL from response: %s", data)
            return bypassed

    except Exception as e:
        log.error("Bypass API error for %s: %s", url, e)
        return None


# ── Posting ────────────────────────────────────────────────────────────────────
async def post_to_telegram(client: TelegramClient, text: str):
    try:
        await client.send_message(DEST_TELEGRAM_CHANNEL, text, link_preview=False)
        log.info("Posted to Telegram.")
    except Exception as e:
        log.error("Telegram post error: %s", e)


def post_to_discord(text: str):
    if not DISCORD_WEBHOOK_URL:
        return
    try:
        webhook = DiscordWebhook(url=DISCORD_WEBHOOK_URL, content=text)
        response = webhook.execute()
        if response.status_code in (200, 204):
            log.info("Posted to Discord.")
        else:
            log.warning("Discord webhook returned %s", response.status_code)
    except Exception as e:
        log.error("Discord post error: %s", e)


# ── Core Handler ───────────────────────────────────────────────────────────────
async def handle_message(client: TelegramClient, http: aiohttp.ClientSession, message: Message):
    text = message.text or message.caption or ""
    links = extract_links(text)
    if not links:
        return

    log.info("Found %d link(s) in message from %s", len(links), message.chat_id)

    for original_url in links:
        log.info("Bypassing: %s", original_url)
        bypassed_url = await bypass_link(http, original_url)

        if not bypassed_url:
            log.warning("Skipping — bypass failed for: %s", original_url)
            continue

        post_text = POST_TEMPLATE.format(
            original=original_url,
            bypassed=bypassed_url,
        ).strip()

        await post_to_telegram(client, post_text)
        post_to_discord(post_text)

        await asyncio.sleep(1)  # small delay between multiple links


# ── Main ───────────────────────────────────────────────────────────────────────
async def main():
    client = TelegramClient(TELEGRAM_SESSION, TELEGRAM_API_ID, TELEGRAM_API_HASH)
    await client.start()
    log.info("Telegram client started.")

    async with aiohttp.ClientSession() as http:

        @client.on(events.NewMessage(chats=SOURCE_CHANNELS))
        async def on_new_message(event):
            await handle_message(client, http, event.message)

        log.info("Listening on: %s", SOURCE_CHANNELS)
        await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
