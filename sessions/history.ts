import { createHash } from "node:crypto";
import { basename, resolve, sep } from "node:path";
import type { SessionEntry, SessionInfo } from "@earendil-works/pi-coding-agent";
import type { Catalog, Workspace } from "../workspaces/types.ts";
import { localPath } from "../workspaces/utils.ts";
import { inspectSessionBinding, sessionIsActive } from "./binding.ts";
import { HISTORY_ENTRY_TYPES } from "./constants.ts";
import type { SessionBinding, SessionSnapshot, WorkspaceSession } from "./types.ts";

export const historyFingerprint = (entries: readonly SessionEntry[]): string =>
  createHash("sha256")
    .update(JSON.stringify(entries.filter(entry => HISTORY_ENTRY_TYPES.has(entry.type))))
    .digest("hex");

const inferredWorkspace = (catalog: Catalog, cwd: string): Workspace | undefined => {
  const path = resolve(cwd);
  return catalog.workspaces
    .filter(
      workspace =>
        workspace.location.kind === "local" &&
        (path === workspace.location.path || path.startsWith(workspace.location.path + sep)),
    )
    .sort(
      (a, b) =>
        Number(a.status === "missing") - Number(b.status === "missing") || localPath(b).length - localPath(a).length,
    )[0];
};

const workspaceIssue = (
  info: SessionInfo,
  workspace: Workspace | undefined,
  binding: SessionBinding | undefined,
): string | undefined => {
  if ((binding && !workspace) || workspace?.status === "missing") {
    return "The session's workspace is unavailable.";
  }

  if (
    !binding &&
    workspace?.parentId &&
    (!Number.isFinite(info.created.getTime()) || info.created.getTime() < workspace.createdAt)
  ) {
    return "This path belongs to a newer workspace; continue the old conversation explicitly.";
  }
  return undefined;
};

export const workspaceSession = (info: SessionInfo, snapshot: SessionSnapshot, catalog: Catalog): WorkspaceSession => {
  const { binding, issue } = inspectSessionBinding(snapshot.entries, info.id);
  const workspace = binding
    ? catalog.workspaces.find(workspace => workspace.id === binding.workspaceId)
    : inferredWorkspace(catalog, info.cwd);
  const projectId = binding?.projectId ?? workspace?.projectId;

  return {
    ...info,
    parentSessionPath: snapshot.header.parentSession ?? info.parentSessionPath,
    modified: new Date(Math.max(info.modified.getTime(), info.created.getTime())),
    binding,
    projectId,
    workspaceId: binding?.workspaceId ?? workspace?.id,
    workspaceName: workspace?.name ?? (binding ? "Unavailable workspace" : "Main"),
    projectName: catalog.projects.find(project => project.id === projectId)?.slug ?? basename(info.cwd),
    history: historyFingerprint(snapshot.entries),
    active: sessionIsActive(snapshot.entries, info.id),
    checkpoint: false,
    issue: issue ?? workspaceIssue(info, workspace, binding),
  };
};

export const markCheckpoints = (rows: Map<string, WorkspaceSession>): WorkspaceSession[] => {
  const checkpoints = new Set(
    [...rows.values()].flatMap(child => {
      const previous = child.binding?.predecessor;
      if (!previous || !child.active) return [];

      const parent = rows.get(resolve(previous.path));
      if (
        !parent ||
        parent.id !== previous.sessionId ||
        parent.history !== previous.history ||
        parent.projectId !== child.projectId
      )
        return [];
      return [resolve(parent.path)];
    }),
  );

  return [...rows.values()].map(session => ({
    ...session,
    checkpoint: checkpoints.has(resolve(session.path)),
  }));
};
