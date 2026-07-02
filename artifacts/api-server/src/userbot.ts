import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { Api } from "telegram/tl";
import { db, botConfigTable, activityLogTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import pino from "pino";

const logger = pino({ level: "info" });
let client: any = null;

const queue: Array<{ messageId: number; url: string; message: any }> = [];
const processedIds = new Set<number>();
let queueRunning = false;

async function enqueue(messageId: number, url: string, message: any) {
  if (processedIds.has(messageId)) { logger.info({ messageId }, "Already processed, skipping"); return; }
  const existing = await db.select().from(activityLogTable).where(eq(activityLogTable.sourceChannel, `msg:${messageId}`)).limit(1);
  if (existing.length > 0) { logger.info({ messageId }, "Already in DB, skipping"); processedIds.add(messageId); return; }
  processedIds.add(messageId);
  queue.push({ messageId, url, message });
  logger.info({ messageId, queueLength: queue.length }, "Queued message");
  if (!queueRunning) runQueue();
}

async function runQueue() {
  if (queue.length === 0) { queueRunning = false; return; }
  queueRunning = true;
  const item = queue.shift()!;
  logger.info({ messageId: item.messageId, remaining: queue.length }, "Processing queued message");
  try { await processMessage(item.messageId, item.url, item.message); } catch (err) { logger.error({ err, messageId: item.messageId }, "Queue item failed"); }
  await new Promise(r => setTimeout(r, 1500));
  runQueue();
}

async function getLastSeenId(): Promise<number> {
  const configs = await db.select().from(botConfigTable).limit(1);
  return Number(configs[0]?.lastSeenMessageId ?? 0);
}

async function saveLastSeenId(id: number) {
  const configs = await db.select().from(botConfigTable).limit(1);
  if (configs[0]) { await db.update(botConfigTable).set({ lastSeenMessageId: id }).where(eq(botConfigTable.id, configs[0].id)); }
}

async function getConfig() {
  const configs = await db.select().from(botConfigTable).limit(1);
  return configs[0];
}

const SOURCE_CHATS = [-1003924753309];

async function processMessage(messageId: number, url: string, message: any) {
  const cfg = await getConfig();
  const res = await fetch("http://localhost:" + process.env.PORT + "/api/bypass/test", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, skipTelegram: !!message.media }),
  });
  const data = await res.json() as any;
  logger.info({ data }, "Pipeline result");
  if (!data.success || !data.finalUrl) { logger.warn({ messageId, url }, "Pipeline failed, skipping"); return; }
  const inputPeer = await client.getInputEntity(cfg.destTelegramChannel);
  if (message.media) {
    try {
      const doc = message.media?.document;
      const fileSize = BigInt(doc?.size || 0);
      if (fileSize < BigInt(100 * 1024 * 1024)) {
        const buffer = await client.downloadMedia(message, {});
        if (buffer && buffer.length > 0) {
          const tmpPath = `/tmp/media_${messageId}.mp4`;
          fs.writeFileSync(tmpPath, buffer);
          const videoAttr = new Api.DocumentAttributeVideo({
            duration: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.duration || 0,
            w: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.w || 1280,
            h: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.h || 720,
            supportsStreaming: true,
          });
          const urlMatch = message.text?.match(/https?:\/\/[^\s]+/);
          const caption = urlMatch ? (message.text || "").replace(urlMatch[0], data.finalUrl) : data.finalUrl;
          await client.sendFile(inputPeer, { file: tmpPath, caption, forceDocument: false, attributes: [videoAttr] });
          fs.unlinkSync(tmpPath);
          logger.info({ messageId }, "Media sent!");
        }
      } else {
        await fetch(`https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: cfg.destTelegramChannel, text: data.finalUrl }),
        });
      }
    } catch (mediaErr) { logger.error({ err: mediaErr }, "Media error"); }
  } else {
    await fetch(`https://api.telegram.org/bot${cfg.telegramBotToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.destTelegramChannel, text: data.finalUrl }),
    });
    logger.info({ messageId }, "Link sent");
  }
  const lastSeen = await getLastSeenId();
  if (messageId > lastSeen) await saveLastSeenId(messageId);
}

async function backfill() {
  const lastSeenId = await getLastSeenId();
  logger.info({ lastSeenId }, "Starting backfill");
  for (const chatId of SOURCE_CHATS) {
    try {
      const messages = await client.getMessages(chatId, { limit: 200, minId: lastSeenId });
      const sorted = [...messages].reverse();
      logger.info({ chatId, count: sorted.length }, "Backfill messages found");
      for (const msg of sorted) {
        if (!msg?.text) continue;
        const urlMatch = msg.text.match(/https?:\/\/[^\s]+/);
        if (!urlMatch) continue;
        await enqueue(msg.id, urlMatch[0], msg);
      }
    } catch (err) { logger.error({ err, chatId }, "Backfill error"); }
  }
}

export async function startUserbot() {
  const config = await getConfig();
  const session = new StringSession(config?.sessionString || "");
  client = new TelegramClient(session, Number(config?.telegramApiId), config?.telegramApiHash, { connectionRetries: 5 });
  if (config?.sessionString) { await client.connect(); } else {
    await client.start({ phoneNumber: async () => "", password: async () => "", phoneCode: async () => "", onError: (err: any) => logger.error({ err }, "error") });
  }
  logger.info("Userbot connected!");
  // backfill disabled — new posts only
  client.addEventHandler(async (event: any) => {
    const message = event.message;
    if (message?.text == null) return;
    const urlMatch = message.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch == null) return;
    await enqueue(message.id, urlMatch[0], message);
  }, new NewMessage({ chats: SOURCE_CHATS }));
  logger.info("Listening for new messages...");
}

export async function stopUserbot() {
  if (client != null) { await client.disconnect(); client = null; }
}
