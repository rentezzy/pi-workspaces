import { realpath } from "node:fs/promises";
import { SessionManager, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { Workspace } from "../workspaces/types.ts";
import { localPath } from "../workspaces/utils.ts";
import { sessionBinding, sessionIsActive } from "./binding.ts";
import { PERSISTENT_SESSION_ERROR, SESSION_ACTIVE, SESSION_BINDING, SESSION_TRANSITION } from "./constants.ts";
import { discoverSessions } from "./discovery.ts";
import { rememberDirectory, sessionDirectory } from "./directories.ts";
import { loadSession, writePreparedSession } from "./files.ts";
import { prepareConversation, transferNotice } from "./preparation.ts";
import {
  SessionIdentityError,
  type SessionBinding,
  type SessionPrepareOptions,
  type SessionSnapshot,
  type WorkspaceSession,
} from "./types.ts";

export class WorkspaceSessions {
  constructor(readonly service: WorkspaceService) {}

  rememberDirectory = (directory: string): Promise<void> => rememberDirectory(this.service, directory);

  private currentBinding = async (ctx: ExtensionContext, id: string): Promise<SessionBinding> => {
    const current = await this.service.current(ctx.cwd, ctx.isProjectTrusted(), ctx.signal);
    const created = Date.parse(ctx.sessionManager.getHeader()?.timestamp ?? "");
    if (current.workspace.parentId && (!Number.isFinite(created) || created < current.workspace.createdAt)) {
      throw new SessionIdentityError(
        "This session predates the workspace at this path; use /res to continue it explicitly.",
      );
    }

    return {
      version: 1,
      sessionId: id,
      projectId: current.project.id,
      workspaceId: current.workspace.id,
      conversationId: id,
      cwd: await realpath(ctx.cwd),
    };
  };

  observe = async (ctx: ExtensionContext, append: (type: string, data: unknown) => void): Promise<void> => {
    const entries = ctx.sessionManager.getEntries();
    const id = ctx.sessionManager.getSessionId();
    const binding = sessionBinding(entries, id);
    if (binding) await this.validate(binding, ctx.cwd);
    else append(SESSION_BINDING, await this.currentBinding(ctx, id));

    if (!sessionIsActive(entries, id)) append(SESSION_ACTIVE, { sessionId: id });
    await this.rememberDirectory(ctx.sessionManager.getSessionDir());
  };

  validate = async (binding: SessionBinding, cwd: string): Promise<Workspace> => {
    if ((await realpath(cwd)) !== binding.cwd) {
      throw new Error("The session's working directory changed; transfer it explicitly instead of rebinding it.");
    }
    return await this.service.sessionWorkspace(binding.projectId, binding.workspaceId, cwd);
  };

  load = loadSession;

  prepare = async (
    ctx: ExtensionContext,
    workspace: Workspace,
    source?: SessionSnapshot,
    options: SessionPrepareOptions = {},
  ): Promise<string> => {
    const cwd = localPath(workspace);
    await this.service.sessionWorkspace(workspace.projectId, workspace.id, cwd);
    if (!ctx.sessionManager.getSessionFile()) throw new Error(PERSISTENT_SESSION_ERROR);

    const directory = sessionDirectory(this.service.agentDir, ctx, cwd);
    await this.rememberDirectory(directory);
    const destination = SessionManager.create(cwd, directory);
    const path = destination.getSessionFile()!;
    const header = {
      ...destination.getHeader()!,
      ...(source?.path ? { parentSession: source.path } : {}),
    };
    const manager = prepareConversation(ctx, workspace, header, source, options);

    if (source && (await this.service.sessionConfig(workspace)).transferNotice) {
      manager.appendCustomMessageEntry(SESSION_TRANSITION, transferNotice(source, workspace), false);
    }
    await writePreparedSession(path, header, manager.getEntries());
    return path;
  };

  list = (ctx: ExtensionContext): Promise<WorkspaceSession[]> => discoverSessions(this.service, ctx);
}
