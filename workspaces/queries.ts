import { tryCatch } from "../shared/errors.ts";
import { git } from "../git/command.ts";
import { resolveWorkspace, verifyWorkspace } from "./identity.ts";
import { localPath } from "./utils.ts";
import type { Catalog, Workspace, WorkspaceView } from "./types.ts";

const workspaceView = async (catalog: Catalog, workspace: Workspace, signal?: AbortSignal): Promise<WorkspaceView> => {
  await verifyWorkspace(workspace);

  const path = localPath(workspace);
  const branch = await git(path, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true });
  const dirty = !!(await git(path, ["status", "--porcelain", "--untracked-files=normal"], { signal }));
  const operation = catalog.operations.findLast(
    operation =>
      (operation.targetId === workspace.id || operation.sourceId === workspace.id) &&
      operation.state !== "complete" &&
      operation.state !== "failed",
  );
  const error = operation
    ? `${operation.state === "branch-conflict" ? "Private branch conflict" : operation.state}: ${operation.id} at ${operation.path}`
    : undefined;

  return { ...workspace, branch: branch || null, dirty, error };
};

export const listWorkspaces = async (catalog: Catalog, cwd: string, signal?: AbortSignal): Promise<WorkspaceView[]> => {
  const current = await resolveWorkspace(catalog, cwd);
  const workspaces = catalog.workspaces.filter(
    workspace => workspace.projectId === current.projectId && workspace.status !== "missing",
  );

  return await Promise.all(
    workspaces.map(async workspace => {
      const { data, error } = await tryCatch(workspaceView(catalog, workspace, signal));
      return error ? { ...workspace, status: "missing" as const, error: String(error) } : data;
    }),
  );
};

export const workspaceBranches = async (
  catalog: Catalog,
  cwd: string,
  from?: string,
  signal?: AbortSignal,
): Promise<string[]> => {
  const workspace = await resolveWorkspace(catalog, cwd, from);
  const refs = await git(
    localPath(workspace),
    ["for-each-ref", "--format=%(refname:short)%00%(symref)", "refs/heads", "refs/remotes"],
    { signal },
  );

  return refs
    .split("\n")
    .flatMap(line => {
      const [name, symbolic] = line.split("\0");
      return name && !symbolic ? [name] : [];
    })
    .sort();
};
