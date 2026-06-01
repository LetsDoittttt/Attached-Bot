import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
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
  client.addEventHandler(async (event: any) => {
    const message = event.message;
    if (message?.text == null) return;
    const urlMatch = message.text.match(/https?:\/\/[^\s]+/);
    if (urlMatch == null) return;
    const url = urlMatch[0];
    try {
      const res = await fetch("http://localhost:" + process.env.PORT + "/api/bypass/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await res.json();
      logger.info({ data }, "Pipeline result");
      if (data.success && data.finalUrl && message.media) {
        try {
          const cfg = await getConfig();
          const inputPeer = await client.getInputEntity(cfg.destTelegramChannel);
          await client.forwardMessages(inputPeer, { messages: [message.id], fromPeer: message.peerId });
        } catch (mediaErr) { logger.error({ err: mediaErr }, "Media forward error"); }
      }
    } catch (err) { logger.error({ err }, "Pipeline error"); }
  }, new NewMessage({ chats: [-1003924753309] }));
}

export async function stopUserbot() {
  if (client != null) { await client.disconnect(); client = null; }
}
