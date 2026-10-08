import { isAbsolute, relative, resolve } from "node:path";
import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import {
  matchesKey,
  type Component,
  type Input,
  type KeyId,
  type SelectItem,
  type SelectList,
  type SelectListTheme,
} from "@earendil-works/pi-tui";
import type { MergeResult } from "../git/types.ts";
import type { Workspace, WorkspaceView } from "../workspaces/types.ts";
import { INPUT_END, LIST_MOVES } from "./constants.ts";

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
export const oneLine = (value: string) => value.replace(/[\x00-\x1f\x7f-\x9f]/g, " ");

export const workspacePath = (workspace: Workspace): string =>
  workspace.location.kind === "local"
    ? workspace.location.path
    : `${workspace.location.connection}:${workspace.location.path}`;

export const isHere = (workspace: Workspace, cwd: string): boolean => {
  if (workspace.location.kind !== "local") return false;
  const path = relative(resolve(workspace.location.path), resolve(cwd));
  return path === "" || (path !== ".." && !path.startsWith("../") && !path.startsWith("..\\") && !isAbsolute(path));
};

export const workspaceLine = (workspace: WorkspaceView): string =>
  `${oneLine(workspace.name)} · ${oneLine(workspace.branch ?? "detached")} · ${workspace.status}${workspace.dirty ? " · dirty" : ""}${workspace.error ? " · error" : ""}`;

export const workspaceSummary = (verb: string, workspace: Workspace): string =>
  `${verb} ${oneLine(workspace.name)} (${workspace.status})\n${oneLine(workspacePath(workspace))}\nid: ${workspace.id}`;

export const workspaceDetails = (workspace: WorkspaceView, views: WorkspaceView[]): string => {
  const parent = views.find(candidate => candidate.id === workspace.parentId);
  return [
    oneLine(workspace.name),
    `Path: ${oneLine(workspacePath(workspace))}`,
    `ID: ${workspace.id}`,
    `Project: ${workspace.projectId}`,
    `From: ${oneLine(parent?.name ?? workspace.parentId ?? "original repository")}`,
    `Branch: ${oneLine(workspace.branch ?? "detached")}`,
    `Local changes: ${workspace.dirty === undefined ? "unknown" : workspace.dirty ? "yes" : "no"}`,
    `Status: ${workspace.status}`,
    `Trusted: ${workspace.trusted ? "yes" : "no"}`,
    `Created: ${new Date(workspace.createdAt).toLocaleString()}`,
    workspace.error ? `Error: ${oneLine(workspace.error)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

export const mergeSummary = (result: MergeResult): string =>
  [
    `${result.status === "merged" ? "Merged" : "Conflicts"}: ${result.source} → ${result.target} (${result.mode})`,
    `operation: ${result.operation}`,
    result.branches.length ? `branches: ${result.branches.join(", ")}` : "",
    result.conflicts.length ? `conflicts: ${result.conflicts.join(", ")}` : "",
    result.integrationPath ? `integration path: ${result.integrationPath}` : "",
    result.instructions ?? "",
  ]
    .filter(Boolean)
    .join("\n");

export const matchesShortcut = (data: string, key: KeyId): boolean =>
  matchesKey(data, key) || (key === "delete" && matchesKey(data, "backspace"));

export const selectTheme = (theme: Theme): SelectListTheme => ({
  selectedPrefix: text => theme.fg("accent", text),
  selectedText: text => theme.fg("accent", text),
  description: text => theme.fg("muted", text),
  scrollInfo: text => theme.fg("dim", text),
  noMatch: text => theme.fg("dim", text),
});

export const fillInput = (input: Input, value: string): void => {
  input.setValue(value);
  input.handleInput(INPUT_END);
};

export const navigateList = (
  data: string,
  list: SelectList,
  items: SelectItem[],
  keys: KeybindingsManager,
): boolean => {
  const move = LIST_MOVES.find(([action]) => keys.matches(data, action));
  if (!move) return false;
  const index = items.findIndex(item => item.value === list.getSelectedItem()?.value);
  list.setSelectedIndex(index + move[1]);
  return true;
};

export const selectionPreview = (
  information: Map<string, Component>,
  selected: () => string | undefined,
): Component => ({
  render: width => {
    const id = selected();
    if (!id || !information.has(id)) return [];
    const blocks = new Map([...information].map(([key, info]) => [key, info.render(width)]));
    const height = Math.max(0, ...[...blocks.values()].map(block => block.length));
    const lines = blocks.get(id)!;
    return [...lines, ...Array<string>(height - lines.length).fill("")];
  },
  invalidate: () => information.forEach(info => info.invalidate()),
});
