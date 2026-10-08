import { runHooks } from "../config/hooks.ts";
import { integrate } from "../git/integration/merge.ts";
import { repository } from "../git/repository.ts";
import { resolveWorkspace } from "./identity.ts";
import { workspaceConfig, hooksAllowed } from "./trust.ts";
import { localPath } from "./utils.ts";
import type { MergeOptions, MergeResult } from "../git/types.ts";
import type { Catalog, WorkspaceDependencies } from "./types.ts";

export const mergeWorkspaces = async (
  dependencies: WorkspaceDependencies,
  catalog: Catalog,
  cwd: string,
  options: MergeOptions,
  trusted: boolean,
  signal?: AbortSignal,
): Promise<MergeResult> => {
  const source = await resolveWorkspace(catalog, cwd, options.source, trusted);
  const target = await resolveWorkspace(catalog, cwd, options.target, trusted);

  if (source.id === target.id) throw new Error("Source and destination are the same workspace.");
  if (source.projectId !== target.projectId)
    throw new Error("Only workspaces of the same registered project can be merged.");

  await repository(localPath(source));
  await repository(localPath(target));

  const config = await workspaceConfig(dependencies.agentDir, catalog, target);
  const hooks = hooksAllowed(dependencies.agentDir, catalog, target, options.hooks);
  const env = { WORKSPACE_SOURCE: localPath(source), WORKSPACE_TARGET: localPath(target), WORKSPACE_ID: target.id };

  if (hooks) await runHooks(config, "preMerge", localPath(target), env, signal);

  const result = await integrate(dependencies.registry, catalog, source, target, config, options, signal);
  if (hooks && result.status === "merged") await runHooks(config, "postMerge", localPath(target), env, signal);

  return result;
};
