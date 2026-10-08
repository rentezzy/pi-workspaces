import type { CreateOptions, DeleteOptions } from "../workspaces/types.ts";
import type { MergeOptions } from "../git/types.ts";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { WorkspacePanel } from "../ui/panel.ts";
import type { WorkspaceToolActions } from "../tools/types.ts";

export type Command =
  | { verb: "panel" }
  | { verb: "list" }
  | { verb: "configure" }
  | { verb: "help" }
  | { verb: "create"; options: CreateOptions }
  | { verb: "delete"; options: DeleteOptions }
  | { verb: "merge"; options: MergeOptions };

export interface TokenState {
  args: string[];
  value: string;
  quote?: "'" | '"';
  started: boolean;
  skip: boolean;
}

export interface ArgumentState {
  flags: Record<string, string | true>;
  positional: string[];
  literal: boolean;
  skip: boolean;
}

export interface CommandActions extends WorkspaceToolActions {
  panel: (ctx: ExtensionCommandContext) => WorkspacePanel;
}
