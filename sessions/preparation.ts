import { SessionManager, type ExtensionContext, type SessionHeader } from "@earendil-works/pi-coding-agent";
import type { Workspace } from "../workspaces/types.ts";
import { localPath } from "../workspaces/utils.ts";
import { sessionBinding } from "./binding.ts";
import { SAME_PROJECT_ERROR, SESSION_BINDING } from "./constants.ts";
import { historyFingerprint } from "./history.ts";
import type { SessionBinding, SessionPrepareOptions, SessionSelection, SessionSnapshot } from "./types.ts";

const sourceBinding = (source: SessionSnapshot | undefined, recoverBinding?: boolean): SessionBinding | undefined => {
  if (!source) return undefined;

  try {
    return sessionBinding(source.entries, source.header.id);
  } catch (error) {
    if (!recoverBinding) throw error;
    return undefined;
  }
};

export const sessionSelection = (
  ctx: ExtensionContext,
  manager: SessionManager,
  savedSelection?: boolean,
): SessionSelection => {
  if (!savedSelection) {
    return {
      model: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined,
      thinkingLevel: ctx.thinkingLevel,
    };
  }

  const projection = manager.buildSessionProjection();
  return {
    model: projection.model ? { provider: projection.model.provider, id: projection.model.modelId } : undefined,
    thinkingLevel: projection.thinkingLevel as SessionSelection["thinkingLevel"],
  };
};

export const prepareConversation = (
  ctx: ExtensionContext,
  workspace: Workspace,
  header: SessionHeader,
  source: SessionSnapshot | undefined,
  options: SessionPrepareOptions,
): SessionManager => {
  const cwd = localPath(workspace);
  const manager = SessionManager.inMemory(cwd, undefined, [header, ...(source?.entries ?? [])]);
  if (source?.leafId) manager.branch(source.leafId);
  else manager.resetLeaf();

  const previous = sourceBinding(source, options.recoverBinding);
  if (previous && previous.projectId !== workspace.projectId) throw new Error(SAME_PROJECT_ERROR);

  const binding: SessionBinding = {
    version: 1,
    sessionId: header.id,
    projectId: workspace.projectId,
    workspaceId: workspace.id,
    conversationId: previous?.conversationId ?? source?.header.id ?? header.id,
    cwd,
    selection: sessionSelection(ctx, manager, options.savedSelection),
    ...(source?.path
      ? {
          predecessor: {
            sessionId: source.header.id,
            path: source.path,
            history: historyFingerprint(source.entries),
          },
        }
      : {}),
  };
  manager.appendCustomEntry(SESSION_BINDING, binding);
  return manager;
};

export const transferNotice = (source: SessionSnapshot, workspace: Workspace): string =>
  `The human transferred this conversation from ${source.header.cwd} ` +
  `to workspace ${workspace.name} at ${localPath(workspace)}. ` +
  "Use this new working directory for relative paths. " +
  "Previous absolute paths still refer to the source. " +
  "Transferring a session does not merge files.";
