import app from "./app";
import { logger } from "./lib/logger";
import { startUserbot } from "./userbot";


const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Replit always sets REPL_ID in its containers; Render never does. This blocks
// the Telegram userbot from ever starting inside Replit — even if the dev
// server gets auto-started by a workflow, a wake-up ping, or the Run button —
// so it can never run alongside Render's live instance on the same session
// and cause duplicate message processing / double-posting again.
const isReplit = Boolean(process.env["REPL_ID"]);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  if (isReplit) {
    logger.warn("Running inside Replit — userbot startup skipped to prevent duplicate Telegram sessions. Only Render should run the live bot.");
    return;
  }

  startUserbot().catch(e => logger.error({ err: e }, "Userbot failed"));
});
