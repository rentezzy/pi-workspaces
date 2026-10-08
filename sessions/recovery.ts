import { resolve } from "node:path";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { exists } from "../shared/fs.ts";
import { menuPicker } from "../ui/menu.ts";
import { errorMessage, oneLine } from "../ui/utils.ts";
import { workspacePicker } from "../ui/workspace-picker.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { Catalog, WorkspaceView } from "../workspaces/types.ts";
import { localPath } from "../workspaces/utils.ts";
import { sessionBinding } from "./binding.ts";
import { openPreparedSession, selectedSnapshot } from "./files.ts";
import type { WorkspaceSessions } from "./service.ts";
import type { SessionSnapshot, WorkspaceSession } from "./types.ts";

const sessionProblem = async (
  sessions: WorkspaceSessions,
  session: WorkspaceSession,
  snapshot: SessionSnapshot,
): Promise<string | undefined> => {
  const validateSession = async (): Promise<string | undefined> => {
    const binding = sessionBinding(snapshot.entries, session.id);
    if (binding) await sessions.validate(binding, snapshot.header.cwd);
    else if (!(await exists(snapshot.header.cwd))) {
      throw new Error("The session's working directory no longer exists.");
    }
    return session.issue;
  };

  const { data, error } = await tryCatch(validateSession());
  return error ? errorMessage(error) : data;
};

const recoveryViews = async (
  service: WorkspaceService,
  ctx: ExtensionCommandContext,
  catalog: Catalog,
  projectId: string,
): Promise<WorkspaceView[]> => {
  const candidates = catalog.workspaces.filter(
    workspace =>
      workspace.projectId === projectId && workspace.status === "ready" && workspace.location.kind === "local",
  );

  for (const candidate of candidates) {
    const loadViews = async (): Promise<WorkspaceView[]> => {
      const cwd = localPath(candidate);
      await service.sessionWorkspace(projectId, candidate.id, cwd);
      return await service.list(cwd, ctx.signal);
    };
    const { data, error } = await tryCatch(loadViews());
    if (!error) return data;
    if (ctx.signal?.aborted) throw error;
  }
  return [];
};

const recoveryWorkspace = async (
  service: WorkspaceService,
  ctx: ExtensionCommandContext,
  session: WorkspaceSession,
): Promise<WorkspaceView | undefined> => {
  const catalog = await service.registry.read();
  const project = catalog.projects.find(project => project.id === session.projectId);
  if (!project) {
    throw new Error("This session's original project is unavailable. Use native /resume for other directories.");
  }

  const origin = catalog.workspaces.find(workspace => workspace.id === project.rootId);
  const views = await recoveryViews(service, ctx, catalog, project.id);
  if (!views.length) throw new Error("No workspace survives for this project.");

  return await workspacePicker(
    ctx,
    views.filter(workspace => workspace.status === "ready"),
    "Continue conversation in",
    views,
    origin?.id,
  );
};

export const resumeSession = async (
  ctx: ExtensionCommandContext,
  sessions: WorkspaceSessions,
  session: WorkspaceSession,
): Promise<boolean> => {
  const snapshot = await selectedSnapshot(session, "The selected session file changed; reopen the picker.");
  const problem = await sessionProblem(sessions, session, snapshot);
  if (!problem) {
    if (resolve(session.path) === resolve(ctx.sessionManager.getSessionFile()!)) return true;
    return !(await ctx.switchSession(session.path)).cancelled;
  }

  const choice = await menuPicker(ctx, `Session unavailable\n${oneLine(problem)}`, [
    "Continue in another workspace",
    "Back",
  ]);
  if (choice !== "Continue in another workspace") return false;

  const workspace = await recoveryWorkspace(sessions.service, ctx, session);
  if (!workspace) return false;
  const path = await sessions.prepare(ctx, workspace, snapshot, {
    recoverBinding: true,
    savedSelection: true,
  });
  return await openPreparedSession(ctx, path);
};
