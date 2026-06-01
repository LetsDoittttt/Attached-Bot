import { Router } from "express";
import { db, botConfigTable } from "@workspace/db";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
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
        const fileSizeBytes = (msg.media as any)?.document?.size || (msg.media as any)?.photo ? 1 : 0;
        const mimeType: string = (msg.media as any)?.document?.mimeType || "image/jpeg";
        logger.info({ fileSizeBytes: fileSizeBytes?.toString(), mimeType }, "Media info");
        const sizeNum = BigInt((msg.media as any)?.document?.size || 0);
        if (sizeNum < BigInt(100 * 1024 * 1024) || (msg.media as any)?.photo) {
          const mediaBuffer = await client.downloadMedia(msg, {}) as Buffer;
          const inputPeer = await client.getInputEntity(config.destTelegramChannel);
          if (mediaBuffer && mediaBuffer.length > 0) {
            if (mimeType.startsWith("video/") || mimeType === "image/gif") {
              await client.sendFile(inputPeer, {
                file: mediaBuffer,
                caption: finalUrl,
                forceDocument: false,
                fileName: "video.mp4",
                workers: 1,
                attributes: [new Api.DocumentAttributeVideo({ duration: 0, w: 1280, h: 720, supportsStreaming: true })]
              });
              logger.info("Sent as video");
            } else if (mimeType.startsWith("image/") || (msg.media as any)?.photo) {
              await client.sendFile(inputPeer, {
                file: mediaBuffer,
                caption: finalUrl,
                forceDocument: false
              });
              logger.info("Sent as photo");
            } else {
              await client.sendFile(inputPeer, {
                file: mediaBuffer,
                caption: finalUrl,
                forceDocument: true
              });
              logger.info("Sent as document");
            }
          } else {
            await fetch("https://api.telegram.org/bot" + config.telegramBotToken + "/sendMessage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: config.destTelegramChannel, text: finalUrl })
            });
            logger.info("Sent link only - no media buffer");
          }
        } else {
          logger.warn({ size: sizeNum.toString() }, "File too large, sending link only");
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
