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
        const buffer = await client.downloadMedia(msg, { workers: 4 }) as Buffer;
        if (buffer) {
          const inputPeer = await client.getInputEntity(config.destTelegramChannel);
          await client.sendFile(inputPeer, { file: buffer, caption: finalUrl });
          logger.info("Media sent successfully");
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

export default router;