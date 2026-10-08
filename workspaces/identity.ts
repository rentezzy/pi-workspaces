import { createHash, randomUUID } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { readRegular } from "../shared/fs.ts";
import { within } from "../shared/utils.ts";
import { repository } from "../git/repository.ts";
import { WORKSPACE_MARKER } from "./constants.ts";
import { localPath } from "./utils.ts";
import type { Catalog, Workspace } from "./types.ts";

export const verifyWorkspace = async (workspace: Workspace): Promise<void> => {
  if (workspace.status === "missing") throw new Error("Workspace was deleted.");

  const path = localPath(workspace);
  if ((await realpath(path)) !== path) throw new Error("Workspace path changed or is a symlink.");
  if (!workspace.marker) return;

  const marker = join(path, WORKSPACE_MARKER);
  if (!(await lstat(marker)).isFile() || (await readRegular(marker)).trim() !== workspace.id)
    throw new Error("Workspace identity marker does not match the registry.");
};

export const resolveWorkspace = async (
  catalog: Catalog,
  cwd: string,
  reference = "here",
  trusted = false,
): Promise<Workspace> => {
  const root = await repository(cwd);
  const current = catalog.workspaces.find(workspace => localPath(workspace) === root);
  const known = catalog.workspaces.find(
    workspace =>
      workspace.id === reference ||
      (reference !== "here" && workspace.name === reference && workspace.projectId === current?.projectId),
  );

  const requested = known ? localPath(known) : reference === "here" ? root : await repository(resolve(cwd, reference));
  const workspace =
    known ?? catalog.workspaces.find(candidate => candidate.status !== "missing" && localPath(candidate) === requested);

  if (workspace) {
    await verifyWorkspace(workspace);
    if (requested === root && trusted) workspace.trusted = true;
    return workspace;
  }

  const projectId = createHash("sha256").update(requested).digest("hex").slice(0, 12);
  const project = {
    id: projectId,
    origin: requested,
    slug: basename(requested).replace(/[^a-zA-Z0-9_-]/g, "-") || "project",
    rootId: randomUUID(),
  };
  const origin: Workspace = {
    id: project.rootId,
    projectId,
    name: "main",
    location: { kind: "local", path: requested },
    createdAt: Date.now(),
    trusted: requested === root && trusted,
    status: "ready",
  };

  catalog.projects.push(project);
  catalog.workspaces.push(origin);
  return origin;
};

export const sessionWorkspace = async (
  catalog: Catalog,
  projectId: string,
  workspaceId: string,
  cwd: string,
): Promise<Workspace> => {
  const workspace = catalog.workspaces.find(
    candidate => candidate.id === workspaceId && candidate.projectId === projectId,
  );

  if (!workspace) throw new Error("The session's workspace is not registered in this profile.");

  await verifyWorkspace(workspace);
  if (!within(await realpath(cwd), localPath(workspace)))
    throw new Error("The session working directory does not match its workspace.");

  return workspace;
};
