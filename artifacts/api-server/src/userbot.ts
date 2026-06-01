import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { Api } from "telegram/tl";
import { db, botConfigTable } from "@workspace/db";
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
    await client.connect();
  } else {
    await client.start({ phoneNumber: async () => "", password: async () => "", phoneCode: async () => "", onError: (err: any) => logger.error({ err }, "error") });
  }
  logger.info("Userbot connected!");

  const sourceChannels = config?.sourceChannels
    ? Array.isArray(config.sourceChannels) ? config.sourceChannels : config.sourceChannels.split("\n").map((c: string) => c.trim()).filter(Boolean)
    : [];

  client.addEventHandler(async (event: any) => {
    const message = event.message;
    if (message?.text == null) return;
    const urlMatch = message.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch == null) return;
    const url = urlMatch[0];
    try {
      const res = await fetch("http://localhost:" + process.env.PORT + "/api/bypass/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      logger.info({ data }, "Pipeline result");
      if (data.success && data.finalUrl) {
        try {
          const cfg = await getConfig();
          const inputPeer = await client.getInputEntity(cfg.destTelegramChannel);
          if (message.media) {
            const mimeType: string = message.media?.document?.mimeType || "image/jpeg";
            const fileSize = message.media?.document?.size || 0;
            if (BigInt(fileSize) < BigInt(100 * 1024 * 1024) || message.media?.photo) {
              const buffer = await client.downloadMedia(message, { workers: 4 });
              if (buffer) {
                if (mimeType.startsWith("video/") || mimeType === "image/gif") {
                  await client.sendFile(inputPeer, {
                    file: buffer,
                    caption: data.finalUrl,
                    forceDocument: false,
                    attributes: [new Api.DocumentAttributeVideo({ duration: 0, w: 0, h: 0, supportsStreaming: true })]
                  });
                  logger.info("Forwarded as video");
                } else if (mimeType.startsWith("image/") || message.media?.photo) {
                  await client.sendFile(inputPeer, {
                    file: buffer,
                    caption: data.finalUrl,
                    forceDocument: false
                  });
                  logger.info("Forwarded as photo");
                } else {
                  await client.sendFile(inputPeer, {
                    file: buffer,
                    caption: data.finalUrl,
                    forceDocument: true
                  });
                  logger.info("Forwarded as document");
                }
              }
            } else {
              logger.warn({ fileSize }, "File too large, sending link only");
              await fetch("https://api.telegram.org/bot" + cfg.telegramBotToken + "/sendMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: cfg.destTelegramChannel, text: data.finalUrl })
              });
            }
          } else {
            await fetch("https://api.telegram.org/bot" + cfg.telegramBotToken + "/sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: cfg.destTelegramChannel, text: data.finalUrl })
            });
            logger.info("No media, sent link only");
          }
        } catch (mediaErr) { logger.error({ err: mediaErr }, "Media forward error"); }
      }
    } catch (err) { logger.error({ err }, "Pipeline error"); }
  }, new NewMessage({ chats: [-1003924753309] }));
}

export async function stopUserbot() {
  if (client != null) { await client.disconnect(); client = null; }
}
