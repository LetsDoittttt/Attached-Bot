import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  originalUrl: text("original_url").notNull(),
  bypassedUrl: text("bypassed_url"),
  sourceChannel: text("source_channel").notNull(),
  status: text("status").notNull().$type<"success" | "failed" | "skipped">(),
  errorMessage: text("error_message"),
  postedToTelegram: boolean("posted_to_telegram").notNull().default(false),
  postedToDiscord: boolean("posted_to_discord").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;
