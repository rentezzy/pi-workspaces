import { realpath, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tryCatch } from "../shared/errors.ts";
import { readRegular, isError } from "../shared/fs.ts";
import { within } from "../shared/utils.ts";
import { runHooks } from "../config/hooks.ts";
import { git } from "../git/command.ts";
import { repository } from "../git/repository.ts";
import { resolveWorkspace } from "./identity.ts";
import { workspaceConfig, hooksAllowed } from "./trust.ts";
import { localPath, workspaceProject } from "./utils.ts";
import { SESSION_DIRECTORIES_FILE } from "./constants.ts";
import type { Catalog, DeleteOptions, Workspace, WorkspaceDependencies } from "./types.ts";

const protectSessions = async (stateDirectory: string, path: string): Promise<void> => {
  const { data: directories, error } = await tryCatch(
    readRegular(join(stateDirectory, SESSION_DIRECTORIES_FILE)).then(JSON.parse),
  );
  if (isError(error, "ENOENT")) return;
  if (error) throw error;
  if (!Array.isArray(directories) || !directories.every(directory => typeof directory === "string"))
    throw new Error("Invalid workspace session directory index.");

  for (const directory of directories as string[]) {
    const canonical = await tryCatch(realpath(directory));
    if (canonical.error && !isError(canonical.error, "ENOENT")) throw canonical.error;
    if (!within(canonical.data ?? resolve(directory), path)) continue;

    const files = await tryCatch(readdir(directory));
    if (files.error && !isError(files.error, "ENOENT")) throw files.error;
    if (files.data?.some(file => file.endsWith(".jsonl")))
      throw new Error(
        `Workspace contains recorded sessions at ${directory}. Move them outside the workspace before deleting it.`,
      );
  }
};

export const deleteWorkspace = async (
  dependencies: WorkspaceDependencies,
  catalog: Catalog,
  cwd: string,
  options: DeleteOptions,
  signal?: AbortSignal,
): Promise<Workspace> => {
  const workspace = await resolveWorkspace(catalog, cwd, options.workspace);
  const path = localPath(workspace);

  if (!workspace.parentId) throw new Error("The original repository cannot be deleted.");
  if (path === (await repository(cwd)))
    throw new Error("Switch to another workspace before deleting the current workspace.");
  if (catalog.workspaces.some(candidate => candidate.parentId === workspace.id && candidate.status !== "missing"))
    throw new Error("Delete descendant workspaces first.");
  if (
    catalog.operations.some(
      operation =>
        operation.state !== "complete" &&
        operation.state !== "failed" &&
        (operation.sourceId === workspace.id || operation.targetId === workspace.id),
    )
  )
    throw new Error("Workspace has an unfinished merge; retain it until recovery is complete.");

  await protectSessions(dependencies.registry.directory, path);
  if (!options.force && (await git(path, ["status", "--porcelain"])))
    throw new Error("Workspace has local changes; use force to delete it.");

  const config = await workspaceConfig(dependencies.agentDir, catalog, workspace);
  const hooks = hooksAllowed(dependencies.agentDir, catalog, workspace, options.hooks);
  const env = { WORKSPACE_SOURCE: path, WORKSPACE_TARGET: path, WORKSPACE_ID: workspace.id };

  if (hooks) await runHooks(config, "preDelete", path, env, signal);
  await dependencies.backend.remove(path, config, signal);
  workspace.status = "missing";
  if (hooks) await runHooks(config, "postDelete", workspaceProject(catalog, workspace).origin, env, signal);

  return workspace;
};
