import type { WorkspaceView } from "../workspaces/types.ts";
import { WORKSPACE_ACTION_ITEMS } from "./constants.ts";
import type { MenuItem } from "./types.ts";
import { isHere } from "./utils.ts";

export const workspaceActions = (workspace: WorkspaceView, cwd: string, transfer = false): MenuItem[] => {
  const here = isHere(workspace, cwd);
  return WORKSPACE_ACTION_ITEMS.filter(item => {
    if (item.value === "transfer") return transfer && !here && workspace.status === "ready";
    if (item.value === "mergeHere") return !here;
    if (item.value === "delete") return !!workspace.parentId && !here;
    return true;
  });
};

export const workspaceHints = (workspace: WorkspaceView | undefined, cwd: string, transfer: boolean): string[] => {
  if (!workspace) return [];
  return workspaceActions(workspace, cwd, transfer)
    .filter(action => action.shortcut)
    .map(
      action =>
        `${action.shortcut === "shift+m" ? "M" : action.shortcut === "delete" ? "Del" : action.shortcut} ${action.label.toLowerCase()}`,
    );
};
