import { realpath } from "node:fs/promises";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SelectList, truncateToWidth } from "@earendil-works/pi-tui";
import { tryCatch } from "../shared/errors.ts";
import type { WorkspaceView } from "../workspaces/types.ts";
import { BACK, HINTS, WORKSPACE_BACK_ITEM, WORKSPACE_ROWS, WORKSPACES_TITLE } from "./constants.ts";
import { workspaceInfo } from "./details.ts";
import { dialogCompletion, dialogView } from "./dialog.ts";
import type { WorkspaceAction, WorkspaceChoice } from "./types.ts";
import {
  isHere,
  matchesShortcut,
  navigateList,
  oneLine,
  selectionPreview,
  selectTheme,
  workspaceDetails,
} from "./utils.ts";
import { workspaceActions, workspaceHints } from "./workspace-actions.ts";

export const workspacePicker = async (
  ctx: ExtensionContext,
  views: WorkspaceView[],
  title = WORKSPACES_TITLE,
  allViews = views,
  selected?: string,
): Promise<WorkspaceView | undefined> => (await pickWorkspace(ctx, views, title, allViews, selected, false))?.workspace;

export const workspaceBrowser = async (
  ctx: ExtensionContext,
  views: WorkspaceView[],
  selected?: string,
  transfer = false,
): Promise<WorkspaceChoice | undefined> =>
  await pickWorkspace(ctx, views, WORKSPACES_TITLE, views, selected, true, transfer);

const pickWorkspace = async (
  ctx: ExtensionContext,
  candidates: WorkspaceView[],
  title: string,
  allViews: WorkspaceView[],
  selected: string | undefined,
  shortcuts: boolean,
  transfer = false,
): Promise<WorkspaceChoice | undefined> => {
  if (ctx.signal?.aborted) return;
  const { data: canonical } = await tryCatch(realpath(ctx.cwd));
  const cwd = canonical ?? ctx.cwd;
  const views = [...candidates].sort((a, b) => Number(isHere(b, cwd)) - Number(isHere(a, cwd)));
  if (ctx.signal?.aborted) return;

  if (ctx.mode !== "tui") {
    const labels = views.map(workspace => workspaceDetails(workspace, allViews));
    const choice = await ctx.ui.select(title, [...labels, BACK], { signal: ctx.signal });
    const workspace = views[labels.indexOf(choice ?? "")];
    return workspace ? { workspace } : undefined;
  }

  return await ctx.ui.custom<WorkspaceChoice | undefined>((tui, theme, keys, done) => {
    const { finish, dispose } = dialogCompletion(ctx, done);
    const items = [
      ...views.map(workspace => ({ value: workspace.id, label: oneLine(workspace.name) })),
      WORKSPACE_BACK_ITEM,
    ];
    const current = (): WorkspaceView | undefined =>
      views.find(workspace => workspace.id === list.getSelectedItem()?.value);
    const list = new SelectList(
      items,
      WORKSPACE_ROWS,
      {
        ...selectTheme(theme),
        selectedText: text => {
          const workspace = current();
          return theme.fg(workspace && isHere(workspace, cwd) ? "success" : "accent", text);
        },
      },
      {
        truncatePrimary: ({ text, item, maxWidth }) => {
          const value = truncateToWidth(text, maxWidth, "…");
          const workspace = views.find(workspace => workspace.id === item.value);
          return workspace && isHere(workspace, cwd) ? theme.fg("success", value) : value;
        },
      },
    );
    list.setSelectedIndex(
      Math.max(
        0,
        views.findIndex(workspace => workspace.id === selected),
      ),
    );
    list.onSelect = () => {
      const workspace = current();
      finish(workspace ? { workspace } : undefined);
    };
    list.onCancel = () => finish();

    const information = new Map(views.map(workspace => [workspace.id, workspaceInfo(workspace, allViews, theme)]));
    const header = selectionPreview(information, () => current()?.id);
    const view = dialogView(tui, theme, {
      dispose,
      layout: () => ({
        title,
        children: [header, list],
        hint: [
          HINTS.navigate,
          shortcuts ? HINTS.actions : HINTS.select,
          ...(shortcuts ? workspaceHints(current(), cwd, transfer) : []),
          HINTS.back,
        ].join(" · "),
      }),
      handleInput: data => {
        const workspace = current();
        const shortcut =
          shortcuts && workspace
            ? workspaceActions(workspace, cwd, transfer).find(
                action => action.shortcut && matchesShortcut(data, action.shortcut),
              )
            : undefined;
        if (shortcut && workspace) return finish({ workspace, action: shortcut.value as WorkspaceAction });
        if (!navigateList(data, list, items, keys)) list.handleInput(data);
      },
    });
    list.onSelectionChange = () => view.redraw();
    return view;
  });
};
