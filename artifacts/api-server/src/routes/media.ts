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
        const fileSizeBytes = (msg.media as any)?.document?.size || 0;
        logger.info({ fileSize: fileSizeBytes.toString() }, "Media size");
        if (BigInt(fileSizeBytes) < BigInt(100 * 1024 * 1024)) {
          const mediaBuffer = await client.downloadMedia(msg, {}) as Buffer;
          const inputPeer = await client.getInputEntity(config.destTelegramChannel);
          if (mediaBuffer && mediaBuffer.length > 0) {
            await client.sendFile(inputPeer, { file: mediaBuffer, caption: finalUrl });
            logger.info("Media sent successfully");
          } else {
            await fetch("https://api.telegram.org/bot" + config.telegramBotToken + "/sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: config.destTelegramChannel, text: finalUrl })
            });
            logger.info("Sent link only - no media buffer");
          }
        } else {
          logger.warn({ fileSize: fileSizeBytes.toString() }, "File too large, sending link only");
          await fetch("https://api.telegram.org/bot" + config.telegramBotToken + "/sendMessage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: config.destTelegramChannel, text: finalUrl })
          });
        }
      } else {
        await fetch("https://api.telegram.org/bot" + config.telegramBotToken + "/sendMessage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: config.destTelegramChannel, text: finalUrl })
        });
      }
      await client.disconnect();
    } catch (err) {
      logger.error({ err }, "process-media error");
    }
  });
});
export default router;
