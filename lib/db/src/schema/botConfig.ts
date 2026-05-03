import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botConfigTable = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  telegramApiId: text("telegram_api_id").notNull().default(""),
  telegramApiHash: text("telegram_api_hash").notNull().default(""),
  sourceChannels: text("source_channels").array().notNull().default([]),
  destTelegramChannel: text("dest_telegram_channel").notNull().default(""),
  discordWebhookUrl: text("discord_webhook_url").notNull().default(""),
  bypassApiUrl: text("bypass_api_url").notNull().default(""),
  bypassApiKey: text("bypass_api_key").notNull().default(""),
  postTemplate: text("post_template").notNull().default("🔗 New Link Posted!\n\n✅ Bypassed Link: {bypassed}"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotConfigSchema = createInsertSchema(botConfigTable).omit({ id: true, updatedAt: true });
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type BotConfig = typeof botConfigTable.$inferSelect;
