import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component, Focusable, KeyId, SelectItem, SelectList, TuiMouseEvent } from "@earendil-works/pi-tui";
import type { Configuration, ConfigureOptions } from "../config/types.ts";
import type { MergeOptions, MergeResult } from "../git/types.ts";
import type { SessionFilter, SessionGrouping, WorkspaceSession } from "../sessions/types.ts";
import type { CreateOptions, DeleteOptions, Workspace, WorkspaceView } from "../workspaces/types.ts";
import type { SessionList } from "./session-list.ts";

export interface MenuItem extends SelectItem {
  shortcut?: KeyId;
}

export type Header = (theme: Theme) => Component;

export type MenuSelector = (
  title: string,
  options: (string | MenuItem)[],
  key?: string,
  header?: Header,
  initial?: string,
) => Promise<string | undefined>;

export interface DialogLayout {
  title: string;
  children: Component[];
  hint: string;
}

export interface DialogOptions {
  layout: (width: number) => DialogLayout;
  handleInput: (data: string) => void;
  beforeMouse?: (event: TuiMouseEvent) => void;
  focus?: Focusable;
  dispose: () => void;
}

export interface DialogView extends Component, Focusable {
  redraw: () => void;
  dispose: () => void;
}

export interface WorkspaceActions {
  create: (options: CreateOptions) => Promise<Workspace>;
  remove: (options: DeleteOptions) => Promise<Workspace>;
  merge: (options: MergeOptions) => Promise<MergeResult>;
  configure: (options: ConfigureOptions) => Promise<Configuration>;
  transfer?: (workspace: Workspace) => Promise<boolean>;
}

export type WorkspaceAction = "fork" | "mergeHere" | "mergeOther" | "transfer" | "delete" | "back";

export interface WorkspaceChoice {
  workspace: WorkspaceView;
  action?: WorkspaceAction;
}

export interface WorkspaceBrowserState {
  selectedId?: string;
  views: WorkspaceView[];
  shortcut?: WorkspaceAction;
}

export interface CreationActions {
  create: (options: CreateOptions) => Promise<Workspace>;
  configure: () => Promise<Configuration>;
  select?: (title: string, choices: string[]) => Promise<string | undefined>;
}

export interface SettingsActions {
  configure: (options: ConfigureOptions) => Promise<Configuration>;
  select: MenuSelector;
  report: (error: unknown) => void;
}

export type SettingsPatch = Pick<ConfigureOptions, "settings" | "reset">;

export type PanelStart = "panel" | "list" | "configure";

export type ListNoun = "command" | "pattern";

export interface BranchPickerState {
  items: SelectItem[];
  list?: SelectList;
}

export interface SessionPickerState extends SessionFilter {
  grouping: SessionGrouping;
  selected?: string;
}

export interface SessionChoice {
  session: WorkspaceSession;
  action: "resume" | "rename" | "delete";
}

export interface SessionDialogState {
  list?: SessionList;
}
