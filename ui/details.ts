import type { Theme } from "@earendil-works/pi-coding-agent";
import { Text, visibleWidth, type Component } from "@earendil-works/pi-tui";
import type { WorkspaceView } from "../workspaces/types.ts";
import { DETAILS_COLUMN_GAP } from "./constants.ts";
import { oneLine, workspacePath } from "./utils.ts";

export const workspaceSections = (workspace: WorkspaceView, views: WorkspaceView[]) => {
  const parent = views.find(candidate => candidate.id === workspace.parentId);
  return {
    primary: [
      `Branch: ${oneLine(workspace.branch ?? "detached")}`,
      `Changes: ${workspace.dirty === undefined ? "unknown" : workspace.dirty ? "local edits" : "clean"}`,
      `Status: ${workspace.status}`,
      `Path: ${oneLine(workspacePath(workspace))}`,
    ],
    secondary: [
      `From: ${oneLine(parent?.name ?? workspace.parentId ?? "original repository")}`,
      `Created: ${new Date(workspace.createdAt).toLocaleString()}`,
      `Project: ${workspace.projectId}`,
      `ID: ${workspace.id}`,
    ],
  };
};

export const workspaceInfo = (workspace: WorkspaceView, views: WorkspaceView[], theme: Theme): Component => {
  const { primary, secondary } = workspaceSections(workspace, views);
  const body = (width: number): string[] => {
    if (width < 64) return new Text([...primary, ...secondary].join("\n"), 1, 0).render(width);

    const leftWidth = Math.floor((width - DETAILS_COLUMN_GAP - 2) * 0.55);
    const rightWidth = width - DETAILS_COLUMN_GAP - 2 - leftWidth;
    const left = new Text(primary.join("\n"), 0, 0).render(leftWidth);
    const right = new Text(secondary.join("\n"), 0, 0).render(rightWidth);
    return Array.from({ length: Math.max(left.length, right.length) }, (_, index) => {
      const value = left[index] ?? "";
      return (
        " " +
        value +
        " ".repeat(leftWidth - visibleWidth(value) + DETAILS_COLUMN_GAP) +
        theme.fg("muted", right[index] ?? "") +
        " "
      );
    });
  };

  return {
    render: width => [
      ...new Text(theme.fg("accent", theme.bold(oneLine(workspace.name))), 1, 0).render(width),
      ...body(width),
      ...(workspace.error
        ? new Text(theme.fg("warning", "Error: " + oneLine(workspace.error)), 1, 0).render(width)
        : []),
      "",
    ],
    invalidate: () => {},
  };
};
