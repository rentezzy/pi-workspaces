import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { createWorkspace } from "../ui/creation.ts";
import { menuPicker } from "../ui/menu.ts";
import { sessionPicker } from "../ui/session-picker.ts";
import type { SessionPickerState } from "../ui/types.ts";
import { errorMessage } from "../ui/utils.ts";
import { workspacePicker } from "../ui/workspace-picker.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { Workspace } from "../workspaces/types.ts";
import { activateSession, validateCurrentSession } from "./activation.ts";
import { sessionBinding, sessionSnapshot } from "./binding.ts";
import { DEFAULT_GROUPING, PERSISTENT_SESSION_ERROR, SAME_PROJECT_ERROR } from "./constants.ts";
import { currentProjectId } from "./discovery.ts";
import { openPreparedSession } from "./files.ts";
import { deleteSession, renameSession } from "./mutations.ts";
import { resumeSession } from "./recovery.ts";
import { WorkspaceSessions } from "./service.ts";
import { SessionIdentityError, type SessionNavigationActions } from "./types.ts";

const reportCommandError = (ctx: ExtensionCommandContext, error: unknown): void => {
  try {
    ctx.ui.notify(errorMessage(error), "error");
  } catch {}
};

export class SessionNavigation {
  readonly sessions: WorkspaceSessions;
  private identityIssue?: string;

  constructor(
    private pi: ExtensionAPI,
    private service: WorkspaceService,
    private actions: SessionNavigationActions,
  ) {
    this.sessions = new WorkspaceSessions(service);
  }

  private requireUI = (ctx: ExtensionCommandContext): void => {
    if (!ctx.hasUI) throw new Error("Workspace session navigation is for interactive use.");
    if (!ctx.sessionManager.getSessionFile()) throw new Error(PERSISTENT_SESSION_ERROR);
  };

  transfer = async (ctx: ExtensionCommandContext, workspace: Workspace): Promise<boolean> => {
    this.requireUI(ctx);
    await ctx.waitForIdle();
    const binding = sessionBinding(ctx.sessionManager.getEntries(), ctx.sessionManager.getSessionId());
    if (binding) await this.sessions.validate(binding, ctx.cwd);

    const current = await this.service.current(ctx.cwd, ctx.isProjectTrusted(), ctx.signal);
    if (workspace.projectId !== current.project.id) throw new Error(SAME_PROJECT_ERROR);
    if (workspace.id === current.workspace.id) return false;

    const path = await this.sessions.prepare(ctx, workspace, sessionSnapshot(ctx.sessionManager));
    return await openPreparedSession(ctx, path);
  };

  private chooseWorkspace = async (ctx: ExtensionCommandContext): Promise<Workspace | undefined> => {
    const kind = await menuPicker(ctx, "New workspace session", ["Create workspace", "Existing workspace", "Back"]);
    if (!kind || kind === "Back") return undefined;
    if (kind === "Create workspace") {
      return await createWorkspace(ctx, this.service, {
        create: options => this.actions.create(ctx, options),
        configure: () => this.actions.configure(ctx),
      });
    }

    const views = await this.service.list(ctx.cwd, ctx.signal);
    return await workspacePicker(
      ctx,
      views.filter(workspace => workspace.status === "ready"),
      "Session workspace",
      views,
    );
  };

  newWorkspaceSession = async (ctx: ExtensionCommandContext): Promise<void> => {
    this.requireUI(ctx);
    await ctx.waitForIdle();
    const workspace = await this.chooseWorkspace(ctx);
    if (!workspace) return;

    const path = await this.sessions.prepare(ctx, workspace);
    await openPreparedSession(ctx, path);
  };

  res = async (ctx: ExtensionCommandContext): Promise<void> => {
    this.requireUI(ctx);
    await ctx.waitForIdle();
    const projectId = await currentProjectId(this.service, ctx);
    const state: SessionPickerState = {
      projectOnly: !!projectId,
      history: false,
      query: "",
      grouping: DEFAULT_GROUPING,
    };

    while (!ctx.signal?.aborted) {
      const choice = await sessionPicker(ctx, await this.sessions.list(ctx), projectId, state);
      if (!choice) return;
      if (choice.action === "resume") {
        if (await resumeSession(ctx, this.sessions, choice.session)) return;
      } else if (choice.action === "rename") await renameSession(this.pi, ctx, choice.session);
      else await deleteSession(ctx, choice.session);
    }
  };

  private reportBindingError = (ctx: ExtensionContext, error: unknown): void => {
    try {
      if (error instanceof SessionIdentityError) this.identityIssue = errorMessage(error);
      if (this.identityIssue || sessionBinding(ctx.sessionManager.getEntries(), ctx.sessionManager.getSessionId())) {
        ctx.ui.notify(`Session binding needs recovery: ${errorMessage(error)}. Use /res or /new.`, "error");
      }
    } catch {
      ctx.ui.notify("Invalid session binding. Use /new to start a fresh conversation.", "error");
    }
  };

  private startSession = async (ctx: ExtensionContext): Promise<void> => {
    await activateSession(this.pi, this.sessions, ctx);
    await this.sessions.observe(ctx, (type, data) => this.pi.appendEntry(type, data));
  };

  register = (): void => {
    (
      [
        ["neww", "Start a fresh session in a new or existing workspace", this.newWorkspaceSession],
        ["res", "Resume project conversations across all its workspaces", this.res],
      ] as const
    ).forEach(([name, description, run]) => {
      const runCommand = async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
        if (args.trim()) throw new Error(`Usage: /${name}`);
        await run(ctx);
      };
      this.pi.registerCommand(name, {
        description,
        handler: async (args, ctx) => {
          const { error } = await tryCatch(runCommand(args, ctx));
          if (error) reportCommandError(ctx, error);
        },
      });
    });

    this.pi.on("session_start", async (_event, ctx) => {
      if (!ctx.hasUI) return;
      this.identityIssue = undefined;
      const { error } = await tryCatch(this.startSession(ctx));
      if (error) this.reportBindingError(ctx, error);
    });

    this.pi.on("tool_call", async (_event, ctx) => {
      const { error } = await tryCatch(validateCurrentSession(this.sessions, ctx, this.identityIssue));
      if (error)
        return {
          block: true,
          reason: `Session workspace is unavailable: ${errorMessage(error)}. Use /res to recover, or /new.`,
        };
    });
  };
}
