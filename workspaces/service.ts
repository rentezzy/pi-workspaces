import { homedir } from "node:os";
import { join } from "node:path";
import { Registry } from "./registry.ts";
import { RiftBackend } from "./backend.ts";
import { resolveWorkspace, sessionWorkspace } from "./identity.ts";
import { workspaceConfig, inheritedTrust } from "./trust.ts";
import { workspaceProject } from "./utils.ts";
import { listWorkspaces, workspaceBranches } from "./queries.ts";
import { createWorkspaceCopy } from "./create.ts";
import { deleteWorkspace } from "./delete.ts";
import { mergeWorkspaces } from "./merge.ts";
import { configureWorkspace } from "./configuration.ts";
import type { Config, ConfigureOptions, Configuration } from "../config/types.ts";
import type { MergeOptions, MergeResult } from "../git/types.ts";
import type {
  CreateOptions,
  DeleteOptions,
  CurrentWorkspace,
  Workspace,
  WorkspaceView,
  WorkspaceDependencies,
  WorkspaceServiceOptions,
} from "./types.ts";

export class WorkspaceService implements WorkspaceDependencies {
  readonly agentDir: string;
  readonly registry: Registry;
  readonly backend: WorkspaceDependencies["backend"];

  constructor(options: WorkspaceServiceOptions = {}) {
    this.agentDir = options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
    this.registry = new Registry(options.stateDir ?? join(this.agentDir, "workspaces"));
    this.backend = options.backend ?? new RiftBackend();
  }

  current = (cwd: string, trusted = false, signal?: AbortSignal): Promise<CurrentWorkspace> =>
    this.registry.locked(async catalog => {
      const workspace = await resolveWorkspace(catalog, cwd, "here", trusted);
      return { project: workspaceProject(catalog, workspace), workspace };
    }, signal);

  sessionWorkspace = async (projectId: string, workspaceId: string, cwd: string): Promise<Workspace> =>
    sessionWorkspace(await this.registry.read(), projectId, workspaceId, cwd);

  sessionConfig = async (workspace: Workspace): Promise<Config> => {
    const catalog = await this.registry.read();
    const registered = catalog.workspaces.find(
      candidate => candidate.id === workspace.id && candidate.projectId === workspace.projectId,
    );

    if (!registered) throw new Error("The session's workspace is not registered in this profile.");

    return await workspaceConfig(this.agentDir, catalog, registered);
  };

  inheritedTrust = async (cwd: string): Promise<boolean | undefined> =>
    inheritedTrust(this.agentDir, await this.registry.read(), cwd);

  branches = async (cwd: string, from?: string, signal?: AbortSignal): Promise<string[]> =>
    workspaceBranches(await this.registry.read(), cwd, from, signal);

  list = (cwd: string, signal?: AbortSignal): Promise<WorkspaceView[]> =>
    this.registry.locked(catalog => listWorkspaces(catalog, cwd, signal), signal);

  create = (cwd: string, options: CreateOptions, trusted: boolean, signal?: AbortSignal): Promise<Workspace> =>
    this.registry.locked(catalog => createWorkspaceCopy(this, catalog, cwd, options, trusted, signal), signal);

  delete = (cwd: string, options: DeleteOptions, _trusted: boolean, signal?: AbortSignal): Promise<Workspace> =>
    this.registry.locked(catalog => deleteWorkspace(this, catalog, cwd, options, signal), signal);

  merge = (cwd: string, options: MergeOptions, trusted: boolean, signal?: AbortSignal): Promise<MergeResult> =>
    this.registry.locked(catalog => mergeWorkspaces(this, catalog, cwd, options, trusted, signal), signal);

  configure = (
    cwd: string,
    options: ConfigureOptions,
    trusted: boolean,
    signal?: AbortSignal,
  ): Promise<Configuration> =>
    this.registry.locked(catalog => configureWorkspace(this.agentDir, catalog, cwd, options, trusted, signal), signal);
}
