import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Configuration, ConfigureOptions } from "../config/types.ts";
import type { MergeOptions, MergeResult } from "../git/types.ts";
import type { CreateOptions, DeleteOptions, Workspace, WorkspaceView } from "../workspaces/types.ts";

export interface WorkspaceToolActions {
  create: (ctx: ExtensionContext, options: CreateOptions, signal?: AbortSignal) => Promise<Workspace>;
  remove: (ctx: ExtensionContext, options: DeleteOptions, signal?: AbortSignal) => Promise<Workspace>;
  merge: (ctx: ExtensionContext, options: MergeOptions, signal?: AbortSignal) => Promise<MergeResult>;
  configure: (ctx: ExtensionContext, options: ConfigureOptions, signal?: AbortSignal) => Promise<Configuration>;
  showViews: (ctx: ExtensionContext, views: WorkspaceView[]) => Promise<void>;
}
