import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { errorMessage, mergeSummary, workspaceLine, workspacePath, workspaceSummary } from "../ui/utils.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import { USAGE } from "./constants.ts";
import { refreshWorkspaces } from "./actions.ts";
import { parseCommand } from "./parser.ts";
import { commandCompletions } from "./completion.ts";
import type { CommandActions } from "./types.ts";

const runCommand = async (
  args: string,
  ctx: ExtensionCommandContext,
  service: WorkspaceService,
  actions: CommandActions,
): Promise<void> => {
  const command = parseCommand(args);

  if (command.verb === "panel" || command.verb === "configure") return await actions.panel(ctx).show(command.verb);

  if (command.verb === "help") return ctx.ui.notify(USAGE, "info");

  if (command.verb === "list") {
    if (ctx.hasUI) return await actions.panel(ctx).show("list");

    const views = await service.list(ctx.cwd, ctx.signal);
    ctx.ui.notify(
      views
        .map(workspace => `${workspaceLine(workspace)}\n  ${workspacePath(workspace)} [${workspace.id}]`)
        .join("\n") || "No workspaces.",
      "info",
    );
    return;
  }

  if (command.verb === "create") {
    const workspace = await actions.create(ctx, command.options, ctx.signal);
    ctx.ui.notify(workspaceSummary("Created", workspace), "info");
    return;
  }

  if (command.verb === "delete") {
    const workspace = await actions.remove(ctx, command.options, ctx.signal);
    ctx.ui.notify(workspaceSummary("Deleted", workspace), "info");
    return;
  }

  const result = await actions.merge(ctx, command.options, ctx.signal);
  ctx.ui.notify(mergeSummary(result), result.status === "conflicts" ? "warning" : "info");
};

export const registerWorkspaceCommand = (
  pi: ExtensionAPI,
  service: WorkspaceService,
  actions: CommandActions,
): void => {
  const scope = { cwd: process.cwd() };

  pi.registerCommand("workspace", {
    description: "Manage workspaces: create, list, merge, delete, configure",
    getArgumentCompletions: prefix => commandCompletions(service, scope.cwd, prefix),
    handler: async (args, ctx) => {
      scope.cwd = ctx.cwd;

      const { error } = await tryCatch(runCommand(args, ctx, service, actions));
      if (error && !ctx.signal?.aborted) ctx.ui.notify(errorMessage(error), "error");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    scope.cwd = ctx.cwd;
    await refreshWorkspaces(service, ctx, ctx.signal);
  });
};
