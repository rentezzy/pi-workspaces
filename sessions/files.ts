import { open, unlink } from "node:fs/promises";
import {
  parseSessionEntries,
  SessionManager,
  type ExtensionCommandContext,
  type SessionEntry,
  type SessionHeader,
} from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { readRegular } from "../shared/fs.ts";
import { nonempty } from "../shared/validation.ts";
import { sessionIsActive, sessionSnapshot } from "./binding.ts";
import { PRIVATE_FILE_MODE } from "../shared/constants.ts";
import type { SessionSnapshot, WorkspaceSession } from "./types.ts";

export const loadSession = async (path: string): Promise<SessionSnapshot> => {
  const entries = parseSessionEntries(await readRegular(path));
  const header = entries.find((entry): entry is SessionHeader => entry.type === "session");
  if (!header || !nonempty(header.id) || !nonempty(header.cwd)) throw new Error("Invalid session file.");

  const manager = SessionManager.inMemory(header.cwd, undefined, entries);
  return { ...sessionSnapshot(manager), path };
};

export const selectedSnapshot = async (
  session: WorkspaceSession,
  message = "The selected session file changed.",
): Promise<SessionSnapshot> => {
  const snapshot = await loadSession(session.path);
  if (snapshot.header.id !== session.id) throw new Error(message);
  return snapshot;
};

export const writePreparedSession = async (
  path: string,
  header: SessionHeader,
  entries: readonly SessionEntry[],
): Promise<void> => {
  const content = [header, ...entries].map(entry => JSON.stringify(entry)).join("\n") + "\n";
  const file = await open(path, "wx", PRIVATE_FILE_MODE);
  const writeAndClose = async (): Promise<void> => {
    try {
      await file.writeFile(content);
      await file.sync();
    } finally {
      await file.close();
    }
  };

  const { error } = await tryCatch(writeAndClose());
  if (!error) return;
  await unlink(path);
  throw error;
};

export const discardInactiveSession = async (path: string): Promise<void> => {
  const snapshot = await loadSession(path);
  if (!sessionIsActive(snapshot.entries, snapshot.header.id)) await unlink(path);
};

export const openPreparedSession = async (ctx: ExtensionCommandContext, path: string): Promise<boolean> => {
  const result = await ctx.switchSession(path);
  if (!result.cancelled) return true;

  await discardInactiveSession(path);
  return false;
};
