import { dirname, resolve } from "node:path";
import type { SessionGroup, TreeNode, WorkspaceSession } from "./types.ts";

const sessionScope = (session: WorkspaceSession): string => session.projectId ?? resolve(session.cwd);
const pathKey = (session: WorkspaceSession, path: string): string => `${sessionScope(session)}\0path\0${resolve(path)}`;

export const familyKeys = (sessions: WorkspaceSession[]): Map<string, string> => {
  const parents = new Map<string, string>();
  const find = (key: string): string => {
    const trail: string[] = [];
    let root = key;
    while (parents.has(root)) {
      trail.push(root);
      root = parents.get(root)!;
    }
    trail.forEach(key => parents.set(key, root));
    return root;
  };
  const join = (a: string, b: string): void => {
    const left = find(a);
    const right = find(b);
    if (left !== right) parents.set(left, right);
  };
  const byPath = new Map(sessions.map(session => [resolve(session.path), session]));

  sessions.forEach(session => {
    const key = pathKey(session, session.path);
    join(key, `${sessionScope(session)}\0conversation\0${session.binding?.conversationId ?? session.id}`);

    if (session.parentSessionPath) {
      const path = resolve(dirname(session.path), session.parentSessionPath);
      const parent = byPath.get(path);
      if (!parent || sessionScope(parent) === sessionScope(session)) join(key, pathKey(session, path));
    }

    const previous = session.binding?.predecessor;
    if (!previous) return;
    const parent = byPath.get(resolve(previous.path));
    if (!parent || (parent.id === previous.sessionId && sessionScope(parent) === sessionScope(session))) {
      join(key, pathKey(session, previous.path));
    }
  });

  return new Map(sessions.map(session => [session.path, find(pathKey(session, session.path))]));
};

const sessionParent = (
  session: WorkspaceSession,
  byPath: Map<string, WorkspaceSession>,
): WorkspaceSession | undefined => {
  const previous = session.binding?.predecessor;
  const path = previous?.path ?? session.parentSessionPath;
  if (!path) return undefined;

  const parent = byPath.get(resolve(dirname(session.path), path));
  return parent && (!previous || parent.id === previous.sessionId) ? parent : undefined;
};

export const nearestParent = (
  node: TreeNode,
  nodes: Map<string, TreeNode>,
  byPath: Map<string, WorkspaceSession>,
  families: Map<string, SessionGroup>,
): TreeNode | undefined => {
  const seen = new Set([resolve(node.session.path)]);
  const family = families.get(node.session.path)?.key;
  let parent = sessionParent(node.session, byPath);
  let nearest: TreeNode | undefined;

  while (parent) {
    const path = resolve(parent.path);
    if (seen.has(path)) return undefined;
    if (families.get(parent.path)?.key !== family) return nearest;

    seen.add(path);
    nearest ??= nodes.get(path);
    parent = sessionParent(parent, byPath);
  }
  return nearest;
};
