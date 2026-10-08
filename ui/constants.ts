import type { MenuItem } from "./types.ts";

export const BACK = "Back";
export const BACK_ITEM: MenuItem = { value: "back", label: BACK };
export const WORKSPACE_BACK_ITEM: MenuItem = { value: "", label: BACK };
export const OTHER_REF = "Other ref…";
export const WORKSPACES_TITLE = "Workspaces";
export const CREATION_CHOICES = ["Default", "Local", "Branch", BACK];
export const PANEL_CHOICES = ["Create", "List", "Configure", BACK];
export const SCOPE_CHOICES = ["Project", "Profile", BACK];
export const STRATEGY_CHOICES = ["Local", "Branch"];
export const LIST_CHOICES = ["Add", BACK];
export const LIST_ACTIONS = ["Edit", "Delete", BACK];
export const MERGE_ITEMS: MenuItem[] = [
  { value: "passive", label: "Passive", description: "Keep destination branch" },
  { value: "active", label: "Active", description: "Select source branch" },
];
export const WORKSPACE_ACTION_ITEMS: MenuItem[] = [
  { value: "transfer", label: "Switch to", shortcut: "t" },
  { value: "fork", label: "Fork", shortcut: "f" },
  { value: "mergeHere", label: "Merge into here", shortcut: "m" },
  { value: "mergeOther", label: "Merge into other workspace", shortcut: "shift+m" },
  { value: "delete", label: "Delete", shortcut: "delete" },
  BACK_ITEM,
];
export const SETTINGS_ITEMS: MenuItem[] = [
  { value: "strategy", label: "Default strategy" },
  { value: "branch", label: "Base branch" },
  { value: "root", label: "Storage root" },
  { value: "executable", label: "Rift executable" },
  { value: "exclude", label: "Exclusions" },
  { value: "hooks", label: "Hooks" },
  { value: "transferNotice", label: "Transfer notice" },
  { value: "reset", label: "Reset overrides" },
  BACK_ITEM,
];
export const LIST_MOVES = [
  ["tui.select.up", -1],
  ["tui.select.down", 1],
  ["tui.select.pageUp", -6],
  ["tui.select.pageDown", 6],
] as const;
export const SESSION_ACTIONS = [
  ["app.session.rename", "rename"],
  ["app.session.delete", "delete"],
] as const;
export const MENU_ROWS = 9;
export const WORKSPACE_ROWS = 6;
export const BRANCH_ROWS = 8;
export const LIST_EDITOR_ROWS = 8;
export const SESSION_ROWS = 12;
export const SESSION_MIN_ROWS = 4;
export const SESSION_MAX_ROWS = 14;
export const DETAILS_COLUMN_GAP = 3;
export const HINTS = {
  navigate: "↑↓ navigate",
  select: "enter select",
  actions: "enter actions",
  back: "esc back",
  resume: "enter resume",
  grouping: "tab grouping",
  scope: "ctrl+p scope",
  history: "shift+tab history",
};
export const INPUT_END = "\x1b[F";
export const INPUT_HINT = "enter save · esc back";
export const BRANCH_HINT = "↑↓ navigate · tab complete · enter select · esc back";
export const BRANCH_EMPTY = "  No matching branches; enter uses the typed ref";
export const LIST_INPUT_HINT = "enter save · ↑ list · tab switch · esc back & save";
export const LIST_SELECTION_HINT = "↑↓ select · enter edit · Backspace/Del remove · type to add · esc back & save";
export const SESSION_EMPTY = "No matching sessions. Try All or History.";
export const DIALOG_REQUIRED = "Workspace menus require a dialog-capable UI; use workspace tools instead.";
