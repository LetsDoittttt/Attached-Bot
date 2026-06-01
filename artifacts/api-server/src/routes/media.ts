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
      if (!msg?.media) {
        logger.info("No media found");
        await client.disconnect();
        return;
      }
      logger.info({ mediaClass: (msg.media as any).className }, "Downloading media");
      const buffer = await client.downloadMedia(msg, {}) as Buffer;
      if (!buffer || buffer.length === 0) {
        logger.warn("Buffer empty");
        await client.disconnect();
        return;
      }
      logger.info({ size: buffer.length }, "Downloaded, uploading...");
      const inputPeer = await client.getInputEntity(config.destTelegramChannel);
      const attributes = (msg.media as any)?.document?.attributes || [];
      const mimeType = (msg.media as any)?.document?.mimeType || "video/mp4";
      const mediaMimeType = (msg.media as any)?.document?.mimeType || "video/mp4";
      const fileName = mediaMimeType.startsWith("video") ? "video.mp4" : mediaMimeType.startsWith("image") ? "photo.jpg" : "file";
      await client.sendFile(inputPeer, {
        file: buffer,
        caption: finalUrl,
        forceDocument: false,
        fileName,
        attributes,
      });
      logger.info("Media sent successfully!");
      await client.disconnect();
    } catch (err) {
      logger.error({ err }, "process-media error");
    }
  });
});

export default router;