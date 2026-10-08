import { resolve } from "node:path";
import { nearestParent } from "./ancestry.ts";
import type { SessionGroup, SessionRow, TreeNode, WorkspaceSession } from "./types.ts";

const joinFamilyRoots = (roots: TreeNode[], families: Map<string, SessionGroup>): void => {
  if (roots.length < 2) return;
  const family = families.get(roots[0]!.session.path)!;
  const original = [...family.sessions].sort((a, b) => a.created.getTime() - b.created.getTime())[0]!;
  const logicalId = original.binding?.conversationId ?? original.id;
  const head =
    roots.find(node => node.session.id === original.id) ??
    roots.find(node => node.session.binding?.conversationId === logicalId) ??
    [...roots].sort((a, b) => a.session.created.getTime() - b.session.created.getTime())[0]!;

  roots.forEach(root => {
    if (root === head) return;
    root.parent = head;
    head.children.push(root);
  });
};

const sortTree = (nodes: TreeNode[]): void => {
  nodes.forEach(node => {
    sortTree(node.children);
    node.latest = Math.max(node.latest, ...node.children.map(child => child.latest));
    node.current ||= node.children.some(child => child.current);
  });
  nodes.sort((a, b) => Number(b.current) - Number(a.current) || b.latest - a.latest);
};

export const sessionForest = (
  all: WorkspaceSession[],
  members: WorkspaceSession[],
  families: Map<string, SessionGroup>,
  currentId: string,
): TreeNode[] => {
  const byPath = new Map(all.map(session => [resolve(session.path), session]));
  const nodes = new Map<string, TreeNode>(
    members.map(session => [
      resolve(session.path),
      {
        session,
        children: [],
        latest: session.modified.getTime(),
        current: session.id === currentId,
      },
    ]),
  );

  nodes.forEach(node => {
    const parent = nearestParent(node, nodes, byPath, families);
    if (!parent) return;
    node.parent = parent;
    parent.children.push(node);
  });

  const roots = [...nodes.values()].filter(node => !node.parent);
  const rootsByFamily = roots.reduce((groups, node) => {
    const key = families.get(node.session.path)!.key;
    const members = groups.get(key) ?? [];
    members.push(node);
    groups.set(key, members);
    return groups;
  }, new Map<string, TreeNode[]>());

  rootsByFamily.forEach(roots => joinFamilyRoots(roots, families));
  const forest = roots.filter(node => !node.parent);
  sortTree(forest);
  return forest;
};

export const treeRows = (
  roots: TreeNode[],
  underWorkspace: boolean,
  title: (session: WorkspaceSession) => string,
): SessionRow[] => {
  const rows: SessionRow[] = [];
  const walk = (node: TreeNode, depth: number, continues: boolean[], last: boolean): void => {
    const prefix = depth
      ? continues
          .slice(1)
          .map(value => (value ? "│  " : "   "))
          .join("") + (last ? "└─ " : "├─ ")
      : "";
    rows.push({ label: title(node.session), prefix, session: node.session });
    node.children.forEach((child, index) =>
      walk(child, depth + 1, [...continues, depth > 0 && !last], index === node.children.length - 1),
    );
  };

  roots.forEach((root, index) =>
    walk(root, underWorkspace ? 1 : 0, underWorkspace ? [false] : [], index === roots.length - 1),
  );
  return rows;
};
