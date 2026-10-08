import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { nonempty, record } from "../shared/validation.ts";
import { SESSION_ACTIVE, SESSION_BINDING, THINKING_LEVELS } from "./constants.ts";
import type { SessionBinding, SessionBindingInspection, SessionSnapshot } from "./types.ts";

export { SessionIdentityError } from "./types.ts";

const validPredecessor = (value: unknown): boolean =>
  record(value) && ["sessionId", "path", "history"].every(key => nonempty(value[key]));

const validSelection = (value: unknown): boolean =>
  record(value) &&
  (value.model === undefined || (record(value.model) && nonempty(value.model.provider) && nonempty(value.model.id))) &&
  (value.thinkingLevel === undefined || THINKING_LEVELS.some(level => level === String(value.thinkingLevel)));

const parseBinding = (data: Record<string, unknown>): SessionBinding => {
  const validIdentity =
    data.version === 1 &&
    ["sessionId", "projectId", "workspaceId", "conversationId", "cwd"].every(key => nonempty(data[key]));

  if (
    !validIdentity ||
    (data.predecessor !== undefined && !validPredecessor(data.predecessor)) ||
    (data.selection !== undefined && !validSelection(data.selection))
  ) {
    throw new Error("Invalid workspace session binding.");
  }

  return data as unknown as SessionBinding;
};

export const sessionBinding = (entries: readonly SessionEntry[], sessionId: string): SessionBinding | undefined => {
  const entry = [...entries]
    .reverse()
    .find(
      entry =>
        entry.type === "custom" &&
        entry.customType === SESSION_BINDING &&
        record(entry.data) &&
        entry.data.sessionId === sessionId,
    );

  if (entry?.type !== "custom" || !record(entry.data)) return undefined;
  return parseBinding(entry.data);
};

export const inspectSessionBinding = (
  entries: readonly SessionEntry[],
  sessionId: string,
): SessionBindingInspection => {
  try {
    return { binding: sessionBinding(entries, sessionId) };
  } catch (error) {
    return { issue: String(error) };
  }
};

export const sessionIsActive = (entries: readonly SessionEntry[], sessionId: string): boolean =>
  entries.some(
    entry =>
      entry.type === "custom" &&
      entry.customType === SESSION_ACTIVE &&
      record(entry.data) &&
      entry.data.sessionId === sessionId,
  );

export const sessionSnapshot = (manager: ExtensionContext["sessionManager"]): SessionSnapshot => {
  const header = manager.getHeader();
  if (!header) throw new Error("The current session has no header.");

  return {
    header: structuredClone(header),
    entries: structuredClone(manager.getEntries()),
    leafId: manager.getLeafId(),
    path: manager.getSessionFile(),
  };
};
