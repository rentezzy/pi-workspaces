import { join, resolve } from "node:path";
import { ProjectTrustStore, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { CONFIG_FILE, PROJECT_CONFIG_DIRECTORY } from "../config/constants.ts";
import { readSettings, saveSettings, loadConfig } from "../config/store.ts";
import { parseSettings } from "../config/validation.ts";
import { mergeSettings } from "../config/utils.ts";
import { expand } from "../shared/fs.ts";
import { resolveWorkspace } from "./identity.ts";
import { projectTrusted } from "./trust.ts";
import { workspaceProject } from "./utils.ts";
import type { Configuration, ConfigureOptions } from "../config/types.ts";
import type { Catalog } from "./types.ts";

export const configureWorkspace = async (
  agentDir: string,
  catalog: Catalog,
  cwd: string,
  options: ConfigureOptions,
  trusted: boolean,
  signal?: AbortSignal,
): Promise<Configuration> => {
  const workspace = await resolveWorkspace(catalog, cwd, "here", trusted);
  const project = workspaceProject(catalog, workspace);
  const decision = new ProjectTrustStore(agentDir).get(project.origin);
  const scope = options.scope ?? "project";

  if (scope !== "project" && scope !== "profile") throw new Error("Configuration scope must be project or profile.");
  if (scope === "project" && !projectTrusted(catalog, workspace, decision))
    throw new Error("Trust the origin project before configuring its workspace defaults.");

  const path =
    scope === "profile"
      ? join(resolve(expand(agentDir)), CONFIG_FILE)
      : join(project.origin, PROJECT_CONFIG_DIRECTORY, CONFIG_FILE);

  return await withFileMutationQueue(path, async () => {
    const saved = options.reset ? {} : await readSettings(path);
    const changed = options.settings !== undefined || !!options.reset;
    const settings = changed ? mergeSettings(saved, parseSettings(options.settings ?? {})) : saved;
    const effective = await loadConfig(agentDir, project.origin, scope === "project", { path, settings });

    signal?.throwIfAborted();
    if (changed) await saveSettings(path, settings);

    return { scope, path, settings, effective };
  });
};
