import { unlink } from "node:fs/promises";
import { SessionManager, type ExtensionAPI, type ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { textInput } from "../ui/input.ts";
import { oneLine } from "../ui/utils.ts";
import { selectedSnapshot } from "./files.ts";
import { sessionTitle } from "./grouping.ts";
import type { WorkspaceSession } from "./types.ts";

export const renameSession = async (
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  session: WorkspaceSession,
): Promise<void> => {
  const name = (await textInput(ctx, "Session name", session.name ?? ""))?.trim();
  if (!name) return;

  if (session.id === ctx.sessionManager.getSessionId()) {
    pi.setSessionName(name);
    return;
  }

  await selectedSnapshot(session);
  SessionManager.open(session.path).appendSessionInfo(name);
};

export const deleteSession = async (ctx: ExtensionCommandContext, session: WorkspaceSession): Promise<void> => {
  if (session.id === ctx.sessionManager.getSessionId()) {
    ctx.ui.notify("Switch sessions before deleting the current conversation.", "warning");
    return;
  }

  const message = `${oneLine(sessionTitle(session))}\n${oneLine(session.path)}\nWorkspace files are not deleted.`;
  if (!(await ctx.ui.confirm("Delete session permanently?", message))) return;

  await selectedSnapshot(session);
  await unlink(session.path);
};
