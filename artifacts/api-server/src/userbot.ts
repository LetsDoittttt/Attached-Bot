import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { Api } from "telegram/tl";
import { db, botConfigTable } from "@workspace/db";
import * as fs from "fs";
import pino from "pino";

const logger = pino({ level: "info" });
let client: any = null;

async function getConfig() {
  const configs = await db.select().from(botConfigTable).limit(1);
  return configs[0];
}

export async function startUserbot() {
  const config = await getConfig();
  const session = new StringSession(config?.sessionString || "");
  client = new TelegramClient(session, Number(config?.telegramApiId), config?.telegramApiHash, { connectionRetries: 5 });
  if (config?.sessionString) {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Telegram connect timeout after 15s")), 15000))
    ]);
  } else {
    await client.start({ phoneNumber: async () => "", password: async () => "", phoneCode: async () => "", onError: (err: any) => logger.error({ err }, "error") });
  }

  client.addEventHandler(async (event: any) => {
    const message = event.message;
    if (message?.text == null) return;
    const urlMatch = message.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch == null) return;
    const url = urlMatch[0];
    try {
      const cfg = await getConfig();
      const res = await fetch("http://localhost:" + process.env.PORT + "/api/bypass/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, skipTelegram: !!message.media }),
      });
      const data = await res.json();
      logger.info({ data }, "Pipeline result");
      if (data.success && data.finalUrl) {
        const inputPeer = await client.getInputEntity(cfg.destTelegramChannel);
        if (message.media) {
          try {
            const doc = message.media?.document;
            const fileSize = BigInt(doc?.size || 0);
            if (fileSize < BigInt(100 * 1024 * 1024)) {
              const buffer = await client.downloadMedia(message, {});
              if (buffer && buffer.length > 0) {
                const tmpPath = `/tmp/media_${message.id}.mp4`;
                fs.writeFileSync(tmpPath, buffer);
                const videoAttr = new Api.DocumentAttributeVideo({
                  duration: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.duration || 0,
                  w: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.w || 1280,
                  h: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.h || 720,
                  supportsStreaming: true,
                });
                const caption = message.text.replace(urlMatch[0], data.finalUrl);
                await client.sendFile(inputPeer, {
                  file: tmpPath,
                  caption,
                  forceDocument: false,
                  attributes: [videoAttr],
                });
                fs.unlinkSync(tmpPath);
              }
            } else {
              logger.warn({ fileSize: fileSize.toString() }, "File too large, sending link only");
              await fetch("https://api.telegram.org/bot" + cfg.telegramBotToken + "/sendMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: cfg.destTelegramChannel, text: data.finalUrl })
              });
            }
          } catch (mediaErr) { logger.error({ err: mediaErr }, "Media error"); }
        } else {
          await fetch("https://api.telegram.org/bot" + cfg.telegramBotToken + "/sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: cfg.destTelegramChannel, text: data.finalUrl })
          });
          logger.info("Link sent");
        }
      }
    } catch (err) { logger.error({ err }, "Pipeline error"); }
  }, new NewMessage({ chats: [-1003924753309] }));
  // backfill disabled
  const msgs = await client.getMessages(-1003924753309, { limit: 5 });
  for (const msg of [...msgs].reverse()) {
    const u = msg.text.match(/https?:\/\/[^\s]+/);
    try {
      const r = await fetch("http://localhost:" + process.env.PORT + "/api/bypass/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u[0], skipTelegram: false }),
      });
      const d = await r.json();
      logger.info({ d }, "Backfill result");
    } catch(e) { logger.error({ err: e }, "Backfill error"); }
  }
  logger.info("Userbot connected and listening");
}

export async function stopUserbot() {
  if (client != null) { await client.disconnect(); client = null; }
}
