export const SESSION_BINDING = "workspaces.session-binding";
export const SESSION_ACTIVE = "workspaces.session-active";
export const SESSION_TRANSITION = "workspaces.session-transition";
export const DEFAULT_GROUPING = "workspace";

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
export const HISTORY_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "message",
  "custom_message",
  "compaction",
  "branch_summary",
  "context_edit",
]);

export const PERSISTENT_SESSION_ERROR =
  "Workspace session navigation requires persistent sessions; restart without --no-session.";
export const SAME_PROJECT_ERROR = "Transfer sessions only between workspaces of the same project.";
