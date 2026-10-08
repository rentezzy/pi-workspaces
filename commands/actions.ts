import { realpath } from "node:fs/promises";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { isHere, oneLine } from "../ui/utils.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import type { WorkspaceToolActions } from "../tools/types.ts";

const showViews: WorkspaceToolActions["showViews"] = async (ctx, views) => {
  if (!ctx.hasUI) return;

  const { data } = await tryCatch(realpath(ctx.cwd));
  const current = views.find(workspace => isHere(workspace, data ?? ctx.cwd));

  ctx.ui.setWidget("workspaces", undefined);
  ctx.ui.setStatus("workspaces", current ? oneLine(current.name) : undefined);
};

export const refreshWorkspaces = async (
  service: WorkspaceService,
  ctx: ExtensionContext,
  signal?: AbortSignal,
): Promise<void> => {
  if (!ctx.hasUI || signal?.aborted) return;

  const { error } = await tryCatch(service.list(ctx.cwd, signal).then(views => showViews(ctx, views)));
  if (!error) return;

  ctx.ui.setWidget("workspaces", undefined);
  ctx.ui.setStatus("workspaces", undefined);
};

export const createWorkspaceActions = (service: WorkspaceService): WorkspaceToolActions => {
  const queue = { tail: Promise.resolve<unknown>(undefined) };

  const mutate = <T>(
    ctx: ExtensionContext,
    signal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T> => {
    const pending = queue.tail.then(async () => {
      signal?.throwIfAborted();

      try {
        return await operation();
      } finally {
        await refreshWorkspaces(service, ctx, signal);
      }
    });

    queue.tail = tryCatch(pending);
    return pending;
  };

  return {
    showViews,
    create: (ctx, options, signal) =>
      mutate(ctx, signal, () => service.create(ctx.cwd, options, ctx.isProjectTrusted(), signal)),
    remove: (ctx, options, signal) =>
      mutate(ctx, signal, () => service.delete(ctx.cwd, options, ctx.isProjectTrusted(), signal)),
    merge: (ctx, options, signal) =>
      mutate(ctx, signal, () => service.merge(ctx.cwd, options, ctx.isProjectTrusted(), signal)),
    configure: (ctx, options, signal) =>
      mutate(ctx, signal, () => service.configure(ctx.cwd, options, ctx.isProjectTrusted(), signal)),
  };
};
