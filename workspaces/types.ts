import type { Config } from "../config/types.ts";
import type { Snapshot, Operation, Receipt } from "../git/types.ts";
import type { Registry } from "./registry.ts";

export type Strategy = "local" | "branch";
export type Location = { kind: "local"; path: string } | { kind: "remote"; connection: string; path: string };

export interface Workspace {
  id: string;
  projectId: string;
  name: string;
  location: Location;
  parentId?: string;
  baseline?: Snapshot;
  createdAt: number;
  trusted: boolean;
  marker?: string;
  status: "ready" | "setup-failed" | "missing";
}

export interface Project {
  id: string;
  origin: string;
  slug: string;
  rootId: string;
}

export interface WorkspaceView extends Workspace {
  branch?: string | null;
  dirty?: boolean;
  error?: string;
}

export interface Catalog {
  version: 1;
  projects: Project[];
  workspaces: Workspace[];
  receipts: Receipt[];
  operations: Operation[];
}

export interface CreateOptions {
  name?: string;
  from?: string;
  strategy?: Strategy;
  ref?: string;
  hooks?: boolean;
}

export interface DeleteOptions {
  workspace: string;
  force?: boolean;
  hooks?: boolean;
}

export interface CopyBackend {
  create: (from: string, into: string, name: string, config: Config, signal?: AbortSignal) => Promise<string>;
  remove: (path: string, config: Config, signal?: AbortSignal) => Promise<void>;
}

export interface WorkspaceServiceOptions {
  agentDir?: string;
  stateDir?: string;
  backend?: CopyBackend;
}

export interface CurrentWorkspace {
  project: Project;
  workspace: Workspace;
}

export interface WorkspaceDependencies {
  agentDir: string;
  registry: Registry;
  backend: CopyBackend;
}

export interface LockOwner {
  pid: number;
  token: string;
  host: string;
}

export interface LockWaitState {
  emptySince: number;
}

export interface RegistryLock {
  verify: () => Promise<void>;
  release: () => Promise<void>;
}
