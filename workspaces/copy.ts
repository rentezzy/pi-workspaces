import { lstat, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PRIVATE_FILE_MODE } from "../shared/constants.ts";
import { tryCatch } from "../shared/errors.ts";
import { isError } from "../shared/fs.ts";
import { ignoreMarker } from "../git/filter.ts";
import { WORKSPACE_MARKER } from "./constants.ts";
import { localPath } from "./utils.ts";
import type { Config } from "../config/types.ts";
import type { CopyBackend, Workspace } from "./types.ts";

const writeMarker = async (workspace: Workspace): Promise<void> => {
  const path = localPath(workspace);

  await ignoreMarker(path);
  await writeFile(join(path, WORKSPACE_MARKER), workspace.id + "\n", { mode: PRIVATE_FILE_MODE });
};

const recoverCopy = async (workspace: Workspace, error: Error): Promise<void> => {
  await lstat(localPath(workspace));
  if ((error as Error & { committed?: boolean }).committed) await writeMarker(workspace);
};

const copy = async (
  backend: CopyBackend,
  source: string,
  into: string,
  workspace: Workspace,
  config: Config,
  signal?: AbortSignal,
): Promise<string> => {
  const path = await realpath(await backend.create(source, into, workspace.name, config, signal));
  if (path !== localPath(workspace)) throw new Error("Copy backend returned an unexpected destination.");

  return path;
};

export const copyWorkspace = async (
  backend: CopyBackend,
  source: string,
  into: string,
  workspace: Workspace,
  config: Config,
  signal?: AbortSignal,
): Promise<string> => {
  const { data: path, error } = await tryCatch(copy(backend, source, into, workspace, config, signal));
  if (error) {
    const recovery = await tryCatch(recoverCopy(workspace, error));
    if (isError(recovery.error, "ENOENT")) workspace.status = "missing";

    throw error;
  }

  await writeMarker(workspace);
  return path;
};
