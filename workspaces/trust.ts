import { realpath } from "node:fs/promises";
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import { loadConfig } from "../config/store.ts";
import { within } from "../shared/utils.ts";
import { verifyWorkspace } from "./identity.ts";
import { workspaceProject } from "./utils.ts";
import type { Catalog, Workspace } from "./types.ts";

export const projectTrusted = (catalog: Catalog, workspace: Workspace, decision?: boolean | null): boolean =>
  decision !== false &&
  (decision === true ||
    workspace.trusted ||
    !!catalog.workspaces.find(candidate => candidate.id === workspaceProject(catalog, workspace).rootId)?.trusted);

export const workspaceConfig = (agentDir: string, catalog: Catalog, workspace: Workspace) => {
  const project = workspaceProject(catalog, workspace);
  const decision = new ProjectTrustStore(agentDir).get(project.origin);

  return loadConfig(agentDir, project.origin, projectTrusted(catalog, workspace, decision));
};

export const hooksAllowed = (agentDir: string, catalog: Catalog, workspace: Workspace, enabled?: boolean): boolean =>
  enabled !== false &&
  workspace.trusted &&
  new ProjectTrustStore(agentDir).get(workspaceProject(catalog, workspace).origin) !== false;

export const inheritedTrust = async (agentDir: string, catalog: Catalog, cwd: string): Promise<boolean | undefined> => {
  const canonical = await realpath(cwd);
  const saved = new ProjectTrustStore(agentDir);
  if (saved.get(canonical) === false) return false;

  const workspace = catalog.workspaces.find(
    candidate =>
      candidate.parentId &&
      candidate.status !== "missing" &&
      candidate.location.kind === "local" &&
      within(canonical, candidate.location.path),
  );
  if (!workspace) return undefined;

  await verifyWorkspace(workspace);
  if (saved.get(workspaceProject(catalog, workspace).origin) === false) return false;

  return workspace.trusted ? true : undefined;
};
