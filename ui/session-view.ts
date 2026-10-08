import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { sessionTitle } from "../sessions/grouping.ts";
import type { WorkspaceSession } from "../sessions/types.ts";
import { HINTS, SESSION_ACTIONS, SESSION_EMPTY } from "./constants.ts";
import type { SessionPickerState } from "./types.ts";
import { oneLine } from "./utils.ts";

export const sessionLabel = (session: WorkspaceSession): string =>
  `${oneLine(sessionTitle(session))} · ${oneLine(session.workspaceName)} · ${session.id}`;

export const sessionPickerTitle = (state: SessionPickerState): string =>
  `Resume · ${state.projectOnly ? "Project" : "All"} · ${state.grouping === "workspace" ? "Workspaces" : "Sessions"}${state.history ? " · History" : ""}`;

export const sessionPickerHint = (keys: KeybindingsManager, projectId?: string): string =>
  [
    HINTS.navigate,
    HINTS.resume,
    HINTS.grouping,
    ...(projectId ? [HINTS.scope] : []),
    HINTS.history,
    ...SESSION_ACTIONS.flatMap(([action, label]) => {
      const binding = keys.getKeys(action).join("/");
      return binding ? [`${binding} ${label}`] : [];
    }),
    HINTS.back,
  ].join(" · ");

export const sessionDetails = (selected: () => WorkspaceSession | undefined, theme: Theme): Component => ({
  render: width => {
    const session = selected();
    const lines = session
      ? [
          theme.fg("muted", "Workspace: ") + oneLine(session.workspaceName),
          theme.fg("muted", "Path: ") + oneLine(session.cwd),
          theme.fg(
            "dim",
            `${session.messageCount} messages · ${session.modified.toLocaleString()} · ${session.id.slice(-8)}`,
          ),
        ]
      : [theme.fg("dim", SESSION_EMPTY), "", ""];
    return lines.map(line => " " + truncateToWidth(line, Math.max(0, width - 2), "…"));
  },
  invalidate: () => {},
});
