import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { Workspace } from "../workspaces/types.ts";
import { branchPicker } from "./branch-picker.ts";
import { BACK, CREATION_CHOICES } from "./constants.ts";
import { menuPicker } from "./menu.ts";
import type { CreationActions } from "./types.ts";

export const createWorkspace = async (
  ctx: ExtensionContext,
  service: WorkspaceService,
  actions: CreationActions,
  from?: string,
): Promise<Workspace | undefined> => {
  const select = actions.select ?? ((title: string, choices: string[]) => menuPicker(ctx, title, choices));
  const strategy = await select("Creation source", CREATION_CHOICES);
  if (!strategy || strategy === BACK) return;
  if (strategy !== "Branch")
    return await actions.create({
      from,
      ref: undefined,
      strategy: strategy === "Default" ? undefined : strategy === "Local" ? "local" : "branch",
    });

  const config = await actions.configure();
  const ref = await branchPicker(ctx, await service.branches(ctx.cwd, from, ctx.signal), config.effective.baseBranch);
  if (!ref) return;
  return await actions.create({ from, ref, strategy: "branch" });
};
