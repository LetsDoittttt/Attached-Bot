import { Router } from "express";
import { db, botConfigTable } from "@workspace/db";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import * as fs from "fs";
import pino from "pino";

const logger = pino({ level: "info" });
const router = Router();

router.post("/process-media", async (req, res): Promise<void> => {
  const { messageId, channelId, finalUrl, originalText } = req.body;
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
      if (!msg?.media) { await client.disconnect(); return; }
      const doc = (msg.media as any)?.document;
      const mimeType = doc?.mimeType || "video/mp4";
      logger.info({ mediaClass: (msg.media as any).className, mimeType }, "Downloading media");
      const buffer = await client.downloadMedia(msg, {}) as Buffer;
      if (!buffer || buffer.length === 0) { logger.warn("Buffer empty"); await client.disconnect(); return; }
      logger.info({ size: buffer.length }, "Downloaded");
      const ext = mimeType.startsWith("video") ? "mp4" : mimeType.startsWith("image") ? "jpg" : "mp4";
      const tmpPath = `/tmp/media_${messageId}.${ext}`;
      fs.writeFileSync(tmpPath, buffer);
      const inputPeer = await client.getInputEntity(config.destTelegramChannel);
      const urlMatch = (originalText || "").match(/https?:\/\/[^\s]+/);
      const caption = urlMatch && originalText ? originalText.replace(urlMatch[0], finalUrl) : finalUrl;
      if (mimeType.startsWith("video")) {
        const videoAttr = new Api.DocumentAttributeVideo({
          duration: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.duration || 0,
          w: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.w || 1280,
          h: doc?.attributes?.find((a: any) => a.className === "DocumentAttributeVideo")?.h || 720,
          supportsStreaming: true,
        });
        await client.sendFile(inputPeer, { file: tmpPath, caption, forceDocument: false, attributes: [videoAttr] });
      } else {
        await client.sendFile(inputPeer, { file: tmpPath, caption, forceDocument: false });
      }
      fs.unlinkSync(tmpPath);
      logger.info("Media sent successfully!");
      await client.disconnect();
    } catch (err) {
      logger.error({ err }, "process-media error");
    }
  });
});

export default router;