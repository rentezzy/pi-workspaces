import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ProjectTrustStore } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { runHooks } from "../config/hooks.ts";
import { repository } from "../git/repository.ts";
import { capture } from "../git/snapshots.ts";
import { resolveWorkspace } from "./identity.ts";
import { workspaceConfig } from "./trust.ts";
import { workspaceName, workspaceProject, localPath } from "./utils.ts";
import { validateWorkspaceName } from "./validation.ts";
import { copyWorkspace } from "./copy.ts";
import { checkoutBranch, checkoutLocal } from "./checkout.ts";
import type { Catalog, CreateOptions, Workspace, WorkspaceDependencies } from "./types.ts";

export const createWorkspaceCopy = async (
  dependencies: WorkspaceDependencies,
  catalog: Catalog,
  cwd: string,
  options: CreateOptions,
  trusted: boolean,
  signal?: AbortSignal,
): Promise<Workspace> => {
  const source = await resolveWorkspace(catalog, cwd, options.from, trusted);
  const project = workspaceProject(catalog, source);
  const config = await workspaceConfig(dependencies.agentDir, catalog, source);
  const sourcePath = await repository(localPath(source));
  const decision = new ProjectTrustStore(dependencies.agentDir).get(project.origin);
  const sourceTrusted = ((await repository(cwd)) === sourcePath && trusted) || source.trusted || decision === true;
  if (sourceTrusted && decision !== false) source.trusted = true;

  const hooks = options.hooks !== false && source.trusted && decision !== false;
  const id = randomUUID();
  const into = join(config.root, `${project.slug}-${project.id}`);

  await mkdir(into, { recursive: true });

  const name =
    options.name ??
    workspaceName([
      ...catalog.workspaces
        .filter(workspace => workspace.projectId === project.id && workspace.status !== "missing")
        .map(workspace => workspace.name),
      ...(await readdir(into)),
    ]);
  validateWorkspaceName(name, catalog, project.id);

  const destination = join(into, name);
  const env = { WORKSPACE_SOURCE: sourcePath, WORKSPACE_TARGET: destination, WORKSPACE_ID: id };
  if (hooks) await runHooks(config, "preCreate", sourcePath, env, signal);

  const baseline = await capture(sourcePath, config, signal);
  const expected = join(await realpath(into), name);
  const { error } = await tryCatch(lstat(expected));
  if (!error) throw new Error("Workspace destination already exists.");
  if (!isError(error, "ENOENT")) throw error;

  const workspace: Workspace = {
    id,
    projectId: project.id,
    name,
    location: { kind: "local", path: expected },
    parentId: source.id,
    baseline,
    createdAt: Date.now(),
    trusted: source.trusted,
    marker: id,
    status: "setup-failed",
  };

  catalog.workspaces.push(workspace);
  await dependencies.registry.save(catalog);

  const path = await copyWorkspace(dependencies.backend, sourcePath, into, workspace, config, signal);
  workspace.baseline =
    (options.strategy ?? config.defaultStrategy) === "branch"
      ? await checkoutBranch(path, options.ref ?? config.baseBranch, config, signal)
      : await checkoutLocal(path, baseline, config, signal);

  if (hooks) await runHooks(config, "postCreate", path, { ...env, WORKSPACE_TARGET: path }, signal);

  workspace.status = "ready";
  return workspace;
};
