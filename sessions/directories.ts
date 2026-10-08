import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { tryCatch } from "../shared/errors.ts";
import { atomicJSON, isError, readRegular } from "../shared/fs.ts";
import { nonempty } from "../shared/validation.ts";
import type { WorkspaceService } from "../workspaces/service.ts";
import { SESSION_DIRECTORIES_FILE } from "../workspaces/constants.ts";

const directoryIndexPath = (service: WorkspaceService): string =>
  join(service.registry.directory, SESSION_DIRECTORIES_FILE);

const parseDirectoryIndex = (value: unknown): string[] => {
  if (!Array.isArray(value) || !value.every(nonempty)) {
    throw new Error("Invalid workspace session directory index.");
  }
  return value;
};

const readDirectoryIndex = async (path: string): Promise<string[]> => {
  const { data, error } = await tryCatch(readRegular(path));
  if (!error) return parseDirectoryIndex(JSON.parse(data));
  if (isError(error, "ENOENT")) return [];
  throw error;
};

export const rememberDirectory = async (service: WorkspaceService, directory: string): Promise<void> => {
  if (!directory) return;
  const path = directoryIndexPath(service);
  const resolvedDirectory = resolve(directory);
  if ((await readDirectoryIndex(path)).includes(resolvedDirectory)) return;

  await service.registry.locked(async () => {
    const directories = await readDirectoryIndex(path);
    await atomicJSON(path, [...new Set([...directories, resolvedDirectory])]);
  });
};

const encodedDirectory = (cwd: string): string =>
  `--${resolve(cwd)
    .replace(/^[/\\]/, "")
    .replace(/[/\\:]/g, "-")}--`;

export const sessionDirectory = (agentDir: string, ctx: ExtensionContext, cwd: string): string => {
  const current = resolve(ctx.sessionManager.getSessionDir());
  const root = join(agentDir, "sessions");
  const defaultDirectory = resolve(join(root, encodedDirectory(ctx.cwd)));
  if (current !== defaultDirectory) return current;
  return join(root, encodedDirectory(cwd));
};

export const sessionDirectories = async (service: WorkspaceService, ctx: ExtensionContext): Promise<Set<string>> => {
  const root = join(service.agentDir, "sessions");
  const { data, error } = await tryCatch(readdir(root, { withFileTypes: true }));
  if (error && !isError(error, "ENOENT")) throw error;

  const directories = data?.filter(entry => entry.isDirectory()).map(entry => join(root, entry.name)) ?? [];
  const remembered = await readDirectoryIndex(directoryIndexPath(service));
  return new Set([root, ctx.sessionManager.getSessionDir(), ...directories, ...remembered].filter(Boolean));
};
