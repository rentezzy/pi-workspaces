import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { sessionBinding, sessionIsActive } from "./binding.ts";
import type { WorkspaceSessions } from "./service.ts";
import { SessionIdentityError, type SessionSelection } from "./types.ts";

const activateSelection = async (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  selection: SessionSelection,
): Promise<void> => {
  const desired = selection.model;
  if (desired && (ctx.model?.provider !== desired.provider || ctx.model?.id !== desired.id)) {
    const model = ctx.modelRegistry.find(desired.provider, desired.id);
    if (!model || !(await pi.setModel(model))) {
      ctx.ui.notify(
        `Model ${desired.provider}/${desired.id} is unavailable here; select another with /model.`,
        "warning",
      );
    }
  }

  const thinkingLevel = selection.thinkingLevel;
  if (!thinkingLevel) return;
  pi.setThinkingLevel(thinkingLevel);
  if (pi.getThinkingLevel() !== thinkingLevel) {
    ctx.ui.notify(
      `Thinking level ${thinkingLevel} is unsupported by the active model; using ${pi.getThinkingLevel()}.`,
      "warning",
    );
  }
};

export const activateSession = async (
  pi: ExtensionAPI,
  sessions: WorkspaceSessions,
  ctx: ExtensionContext,
): Promise<void> => {
  const entries = ctx.sessionManager.getEntries();
  const id = ctx.sessionManager.getSessionId();
  const binding = sessionBinding(entries, id);
  if (!binding?.selection || sessionIsActive(entries, id)) return;

  await sessions.validate(binding, ctx.cwd);
  await activateSelection(pi, ctx, binding.selection);
};

export const validateCurrentSession = async (
  sessions: WorkspaceSessions,
  ctx: ExtensionContext,
  identityIssue?: string,
): Promise<void> => {
  if (identityIssue) throw new SessionIdentityError(identityIssue);
  const binding = sessionBinding(ctx.sessionManager.getEntries(), ctx.sessionManager.getSessionId());
  if (binding) await sessions.validate(binding, ctx.cwd);
};
