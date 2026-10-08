import { resolve } from "node:path";
import { familyKeys } from "./ancestry.ts";
import { sessionForest, treeRows } from "./tree.ts";
import type { SessionFilter, SessionGroup, SessionGrouping, SessionRow, WorkspaceSession } from "./types.ts";

export const sessionTitle = (session: WorkspaceSession): string =>
  session.name || (session.firstMessage === "(no messages)" ? "New session" : session.firstMessage);

export const sessionFamilies = (sessions: WorkspaceSession[]): Map<string, SessionGroup> => {
  const keys = familyKeys(sessions);
  const groups = new Map<string, SessionGroup>();
  sessions.forEach(session => {
    const key = keys.get(session.path)!;
    const group: SessionGroup = groups.get(key) ?? { key, label: "", sessions: [] };
    group.sessions.push(session);
    groups.set(key, group);
  });

  const bySession = new Map<string, SessionGroup>();
  groups.forEach(group => {
    const oldest = [...group.sessions].sort((a, b) => a.created.getTime() - b.created.getTime())[0]!;
    group.label = sessionTitle(oldest);
    group.sessions.forEach(session => bySession.set(session.path, group));
  });
  return bySession;
};

export const visibleSessions = (
  sessions: WorkspaceSession[],
  projectId: string | undefined,
  state: SessionFilter,
  currentId: string,
): WorkspaceSession[] => {
  const words = state.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const families = words.length ? sessionFamilies(sessions) : undefined;

  return sessions.filter(session => {
    if (state.projectOnly && projectId && session.projectId !== projectId) return false;
    if (!state.history && session.checkpoint && session.id !== currentId) return false;

    const values = [
      sessionTitle(session),
      families?.get(session.path)?.label ?? "",
      session.workspaceName,
      session.projectName,
      session.cwd,
      session.id,
    ];
    return words.every(word => values.some(value => value.toLowerCase().includes(word)));
  });
};

export const sessionRows = (
  sessions: WorkspaceSession[],
  visible: WorkspaceSession[],
  grouping: SessionGrouping,
  projectOnly: boolean,
  currentId: string,
): SessionRow[] => {
  const families = sessionFamilies(sessions);
  if (grouping !== "workspace") {
    return treeRows(sessionForest(sessions, visible, families, currentId), false, sessionTitle);
  }

  const workspaces = new Map<string, SessionGroup>();
  [...visible]
    .sort((a, b) => b.modified.getTime() - a.modified.getTime())
    .forEach(session => {
      const key = `${session.projectId ?? session.projectName}\0${session.workspaceId ?? resolve(session.cwd)}`;
      const label =
        !projectOnly && session.projectName ? `${session.projectName}/${session.workspaceName}` : session.workspaceName;
      const group: SessionGroup = workspaces.get(key) ?? { key, label, sessions: [] };
      group.sessions.push(session);
      workspaces.set(key, group);
    });

  const isCurrent = (group: SessionGroup): boolean => group.sessions.some(session => session.id === currentId);
  return [...workspaces.values()]
    .sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)))
    .flatMap(group => [
      { label: group.label, prefix: "", current: isCurrent(group) },
      ...treeRows(sessionForest(sessions, group.sessions, families, currentId), true, sessionTitle),
    ]);
};
