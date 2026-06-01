import { Router } from "express";
import { db, botConfigTable } from "@workspace/db";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import pino from "pino";

const logger = pino({ level: "info" });
const router = Router();

router.post("/process-media", async (req, res): Promise<void> => {
  const { messageId, channelId, finalUrl } = req.body;
  res.json({ status: "processing" });
  setImmediate(async () => {
  try {
    const configs = await db.select().from(botConfigTable).limit(1);
    const config = configs[0];
    const client = new TelegramClient(
      new StringSession(config.sessionString || ""),
      Number(config.telegramApiId),
      config.telegramApiHash,
      { connectionRetries: 5 }
    );
    await client.connect();
    const msgs = await client.getMessages(Number(channelId), { ids: [messageId] });
    const msg = msgs[0];
    if (msg?.media) {
      const fileSize = (msg.media as any)?.document?.size || 0;
      logger.info({ fileSize: fileSize.toString() }, "Media size");
      if (BigInt(fileSize) < BigInt(100 * 1024 * 1024)) {
        const thumb = await client.downloadMedia(msg, { thumb: -1 }) as Buffer;
          const inputPeer = await client.getInputEntity(config.destTelegramChannel);
          if (thumb) {
            await client.sendFile(inputPeer, { file: thumb, caption: finalUrl });
            logger.info("Thumbnail sent successfully");
          } else {
            const botToken = config.telegramBotToken;
            await fetch("https://api.telegram.org/bot" + botToken + "/sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: config.destTelegramChannel, text: finalUrl })
            });
            logger.info("Sent link only - no thumbnail");
          }
      } else {
        logger.warn({ fileSize: fileSize.toString() }, "File too large");
      }
    }
    await client.disconnect();
  } catch (err) {
    logger.error({ err }, "process-media error");
  }
  });
});

export default router;