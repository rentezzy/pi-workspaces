import { realpath } from "node:fs/promises";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { WorkspaceView } from "../workspaces/types.ts";
import { BACK, DIALOG_REQUIRED, MERGE_ITEMS, PANEL_CHOICES, WORKSPACES_TITLE } from "./constants.ts";
import { createWorkspace } from "./creation.ts";
import { workspaceInfo } from "./details.ts";
import { menuPicker } from "./menu.ts";
import { SettingsPanel } from "./settings-panel.ts";
import type {
  Header,
  MenuItem,
  PanelStart,
  WorkspaceAction,
  WorkspaceActions,
  WorkspaceBrowserState,
} from "./types.ts";
import { errorMessage, mergeSummary, oneLine, workspaceDetails, workspacePath } from "./utils.ts";
import { workspaceActions } from "./workspace-actions.ts";
import { workspaceBrowser, workspacePicker } from "./workspace-picker.ts";

export class WorkspacePanel {
  private selections = new Map<string, string>();
  private switched = false;

  constructor(
    private ctx: ExtensionContext,
    private service: WorkspaceService,
    private actions: WorkspaceActions,
  ) {}

  show = async (start: PanelStart = "panel"): Promise<void> => {
    if (!this.ctx.hasUI) throw new Error(DIALOG_REQUIRED);
    if (start === "list") return await this.list();
    if (start === "configure") return await this.configure();
    while (!this.switched && !this.ctx.signal?.aborted) {
      const choice = await this.select(WORKSPACES_TITLE, PANEL_CHOICES);
      if (!choice || choice === BACK) return;
      const { error } = await tryCatch(this.open(choice));
      if (error) this.report(error);
    }
  };

  private open = async (choice: string): Promise<void> => {
    if (choice === "Create") return await this.create();
    if (choice === "List") return await this.list();
    if (choice === "Configure") await this.configure();
  };

  private select = async (
    title: string,
    options: (string | MenuItem)[],
    key = title,
    header?: Header,
    initial?: string,
  ) => {
    const choice = await menuPicker(this.ctx, title, options, initial ?? this.selections.get(key), header);
    if (choice) this.selections.set(key, choice);
    return choice;
  };

  private report = (error: unknown): void => {
    try {
      if (this.ctx.signal?.aborted) return;
      this.ctx.ui.notify(errorMessage(error), "error");
    } catch {}
  };

  private create = async (from?: string): Promise<void> => {
    const workspace = await createWorkspace(
      this.ctx,
      this.service,
      {
        create: options => this.actions.create(options),
        configure: () => this.actions.configure({}),
        select: (title, choices) => this.select(title, choices),
      },
      from,
    );
    if (!workspace) return;
    this.ctx.ui.notify(`Created ${oneLine(workspace.name)}\n${oneLine(workspacePath(workspace))}`, "info");
  };

  private merge = async (source: WorkspaceView, target?: string): Promise<void> => {
    const mode = await this.select("Merge mode", MERGE_ITEMS);
    if (!mode) return;
    const result = await this.actions.merge({
      source: source.id,
      target,
      mode: mode === "active" ? "active" : "passive",
    });
    this.ctx.ui.notify(mergeSummary(result), result.status === "conflicts" ? "warning" : "info");
  };

  private perform = async (
    action: WorkspaceAction,
    workspace: WorkspaceView,
    views: WorkspaceView[],
  ): Promise<void> => {
    if (action === "transfer" && this.actions.transfer) {
      this.switched = await this.actions.transfer(workspace);
      return;
    }
    if (action === "fork") return await this.create(workspace.id);
    if (action === "mergeHere") return await this.merge(workspace);
    if (action === "mergeOther") {
      const targets = views.filter(
        target => target.id !== workspace.id && target.status === "ready" && target.location.kind === "local",
      );
      if (!targets.length) {
        this.ctx.ui.notify("No other ready local target.", "warning");
        return;
      }
      const target = await workspacePicker(this.ctx, targets, "Merge target", views);
      if (target) await this.merge(workspace, target.id);
      return;
    }
    if (action !== "delete" || !workspace.parentId) return;
    const current = (await this.service.list(this.ctx.cwd, this.ctx.signal)).find(
      candidate => candidate.id === workspace.id,
    );
    if (!current) return;
    if (
      current.dirty &&
      !(await this.ctx.ui.confirm(
        "Discard local changes?",
        `Delete ${oneLine(current.name)} and discard its local changes?\n${oneLine(workspacePath(current))}`,
        { signal: this.ctx.signal },
      ))
    )
      return;
    await this.actions.remove({ workspace: current.id, force: !!current.dirty });
    this.ctx.ui.notify(`Deleted ${oneLine(current.name)}`, "info");
  };

  private list = async (): Promise<void> => {
    const { data: canonical } = await tryCatch(realpath(this.ctx.cwd));
    const cwd = canonical ?? this.ctx.cwd;
    const state: WorkspaceBrowserState = { views: [] };
    while (!this.ctx.signal?.aborted) {
      state.views = await this.service.list(this.ctx.cwd, this.ctx.signal);
      const choice = await workspaceBrowser(this.ctx, state.views, state.selectedId, !!this.actions.transfer);
      if (!choice) return;
      state.selectedId = choice.workspace.id;
      state.shortcut = choice.action;
      const previousIndex = state.views.findIndex(workspace => workspace.id === state.selectedId);
      while (!this.ctx.signal?.aborted) {
        const workspace = state.views.find(workspace => workspace.id === state.selectedId);
        if (!workspace) {
          state.selectedId = state.views[Math.min(previousIndex, state.views.length - 1)]?.id;
          break;
        }
        const action =
          state.shortcut ??
          (await this.select(
            this.ctx.mode === "tui" ? "Workspace" : workspaceDetails(workspace, state.views),
            workspaceActions(workspace, cwd, !!this.actions.transfer),
            `actions:${workspace.id}`,
            theme => workspaceInfo(workspace, state.views, theme),
          ));
        if (!action || action === "back") break;
        const { error } = await tryCatch(this.perform(action as WorkspaceAction, workspace, state.views));
        if (error) this.report(error);
        if (this.switched) return;
        state.views = await this.service.list(this.ctx.cwd, this.ctx.signal);
        if (!state.views.some(workspace => workspace.id === state.selectedId)) {
          state.selectedId = state.views[Math.min(previousIndex, state.views.length - 1)]?.id;
          break;
        }
        if (state.shortcut) break;
        state.shortcut = undefined;
      }
    }
  };

  private configure = async (): Promise<void> => {
    await new SettingsPanel(this.ctx, this.service, {
      configure: options => this.actions.configure(options),
      select: (title, options, key, header, initial) => this.select(title, options, key, header, initial),
      report: error => this.report(error),
    }).show();
  };
}
