import { randomInt } from "node:crypto";
import { WORKSPACE_ADJECTIVES, WORKSPACE_NOUNS } from "./constants.ts";
import type { Catalog, Project, Workspace } from "./types.ts";

export const localPath = (workspace: Workspace): string => {
  if (workspace.location.kind !== "local") throw new Error("Remote workspace transport is not implemented yet.");

  return workspace.location.path;
};

export const workspaceName = (taken: Iterable<string>): string => {
  const occupied = new Set(Array.from(taken, name => name.toLowerCase()));
  const available = WORKSPACE_ADJECTIVES.flatMap(adjective =>
    WORKSPACE_NOUNS.map(noun => `${adjective}-${noun}`),
  ).filter(name => !occupied.has(name));

  if (!available.length) throw new Error("All generated workspace names are taken; supply a name explicitly.");

  return available[randomInt(available.length)]!;
};

export const workspaceProject = (catalog: Catalog, workspace: Workspace): Project =>
  catalog.projects.find(project => project.id === workspace.projectId)!;

export const emptyCatalog = (): Catalog => ({
  version: 1,
  projects: [],
  workspaces: [],
  receipts: [],
  operations: [],
});
