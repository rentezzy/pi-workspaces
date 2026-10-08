import { resolve } from "node:path";
import { SessionManager, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import { inspectSessionBinding } from "./binding.ts";
import { sessionDirectories } from "./directories.ts";
import { loadSession } from "./files.ts";
import { markCheckpoints, workspaceSession } from "./history.ts";
import type { WorkspaceSession } from "./types.ts";

export const discoverSessions = async (
  service: WorkspaceService,
  ctx: ExtensionContext,
): Promise<WorkspaceSession[]> => {
  const catalog = await service.registry.read();
  const directories = await sessionDirectories(service, ctx);
  const infos = (
    await Promise.all([...directories].map(directory => SessionManager.listAll(directory, undefined, ctx.signal)))
  ).flat();
  const rows = new Map<string, WorkspaceSession>();

  for (const info of infos) {
    const path = resolve(info.path);
    if (rows.has(path)) continue;

    const { data, error } = await tryCatch(loadSession(info.path));
    if (error) {
      if (ctx.signal?.aborted) throw error;
      continue;
    }
    rows.set(path, workspaceSession(info, data, catalog));
  }

  return markCheckpoints(rows).sort((a, b) => b.modified.getTime() - a.modified.getTime());
};

export const currentProjectId = async (
  service: WorkspaceService,
  ctx: ExtensionContext,
): Promise<string | undefined> => {
  const { binding } = inspectSessionBinding(ctx.sessionManager.getEntries(), ctx.sessionManager.getSessionId());
  if (binding?.projectId) return binding.projectId;

  const { data, error } = await tryCatch(service.current(ctx.cwd, ctx.isProjectTrusted(), ctx.signal));
  if (error) return undefined;
  return data.project.id;
};
