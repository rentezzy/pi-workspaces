import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { WorkspaceService } from "./workspaces/service.ts";
import { SessionNavigation } from "./sessions/navigation.ts";
import { WorkspacePanel } from "./ui/panel.ts";
import { createWorkspaceActions } from "./commands/actions.ts";
import { registerWorkspaceCommand } from "./commands/workspace.ts";
import { registerWorkspaceTools } from "./tools/register.ts";
import { tryCatch } from "./shared/errors.ts";

const workspacesExtension = (pi: ExtensionAPI): void => {
  const service = new WorkspaceService();
  const actions = createWorkspaceActions(service);
  const navigation = new SessionNavigation(pi, service, {
    create: (ctx, options) => actions.create(ctx, options, ctx.signal),
    configure: ctx => actions.configure(ctx, {}, ctx.signal),
  });

  navigation.register();
  registerWorkspaceTools(pi, service, actions);
  registerWorkspaceCommand(pi, service, {
    ...actions,
    panel: ctx =>
      new WorkspacePanel(ctx, service, {
        create: options => actions.create(ctx, options, ctx.signal),
        remove: options => actions.remove(ctx, options, ctx.signal),
        merge: options => actions.merge(ctx, options, ctx.signal),
        configure: options => actions.configure(ctx, options, ctx.signal),
        transfer: workspace => navigation.transfer(ctx, workspace),
      }),
  });

  pi.on("project_trust", async event => {
    const { data } = await tryCatch(service.inheritedTrust(event.cwd));
    return { trusted: data === true ? "yes" : "undecided" };
  });
};

export default workspacesExtension;
